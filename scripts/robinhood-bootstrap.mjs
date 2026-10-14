#!/usr/bin/env bun
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseAbiItem,
  parseEventLogs,
  parseUnits,
  toHex,
  zeroAddress,
} from "viem";
import {
  controlledTestOracleAbi,
  controlledTokenAbi,
  credentialIssuerRoleAbi,
  credentialRegistryAbi,
  lendingPoolV2Abi,
  robinhoodGovernanceAbi,
} from "../src/lib/contracts/abis.ts";
import { computeEligibilityCommitment, generateFieldSalt } from "../src/lib/zk/commitment.ts";
import { parseDemoCredentialWitness } from "../src/lib/credential/witness.ts";

const ROOT = process.cwd();
const CHAIN_ID = 46_630;
const EXPLORER = "https://explorer.testnet.chain.robinhood.com";
const ARTIFACT = path.join(ROOT, "contracts/broadcast/DeployRobinhoodProtocolStack.s.sol/46630/run-latest.json");
const ADMIN_FALLBACK = "0x4C488dfa668A7643C4046a1952734eF875Af0d62";
const ISSUER_FALLBACK = "0xBE390374Ac7304A792c50EA37AB301b659a56Df7";
const DEFAULT_ADMIN_ROLE = `0x${"0".repeat(64)}`;
const DAY = 86_400;
const PROPOSED_PRICES = { rUSD2: "1.00", rCOL2: "2.00" };
const TOKEN_IDS = { rUSD2: "rUSD2", rCOL2: "rCOL2" };
const RPC_READ_RETRIES = 5;
const POST_STATE_RETRIES = 6;
const authLabels = {
  price: "oracle-price",
  "refresh-price": "oracle-price-refresh",
  mint: "token-mint",
  "issue-dao": "credential-policy-4",
  "issue-lending": "credential-policy-3",
};

function usage() {
  console.log(`Robinhood Testnet demo bootstrap — chain ${CHAIN_ID}\n\nRead-only:\n  bun run robinhood:bootstrap status\n  bun run robinhood:bootstrap plan\n  bun run robinhood:bootstrap price <rUSD2|rCOL2> <decimal-price>\n  bun run robinhood:bootstrap refresh-price <rUSD2|rCOL2>\n  bun run robinhood:bootstrap mint <rUSD2|rCOL2> <wallet> <decimal-amount>\n  bun run robinhood:bootstrap issue-dao <wallet> [expiry-days]\n  bun run robinhood:bootstrap prepare-lending <wallet> <expiry-days> <witness-file>\n  bun run robinhood:bootstrap issue-lending <witness-file>\n  bun run robinhood:bootstrap credential <wallet> <3|4>\n  bun run robinhood:bootstrap participant <wallet>\n  bun run robinhood:bootstrap proposal <proposal-id>\n\nA write requires BOTH --execute and the matching --authorize-public-testnet-write=<label>,\na matching Foundry keystore alias, and a typed confirmation phrase. Simulations are always run first.\n\nWrite authorizations:\n  price:         oracle-price\n  refresh-price: oracle-price-refresh\n  mint:          token-mint\n  issue-dao:     credential-policy-4\n  issue-lending: credential-policy-3\n\nNo command deploys contracts. There is no mainnet mode.`);
}

function readArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--execute") options.execute = true;
    else if (value.startsWith("--authorize-public-testnet-write=")) {
      options.authorization = value.slice(value.indexOf("=") + 1);
    } else if (value === "--account-alias") {
      options.accountAlias = argv[++i];
    } else if (value.startsWith("--account-alias=")) {
      options.accountAlias = value.slice(value.indexOf("=") + 1);
    } else positional.push(value);
  }
  return { positional, options };
}

function sameAddress(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function pass(label, detail = "") {
  console.log(`PASS ${label}${detail ? ` · ${detail}` : ""}`);
}

function envAddress(name, fallback) {
  const value = process.env[name] || fallback;
  if (!isAddress(value)) throw new Error(`${name} is missing or is not an address.`);
  return getAddress(value);
}

function resolveRegistry() {
  assert.ok(fs.existsSync(ARTIFACT), `Missing confirmed deployment artifact ${ARTIFACT}`);
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  assert.equal(Number(artifact.chain), CHAIN_ID, "Deployment artifact must be Robinhood Testnet chain 46630.");
  assert.equal(artifact.transactions?.length, 15, "Expected the confirmed 10-create/5-initialization deployment artifact.");
  assert.equal(artifact.receipts?.length, 15, "Missing deployment receipts in Foundry artifact.");
  const result = {};
  const receiptByHash = new Map(artifact.receipts.map((receipt) => [receipt.transactionHash.toLowerCase(), receipt]));
  for (const entry of artifact.transactions) {
    if (entry.transactionType !== "CREATE") continue;
    const receipt = receiptByHash.get(entry.hash.toLowerCase());
    assert.ok(receipt && receipt.status === "0x1", `Missing successful creation receipt for ${entry.hash}`);
    const address = receipt.contractAddress ?? entry.contractAddress;
    assert.ok(address && isAddress(address), `Creation receipt ${entry.hash} has no contract address.`);
    if (entry.contractName === "ControlledTestToken") result[entry.arguments[1]] = getAddress(address);
    else if (entry.contractName) result[entry.contractName] = getAddress(address);
  }
  const adapterEntry = artifact.transactions.find((entry) => entry.contractName === "EligibilityVerifierAdapter");
  assert.ok(adapterEntry?.arguments?.[0], "Deployment artifact is missing the verifier adapter constructor dependency.");
  result.HonkVerifier = getAddress(adapterEntry.arguments[0]);
  // Validate important registry values against the existing public configuration. The generated
  // HonkVerifier's receipt-derived address is also mapped by the known deployment record.
  const named = {
    registry: "RobinhoodDemoCredentialRegistry",
    oracle: "ControlledTestOracle",
    pool: "LendingPoolV2",
    governance: "RobinhoodGovernancePhase1",
    asset: "rUSD2",
    collateral: "rCOL2",
  };
  for (const [key, name] of Object.entries(named)) assert.ok(result[name], `Artifact has no ${name} deployment.`);
  const configured = {
    registry: process.env.RH_TESTNET_CREDENTIAL_REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_ROBINHOOD_CREDENTIAL_REGISTRY_CONTRACT,
    oracle: process.env.RH_TESTNET_LENDING_V2_ORACLE_ADDRESS || process.env.NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ORACLE_CONTRACT,
    pool: process.env.RH_TESTNET_LENDING_V2_POOL_ADDRESS || process.env.NEXT_PUBLIC_ROBINHOOD_LENDING_V2_POOL_CONTRACT,
    governance: process.env.RH_TESTNET_GOVERNANCE_ADDRESS || process.env.NEXT_PUBLIC_ROBINHOOD_GOVERNANCE_CONTRACT,
    asset: process.env.RH_TESTNET_LENDING_V2_ASSET_ADDRESS || process.env.NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ASSET_CONTRACT,
    collateral: process.env.RH_TESTNET_LENDING_V2_COLLATERAL_ADDRESS || process.env.NEXT_PUBLIC_ROBINHOOD_LENDING_V2_COLLATERAL_CONTRACT,
  };
  for (const [key, name] of Object.entries(named)) {
    assert.ok(configured[key] && isAddress(configured[key]), `Missing configured ${name} address.`);
    assert.ok(sameAddress(configured[key], result[name]), `${name} config does not match its successful deployment receipt.`);
  }
  const rpcUrl = process.env.RH_TESTNET_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL;
  assert.ok(rpcUrl, "Set RH_TESTNET_RPC_URL or NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL.");
  const chain = defineChain({
    id: CHAIN_ID,
    name: "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  return {
    artifact,
    addresses: result,
    admin: envAddress("RH_TESTNET_ADMIN_ADDRESS", ADMIN_FALLBACK),
    issuer: envAddress("RH_TESTNET_ISSUER_ADDRESS", ISSUER_FALLBACK),
    rpcUrl,
    client: createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 1, timeout: 30_000 }) }),
  };
}

async function liveContext() {
  const ctx = resolveRegistry();
  const chainId = await ctx.client.getChainId();
  assert.equal(chainId, CHAIN_ID, `Configured RPC returned chain ${chainId}; refusing any action.`);
  ctx.head = await ctx.client.getBlockNumber();
  return ctx;
}

function errorText(error) {
  const parts = [];
  const seen = new Set();
  let current = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (typeof current === "string") parts.push(current);
    else if (typeof current === "object") {
      for (const key of ["shortMessage", "message", "details", "name"]) {
        if (typeof current[key] === "string") parts.push(current[key]);
      }
      current = current.cause;
      continue;
    }
    break;
  }
  return parts.join(" ");
}

function isTransientRpcError(error) {
  return /could not be found|block not found|missing trie|timeout|timed out|fetch failed|network error|ECONNRESET|ECONNREFUSED|EAI_AGAIN|temporarily unavailable|gateway|\b429\b|\b502\b|\b503\b|\b504\b/i.test(errorText(error));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retryRpcRead(operation, retries = RPC_READ_RETRIES) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries || !isTransientRpcError(error)) throw error;
      await delay(400 * (attempt + 1));
    }
  }
}

async function retryPostState(operation) {
  let lastError;
  for (let attempt = 0; attempt < POST_STATE_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < POST_STATE_RETRIES) await delay(700 * (attempt + 1));
    }
  }
  throw lastError;
}

async function read(client, address, abi, functionName, args = []) {
  return retryRpcRead(() => client.readContract({ address, abi, functionName, args }));
}

async function chainTimestamp(ctx) {
  // Avoid pinning a later preflight read to a block number returned by an RPC node
  // whose block index may not have caught up yet.
  const block = await retryRpcRead(() => ctx.client.getBlock({ blockTag: "latest" }));
  return block.timestamp;
}

async function role(client, contract, roleHash, account) {
  return read(client, contract, credentialIssuerRoleAbi, "hasRole", [roleHash, account]);
}

async function requireRole(client, contract, roleHash, account, label) {
  const assigned = await role(client, contract, roleHash, account);
  assert.equal(assigned, true, `${label} is not authorized at ${contract}.`);
}

async function tokenInfo(ctx, symbol) {
  const address = ctx.addresses[symbol];
  const [decimals, supply, cap, minterRole, balance] = await Promise.all([
    read(ctx.client, address, controlledTokenAbi, "decimals"),
    read(ctx.client, address, controlledTokenAbi, "totalSupply"),
    read(ctx.client, address, controlledTokenAbi, "mintCap"),
    read(ctx.client, address, controlledTokenAbi, "MINTER_ROLE"),
    read(ctx.client, address, controlledTokenAbi, "balanceOf", [ctx.admin]),
  ]);
  return { address, decimals, supply, cap, minterRole, adminBalance: balance };
}

async function status() {
  const ctx = await liveContext();
  const { client, addresses, admin, issuer } = ctx;
  const [oracleRole, issuerRole, govVotingPeriod, govQuorum, executionWindow, minValidity, nextId, lendingPolicy, lendingThreshold, loanBounds, collateralBounds, loan, collateral] = await Promise.all([
    read(client, addresses.ControlledTestOracle, controlledTestOracleAbi, "PRICE_UPDATER_ROLE"),
    read(client, addresses.RobinhoodDemoCredentialRegistry, credentialIssuerRoleAbi, "ISSUER_ROLE"),
    read(client, addresses.RobinhoodGovernancePhase1, robinhoodGovernanceAbi, "votingPeriod"),
    read(client, addresses.RobinhoodGovernancePhase1, robinhoodGovernanceAbi, "quorum"),
    read(client, addresses.RobinhoodGovernancePhase1, robinhoodGovernanceAbi, "executionWindow"),
    read(client, addresses.RobinhoodGovernancePhase1, robinhoodGovernanceAbi, "minimumRemainingValidity"),
    read(client, addresses.RobinhoodGovernancePhase1, robinhoodGovernanceAbi, "nextProposalId"),
    read(client, addresses.LendingPoolV2, lendingPoolV2Abi, "POLICY_ID"),
    read(client, addresses.LendingPoolV2, lendingPoolV2Abi, "ELIGIBILITY_THRESHOLD"),
    read(client, addresses.ControlledTestOracle, controlledTestOracleAbi, "getPriceBounds", [addresses.rUSD2]),
    read(client, addresses.ControlledTestOracle, controlledTestOracleAbi, "getPriceBounds", [addresses.rCOL2]),
    tokenInfo(ctx, "rUSD2"),
    tokenInfo(ctx, "rCOL2"),
  ]);
  const tokenMinterRole = loan.minterRole;
  await Promise.all([
    requireRole(client, addresses.ControlledTestOracle, DEFAULT_ADMIN_ROLE, admin, "Oracle admin"),
    requireRole(client, addresses.ControlledTestOracle, oracleRole, admin, "Oracle updater"),
    requireRole(client, addresses.RobinhoodDemoCredentialRegistry, DEFAULT_ADMIN_ROLE, admin, "Credential registry admin"),
    requireRole(client, addresses.RobinhoodDemoCredentialRegistry, issuerRole, issuer, "Credential issuer"),
    requireRole(client, loan.address, DEFAULT_ADMIN_ROLE, admin, "rUSD2 admin"),
    requireRole(client, loan.address, tokenMinterRole, admin, "rUSD2 minter"),
    requireRole(client, collateral.address, collateral.minterRole, admin, "rCOL2 minter"),
  ]);
  const [issuerAdmin, loanMinter, collateralMinter, updater] = await Promise.all([
    role(client, addresses.RobinhoodDemoCredentialRegistry, DEFAULT_ADMIN_ROLE, admin),
    role(client, loan.address, loan.minterRole, admin),
    role(client, collateral.address, loan.minterRole, admin),
    role(client, addresses.ControlledTestOracle, oracleRole, admin),
  ]);
  const [adminBalance, issuerBalance] = await Promise.all([
    client.getBalance({ address: admin }), client.getBalance({ address: issuer }),
  ]);
  assert.ok(issuerAdmin && loanMinter && collateralMinter && updater);
  console.log(`Robinhood Testnet protocol status · chain ${CHAIN_ID} · block ${ctx.head}`);
  console.log(`Admin/oracle updater/minter: ${admin} · issuer: ${issuer}`);
  console.log(`Native test ETH: admin ${formatUnits(adminBalance, 18)} · issuer ${formatUnits(issuerBalance, 18)} (read-only balance check)`);
  console.log(`Role checks: registry admin=${issuerAdmin}, issuer=${await role(client, addresses.RobinhoodDemoCredentialRegistry, issuerRole, issuer)}, oracle updater=${updater}, token minters=${loanMinter && collateralMinter}`);
  console.log(`Policy 3: threshold ${lendingThreshold.toString()} · policy ${lendingPolicy.toString()} · V2 pool ${addresses.LendingPoolV2}`);
  console.log(`Policy 4: project registry ${addresses.RobinhoodDemoCredentialRegistry} · DAO ${addresses.RobinhoodGovernancePhase1}`);
  console.log(`DAO: quorum ${govQuorum.toString()} · voting ${govVotingPeriod.toString()}s · execution window ${executionWindow.toString()}s · current minimum validity ${minValidity.toString()}s · next ID ${nextId.toString()}`);
  for (const [name, token, bounds, proposed] of [["rUSD2", loan, loanBounds, PROPOSED_PRICES.rUSD2], ["rCOL2", collateral, collateralBounds, PROPOSED_PRICES.rCOL2]]) {
    console.log(`${name}: ${token.address} · decimals ${token.decimals} · supply ${formatUnits(token.supply, token.decimals)} / cap ${formatUnits(token.cap, token.decimals)} · oracle ${formatUnits(bounds[2], 18)} WAD · bounds ${formatUnits(bounds[0], 18)}–${formatUnits(bounds[1], 18)} WAD`);
    console.log(`  proposed synthetic demo price ${proposed} WAD units; not a market quote`);
  }
  console.log("No prices, tokens, or policy credentials have been written by this read-only status command.");
}

async function showCredential(wallet, policyText) {
  assert.ok(isAddress(wallet), "Wallet must be an EVM address.");
  const policy = Number(policyText);
  assert.ok(policy === 3 || policy === 4, "Policy must be 3 (Lending) or 4 (DAO).");
  const ctx = await liveContext();
  const record = await credentialRecord(ctx, wallet, policy);
  const now = await chainTimestamp(ctx);
  if (record.version === 0n) {
    console.log(`No policy-${policy} project credential is recorded for ${getAddress(wallet)}.`);
    return;
  }
  const roleHash = await read(ctx.client, ctx.addresses.RobinhoodDemoCredentialRegistry, credentialIssuerRoleAbi, "ISSUER_ROLE");
  const issuerStillAuthorized = await role(ctx.client, ctx.addresses.RobinhoodDemoCredentialRegistry, roleHash, record.issuer);
  const active = !record.revoked && record.expiresAt > now && issuerStillAuthorized;
  console.log(`Policy ${policy} credential · wallet ${record.wallet} · version ${record.version} · issuer ${record.issuer}`);
  console.log(`Commitment ${record.commitment} · expires ${new Date(Number(record.expiresAt) * 1000).toISOString()} · revoked ${record.revoked} · issuer authorized ${issuerStillAuthorized} · active ${active}`);
  if (policy === 4) {
    const member = await read(ctx.client, ctx.addresses.RobinhoodGovernancePhase1, robinhoodGovernanceAbi, "isVerifiedMember", [getAddress(wallet)]);
    console.log(`Robinhood Governance Phase 1 membership readback: ${member}`);
  }
  if (policy === 3) console.log("This readback does not expose or verify the private witness; the Lending pool rechecks a genuine proof inside gated transactions.");
}

async function showParticipant(wallet) {
  assert.ok(isAddress(wallet), "Wallet must be an EVM address.");
  const ctx = await liveContext();
  const participant = getAddress(wallet);
  const now = await chainTimestamp(ctx);
  const [loan, collateral, policy3, policy4, loanPosition, collateralPosition, membership] = await Promise.all([
    tokenInfo(ctx, "rUSD2"), tokenInfo(ctx, "rCOL2"),
    credentialRecord(ctx, participant, 3), credentialRecord(ctx, participant, 4),
    read(ctx.client, ctx.addresses.LendingPoolV2, lendingPoolV2Abi, "getPosition", [participant, ctx.addresses.rUSD2]),
    read(ctx.client, ctx.addresses.LendingPoolV2, lendingPoolV2Abi, "getPosition", [participant, ctx.addresses.rCOL2]),
    read(ctx.client, ctx.addresses.RobinhoodGovernancePhase1, robinhoodGovernanceAbi, "isVerifiedMember", [participant]),
  ]);
  console.log(`Participant readback · chain ${CHAIN_ID} · wallet ${participant}`);
  console.log(`Holdings: rUSD2 ${formatUnits(await read(ctx.client, loan.address, controlledTokenAbi, "balanceOf", [participant]), loan.decimals)} · rCOL2 ${formatUnits(await read(ctx.client, collateral.address, controlledTokenAbi, "balanceOf", [participant]), collateral.decimals)}`);
  console.log(`Lending positions: rUSD2 supplied ${formatUnits(loanPosition[0], loan.decimals)} · debt ${formatUnits(loanPosition[2], loan.decimals)}; rCOL2 collateral ${formatUnits(collateralPosition[1], collateral.decimals)} · enabled ${collateralPosition[3]}`);
  for (const [policy, record] of [[3, policy3], [4, policy4]]) {
    const roleHash = await read(ctx.client, ctx.addresses.RobinhoodDemoCredentialRegistry, credentialIssuerRoleAbi, "ISSUER_ROLE");
    const authorized = record.version > 0n && await role(ctx.client, ctx.addresses.RobinhoodDemoCredentialRegistry, roleHash, record.issuer);
    const active = record.version > 0n && !record.revoked && record.expiresAt > now && authorized;
    console.log(`Policy ${policy}: ${record.version === 0n ? "missing" : `version ${record.version}, issuer ${record.issuer}, active ${active}`}`);
  }
  console.log(`DAO verified membership: ${membership}. This cannot be inferred from policy 3.`);
  console.log("Read-only: participant lookup does not reveal policy-3 private witness material.");
}

async function showProposal(idText) {
  assert.match(idText, /^(0|[1-9][0-9]*)$/, "Proposal ID must be an unsigned decimal integer.");
  const proposalId = BigInt(idText);
  assert.ok(proposalId > 0n, "Proposal IDs begin at 1.");
  const ctx = await liveContext();
  const address = ctx.addresses.RobinhoodGovernancePhase1;
  const [proposal, state, quorum, voteCounts, timing] = await Promise.all([
    read(ctx.client, address, robinhoodGovernanceAbi, "getProposal", [proposalId]),
    read(ctx.client, address, robinhoodGovernanceAbi, "proposalState", [proposalId]),
    read(ctx.client, address, robinhoodGovernanceAbi, "quorum"),
    read(ctx.client, address, robinhoodGovernanceAbi, "proposalVoteCounts", [proposalId]),
    read(ctx.client, address, robinhoodGovernanceAbi, "proposalTiming", [proposalId]),
  ]);
  const states = ["None", "Pending", "Active", "Succeeded", "Rejected", "Expired", "Executed"];
  const now = await chainTimestamp(ctx);
  console.log(`Proposal #${proposalId} · state ${states[Number(state)] ?? `unknown(${state})`} · proposer ${proposal.proposer}`);
  console.log(`Start ${timing[0]} (${new Date(Number(timing[0]) * 1000).toISOString()}) · deadline ${timing[1]} (${new Date(Number(timing[1]) * 1000).toISOString()}) · execution deadline ${timing[2]} (${new Date(Number(timing[2]) * 1000).toISOString()})`);
  console.log(`Current time ${now}; votes For/Against/Abstain ${voteCounts.map(String).join("/")} · quorum ${quorum}`);
  console.log("Voting opens at startAt and closes at deadline. Finalization is allowed only at/after deadline. Execution requires the actual on-chain succeeded state and must occur before executionDeadline.");
  void proposal;
}

async function plan() {
  const ctx = await liveContext();
  const { client, addresses, admin } = ctx;
  const [adminRole, oracleRole, loanBounds, collateralBounds, loan, collateral] = await Promise.all([
    read(client, addresses.ControlledTestOracle, controlledTestOracleAbi, "PRICE_UPDATER_ROLE"),
    read(client, addresses.ControlledTestOracle, controlledTestOracleAbi, "PRICE_UPDATER_ROLE"),
    read(client, addresses.ControlledTestOracle, controlledTestOracleAbi, "getPriceBounds", [addresses.rUSD2]),
    read(client, addresses.ControlledTestOracle, controlledTestOracleAbi, "getPriceBounds", [addresses.rCOL2]),
    tokenInfo(ctx, "rUSD2"),
    tokenInfo(ctx, "rCOL2"),
  ]);
  await requireRole(client, addresses.ControlledTestOracle, DEFAULT_ADMIN_ROLE, admin, "Oracle admin");
  await requireRole(client, addresses.ControlledTestOracle, oracleRole, admin, "Oracle updater");
  await requireRole(client, loan.address, loan.minterRole, admin, "rUSD2 minter");
  await requireRole(client, collateral.address, collateral.minterRole, admin, "rCOL2 minter");
  assert.ok(adminRole);
  console.log(`READ-ONLY dry-run plan · chain ${CHAIN_ID} · block ${ctx.head}`);
  for (const [symbol, bounds, price] of [["rUSD2", loanBounds, PROPOSED_PRICES.rUSD2], ["rCOL2", collateralBounds, PROPOSED_PRICES.rCOL2]]) {
    const parsed = parseUnits(price, 18);
    assert.ok(parsed >= bounds[0] && parsed <= bounds[1], `${symbol} proposed demo price is outside on-chain bounds.`);
    if (bounds[2] !== 0n) console.log(`BLOCKED simulate ${symbol}: oracle already has ${formatUnits(bounds[2], 18)}; one-time initialization guard prevents overwrite.`);
    else {
      const sim = await client.simulateContract({ account: admin, address: addresses.ControlledTestOracle, abi: controlledTestOracleAbi, functionName: "setPrice", args: [addresses[symbol], parsed] });
      const gas = await client.estimateContractGas({ account: admin, address: addresses.ControlledTestOracle, abi: controlledTestOracleAbi, functionName: "setPrice", args: [addresses[symbol], parsed] });
      pass(`simulate oracle ${symbol}`, `synthetic ${price} · estimated ${gas.toString()} gas`);
      void sim;
    }
  }
  console.log(`Token mint simulation requires participant wallet addresses; current supplies are rUSD2=${formatUnits(loan.supply, loan.decimals)}, rCOL2=${formatUnits(collateral.supply, collateral.decimals)}.`);
  console.log("Credential issuance simulations require the real participant addresses. Policy 3 additionally requires a locally generated, protected witness file; policy 4 uses a random opaque project commitment and no ZK witness.");
  console.log("No writes, signatures, or broadcasts occurred.");
}

async function printAndMaybeSend(ctx, action, actor, target, abi, functionName, args, expectedState) {
  const { client } = ctx;
  const simulation = await client.simulateContract({ account: actor, address: target, abi, functionName, args });
  const gas = await client.estimateContractGas({ account: actor, address: target, abi, functionName, args });
  pass(`simulate ${functionName}`, `from ${actor} · to ${target} · estimated ${gas.toString()} gas`);
  if (!ctx.options.execute) {
    console.log(`Simulation only. To submit later, rerun with --execute --authorize-public-testnet-write=${authLabels[action]} --account-alias <Foundry-keystore-name>.`);
    return { simulation, gas, submitted: false };
  }
  assert.equal(ctx.options.authorization, authLabels[action], `Explicit authorization must exactly match ${authLabels[action]}.`);
  assert.ok(ctx.options.accountAlias && /^[A-Za-z0-9._-]+$/.test(ctx.options.accountAlias), "Supply a valid non-secret --account-alias Foundry keystore name.");
  assert.equal(process.stdin.isTTY, true, "Public write execution requires an interactive TTY for typed confirmation and keystore unlock.");
  const aliasCheck = spawnSync("cast", ["wallet", "address", "--account", ctx.options.accountAlias], { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });
  if (aliasCheck.status !== 0) throw new Error("Foundry keystore alias could not be unlocked/resolved.");
  const foundAddresses = aliasCheck.stdout.match(/0x[a-fA-F0-9]{40}/g) ?? [];
  assert.ok(foundAddresses.some((address) => sameAddress(address, actor)), `Keystore alias does not resolve to required role address ${actor}.`);
  const phrase = `WRITE Robinhood Testnet ${authLabels[action]}`;
  const entered = await readLine(`Type exactly “${phrase}” to sign and submit: `);
  assert.equal(entered, phrase, "Confirmation phrase did not match; no transaction sent.");
  const calldata = encodeFunctionData({ abi, functionName, args });
  const child = spawn("cast", [
    "send", "--rpc-url", ctx.rpcUrl, "--chain", String(CHAIN_ID), "--account", ctx.options.accountAlias,
    "--async", "--data", calldata, target,
  ], { stdio: ["inherit", "pipe", "inherit"] });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { output += chunk; process.stdout.write(chunk); });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  assert.equal(exitCode, 0, "cast send failed; inspect its output. No receipt is claimed.");
  const hashes = output.match(/0x[a-fA-F0-9]{64}/g) ?? [];
  assert.ok(hashes.length, "Could not read the submitted transaction hash from cast output.");
  const hash = hashes.at(-1);
  const receipt = await client.waitForTransactionReceipt({ hash: hash, confirmations: 1, timeout: 180_000 });
  assert.equal(receipt.status, "success", `Transaction ${hash} reverted.`);
  assert.ok(sameAddress(receipt.from, actor), `Receipt sender ${receipt.from} did not match authorized role ${actor}.`);
  assert.ok(sameAddress(receipt.to, target), `Receipt target ${receipt.to} did not match ${target}.`);
  assert.equal(Number(await client.getChainId()), CHAIN_ID);
  const isPriceAction = action === "price" || action === "refresh-price";
  const eventName = isPriceAction ? "TestPriceUpdated" : action === "mint" ? "Transfer" : "CredentialCommitted";
  const events = parseEventLogs({ abi, logs: receipt.logs, eventName, strict: false });
  const eventMatches = events.some(({ args: event }) => {
    if (isPriceAction) return sameAddress(event.asset, args[0]) && event.priceWad === args[1] && sameAddress(event.updater, actor);
    if (action === "mint") return sameAddress(event.from, zeroAddress) && sameAddress(event.to, args[0]) && event.value === args[1];
    return sameAddress(event.wallet, args[0]) && event.policyId === args[1] && event.commitment.toLowerCase() === args[2].toLowerCase() && sameAddress(event.issuer, actor);
  });
  assert.equal(eventMatches, true, `${functionName} receipt did not include its expected event arguments.`);
  let state;
  try {
    state = await retryPostState(() => expectedState(hash, receipt));
    pass("confirmed receipt and post-state", `${hash} · block ${receipt.blockNumber} · ${state}`);
  } catch (error) {
    console.error(`RECEIPT SUCCESS · post-state is not yet verified after RPC read retries. Do not resubmit this transaction. Hash ${hash} · block ${receipt.blockNumber} · ${errorText(error)}`);
    console.log(`Read-only follow-up: bun run robinhood:bootstrap status · Explorer: ${EXPLORER}/tx/${hash}`);
    return { simulation, gas, submitted: true, hash, receipt, postStateVerified: false };
  }
  console.log(`Explorer: ${EXPLORER}/tx/${hash}`);
  return { simulation, gas, submitted: true, hash, receipt, postStateVerified: true, state };
}

async function readLine(prompt) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try { return await readline.question(prompt); }
  finally { readline.close(); }
}

async function readHiddenLine(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") throw new Error("Private-value entry requires an interactive TTY; do not pass it in shell arguments or environment variables.");
  process.stdin.setEncoding("utf8");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(prompt);
  let value = "";
  try {
    return await new Promise((resolve, reject) => {
      const onData = (chunk) => {
        for (const char of chunk) {
          if (char === "\u0003") { cleanup(); reject(new Error("Canceled.")); return; }
          if (char === "\r" || char === "\n") { cleanup(); resolve(value); return; }
          if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
          else if (/^[0-9]$/.test(char)) value += char;
        }
      };
      const cleanup = () => process.stdin.off("data", onData);
      process.stdin.on("data", onData);
    });
  } finally {
    process.stdin.setRawMode(false);
    process.stdout.write("\n");
  }
}

function amountArg(value, decimals, label) {
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) throw new Error(`${label} must be a plain nonnegative decimal amount.`);
  return parseUnits(value, decimals);
}

async function actionPrice(symbol, price, options) {
  assert.ok(Object.hasOwn(PROPOSED_PRICES, symbol), "Asset must be rUSD2 or rCOL2.");
  const ctx = await liveContext(); ctx.options = options;
  const priceWad = amountArg(price, 18, "Price");
  const bounds = await read(ctx.client, ctx.addresses.ControlledTestOracle, controlledTestOracleAbi, "getPriceBounds", [ctx.addresses[symbol]]);
  assert.ok(priceWad >= bounds[0] && priceWad <= bounds[1], `Price is outside on-chain range ${formatUnits(bounds[0], 18)}–${formatUnits(bounds[1], 18)}.`);
  assert.equal(bounds[2], 0n, `${symbol} already has an initialized oracle price; this bootstrap command will not overwrite it.`);
  const roleHash = await read(ctx.client, ctx.addresses.ControlledTestOracle, controlledTestOracleAbi, "PRICE_UPDATER_ROLE");
  await requireRole(ctx.client, ctx.addresses.ControlledTestOracle, roleHash, ctx.admin, "Oracle updater");
  console.log(`Proposed synthetic demo input only: ${symbol}=${price} WAD units; not a live market price.`);
  await printAndMaybeSend(ctx, "price", ctx.admin, ctx.addresses.ControlledTestOracle, controlledTestOracleAbi, "setPrice", [ctx.addresses[symbol], priceWad], async () => {
    const after = await read(ctx.client, ctx.addresses.ControlledTestOracle, controlledTestOracleAbi, "getPriceBounds", [ctx.addresses[symbol]]);
    assert.equal(after[2], priceWad); assert.ok(after[3] > 0n);
    return `${symbol} oracle price=${formatUnits(after[2], 18)} updatedAt=${after[3].toString()}`;
  });
}

async function actionRefreshPrice(symbol, options) {
  assert.ok(Object.hasOwn(PROPOSED_PRICES, symbol), "Asset must be rUSD2 or rCOL2.");
  const ctx = await liveContext(); ctx.options = options;
  const asset = ctx.addresses[symbol];
  const [bounds, reserve, updaterRole, now] = await Promise.all([
    read(ctx.client, ctx.addresses.ControlledTestOracle, controlledTestOracleAbi, "getPriceBounds", [asset]),
    read(ctx.client, ctx.addresses.LendingPoolV2, lendingPoolV2Abi, "getReserveConfig", [asset]),
    read(ctx.client, ctx.addresses.ControlledTestOracle, controlledTestOracleAbi, "PRICE_UPDATER_ROLE"),
    chainTimestamp(ctx),
  ]);
  const expectedPrice = parseUnits(PROPOSED_PRICES[symbol], 18);
  assert.ok(bounds[2] > 0n && bounds[3] > 0n, `${symbol} has no initialized oracle price; use the separately guarded initial price command first.`);
  assert.equal(bounds[2], expectedPrice, `${symbol} price differs from the approved synthetic demo value; refusing to overwrite it.`);
  assert.ok(bounds[2] >= bounds[0] && bounds[2] <= bounds[1], `${symbol} price is outside its on-chain bounds.`);
  assert.ok(bounds[3] <= now, `${symbol} oracle timestamp is in the future; refusing a refresh.`);
  const maxOracleAge = BigInt(reserve.maxOracleAge ?? reserve[4]);
  const age = now - bounds[3];
  if (age <= maxOracleAge) {
    console.log(`SKIPPED — PRICE STILL FRESH · ${symbol} is ${age}s old; reserve maximum is ${maxOracleAge}s. No refresh transaction is needed.`);
    return { skipped: true, reason: "price-still-fresh", age, maxOracleAge };
  }
  await requireRole(ctx.client, ctx.addresses.ControlledTestOracle, updaterRole, ctx.admin, "Oracle updater");
  console.log(`Guarded refresh only: re-submit the existing ${symbol} synthetic test price ${formatUnits(bounds[2], 18)} WAD (not a market quote). Age ${age}s exceeds reserve max ${maxOracleAge}s.`);
  await printAndMaybeSend(ctx, "refresh-price", ctx.admin, ctx.addresses.ControlledTestOracle, controlledTestOracleAbi, "setPrice", [asset, bounds[2]], async () => {
    const after = await read(ctx.client, ctx.addresses.ControlledTestOracle, controlledTestOracleAbi, "getPriceBounds", [asset]);
    assert.equal(after[2], expectedPrice);
    assert.ok(after[3] > bounds[3] && after[3] <= await chainTimestamp(ctx));
    return `${symbol} unchanged at ${formatUnits(after[2], 18)} WAD · updatedAt=${after[3].toString()}`;
  });
}

async function actionMint(symbol, wallet, amount, options) {
  assert.ok(Object.hasOwn(TOKEN_IDS, symbol), "Asset must be rUSD2 or rCOL2.");
  assert.ok(isAddress(wallet), "Recipient must be an EVM address.");
  const ctx = await liveContext(); ctx.options = options;
  const token = await tokenInfo(ctx, symbol);
  const mintAmount = amountArg(amount, token.decimals, "Mint amount");
  assert.ok(mintAmount > 0n, "Mint amount must be positive.");
  assert.ok(token.supply + mintAmount <= token.cap, "Mint would exceed on-chain cap.");
  const priorBalance = await read(ctx.client, token.address, controlledTokenAbi, "balanceOf", [getAddress(wallet)]);
  assert.equal(priorBalance, 0n, `${symbol} recipient already has a balance; duplicate-mint guard refuses the action.`);
  await assertNoPriorMint(ctx, token.address, symbol, getAddress(wallet));
  const roleHash = await read(ctx.client, token.address, controlledTokenAbi, "MINTER_ROLE");
  await requireRole(ctx.client, token.address, roleHash, ctx.admin, `${symbol} minter`);
  await printAndMaybeSend(ctx, "mint", ctx.admin, token.address, controlledTokenAbi, "mint", [getAddress(wallet), mintAmount], async () => {
    const after = await read(ctx.client, token.address, controlledTokenAbi, "balanceOf", [getAddress(wallet)]);
    const supplyAfter = await read(ctx.client, token.address, controlledTokenAbi, "totalSupply");
    assert.equal(after, mintAmount); assert.equal(supplyAfter, token.supply + mintAmount);
    return `${symbol} balance=${formatUnits(after, token.decimals)} · totalSupply=${formatUnits(supplyAfter, token.decimals)}`;
  });
}

async function assertNoPriorMint(ctx, tokenAddress, symbol, recipient) {
  const deployment = ctx.artifact.transactions.find((entry) => entry.transactionType === "CREATE" && entry.contractName === "ControlledTestToken" && entry.arguments?.[1] === symbol);
  assert.ok(deployment, `No deployment artifact entry for ${symbol}.`);
  const receipt = ctx.artifact.receipts.find((item) => item.transactionHash.toLowerCase() === deployment.hash.toLowerCase());
  assert.ok(receipt?.blockNumber, `No creation block for ${symbol}.`);
  const fromBlock = BigInt(receipt.blockNumber);
  const toBlock = ctx.head;
  assert.ok(toBlock >= fromBlock, "Current block precedes token deployment block.");
  const transferEvent = parseAbiItem("event Transfer(address indexed from,address indexed to,uint256 value)");
  const initialChunkSize = 5_000n;
  const maxQueries = 4_096;
  const isRangeLimit = (error) => /block.?range|range.{0,24}(limit|too large|exceed)|(?:exceed(?:s|ed)?|over).{0,24}(range|result|log|response)|(?:too many|more than|max(?:imum)?).{0,24}(blocks|results|logs)|query exceeds|response size|result set|maximum.{0,20}block|eth_getlogs.{0,30}(limit|range)/i.test(errorText(error));
  let queries = 0;

  async function scanRange(start, end) {
    queries += 1;
    assert.ok(queries <= maxQueries, `${symbol} mint-history audit exceeded its bounded ${maxQueries}-query safety limit; refusing to mint without complete history.`);
    let logs;
    try {
      logs = await retryRpcRead(() => ctx.client.getLogs({
        address: tokenAddress,
        event: transferEvent,
        args: { from: zeroAddress, to: recipient },
        fromBlock: start,
        toBlock: end,
      }));
    } catch (error) {
      const width = end - start + 1n;
      if (width > 1n && isRangeLimit(error)) {
        const middle = start + (width / 2n) - 1n;
        await scanRange(start, middle);
        await scanRange(middle + 1n, end);
        return;
      }
      throw new Error(`Could not establish complete ${symbol} mint history for blocks ${start}-${end}: ${errorText(error)}`);
    }
    assert.equal(logs.length, 0, `${symbol} has a prior mint event to ${recipient}; duplicate-mint guard refuses a repeated allocation.`);
  }

  for (let start = fromBlock; start <= toBlock; start += initialChunkSize) {
    const end = start + initialChunkSize - 1n > toBlock ? toBlock : start + initialChunkSize - 1n;
    await scanRange(start, end);
  }
  pass(`complete mint-history audit ${symbol}`, `deployment block ${fromBlock} through head ${toBlock} · ${queries} bounded RPC ranges · no prior mint event for ${recipient}`);
}

async function credentialRecord(ctx, wallet, policy) {
  return read(ctx.client, ctx.addresses.RobinhoodDemoCredentialRegistry, credentialRegistryAbi, "getCredential", [getAddress(wallet), BigInt(policy)]);
}

function randomCommitment() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  if (bytes.every((byte) => byte === 0)) return randomCommitment();
  return toHex(bytes);
}

async function actionIssueDao(wallet, daysText, options) {
  assert.ok(isAddress(wallet), "Recipient must be an EVM address.");
  const days = Number(daysText ?? "30");
  assert.ok(Number.isInteger(days) && days >= 1 && days <= 365, "Credential expiry must be 1–365 days.");
  const ctx = await liveContext(); ctx.options = options;
  const registry = ctx.addresses.RobinhoodDemoCredentialRegistry;
  const record = await credentialRecord(ctx, wallet, 4);
  assert.equal(record.version, 0n, "Policy-4 credential already exists; duplicate issuance is refused.");
  const roleHash = await read(ctx.client, registry, credentialIssuerRoleAbi, "ISSUER_ROLE");
  await requireRole(ctx.client, registry, roleHash, ctx.issuer, "Credential issuer");
  const commitment = randomCommitment();
  const expiresAt = (await chainTimestamp(ctx)) + BigInt(days * DAY);
  const args = [getAddress(wallet), 4n, commitment, expiresAt, 1n];
  await printAndMaybeSend(ctx, "issue-dao", ctx.issuer, registry, credentialRegistryAbi, "recordCredential", args, async () => {
    const after = await credentialRecord(ctx, wallet, 4);
    assert.equal(after.wallet.toLowerCase(), wallet.toLowerCase());
    assert.equal(after.commitment.toLowerCase(), commitment.toLowerCase());
    assert.equal(after.issuer.toLowerCase(), ctx.issuer.toLowerCase());
    assert.equal(after.version, 1n); assert.equal(after.expiresAt, expiresAt); assert.equal(after.revoked, false);
    return `policy 4 credential version 1 active for ${getAddress(wallet)}`;
  });
}

async function prepareLending(wallet, daysText, witnessPath) {
  assert.ok(isAddress(wallet), "Recipient must be an EVM address.");
  assert.ok(witnessPath, "Provide a protected witness output path.");
  const days = Number(daysText);
  assert.ok(Number.isInteger(days) && days >= 1 && days <= 365, "Credential expiry must be 1–365 days.");
  const ctx = await liveContext();
  const registry = ctx.addresses.RobinhoodDemoCredentialRegistry;
  const current = await credentialRecord(ctx, wallet, 3);
  assert.equal(current.version, 0n, "Policy-3 credential already exists; duplicate issuance is refused.");
  const issuerRole = await read(ctx.client, registry, credentialIssuerRoleAbi, "ISSUER_ROLE");
  await requireRole(ctx.client, registry, issuerRole, ctx.issuer, "Credential issuer");
  const value = await readHiddenLine("Private test eligibility value (at least 1000; hidden input): ");
  assert.match(value, /^(0|[1-9][0-9]*)$/, "Private value must be an unsigned decimal integer.");
  assert.ok(BigInt(value) >= 1_000n, "Private test value must be at least policy-3 threshold 1000.");
  const expiresAt = (await chainTimestamp(ctx)) + BigInt(days * DAY);
  const salt = generateFieldSalt();
  const commitment = await computeEligibilityCommitment({
    subject: getAddress(wallet), privateValue: value, salt,
    policyId: 3n, policyVersion: 1n, threshold: 1_000n, credentialVersion: 1n,
    expiresAt, chainId: BigInt(CHAIN_ID), vault: ctx.addresses.LendingPoolV2,
  });
  const witness = {
    format: "robinhood-demo-credential-v1", wallet: getAddress(wallet), policyId: 3,
    commitment, privateValue: value, salt, expiresAt: Number(expiresAt),
  };
  const resolved = path.resolve(witnessPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
  assert.equal(fs.statSync(path.dirname(resolved)).mode & 0o077, 0, "Witness directory must be private (mode 0700 or stricter).");
  const fd = fs.openSync(resolved, "wx", 0o600);
  try { fs.writeFileSync(fd, `${JSON.stringify(witness, null, 2)}\n`, { encoding: "utf8" }); }
  finally { fs.closeSync(fd); }
  fs.chmodSync(resolved, 0o600);
  const mode = fs.statSync(resolved).mode & 0o777;
  assert.equal(mode & 0o077, 0, "Witness file permissions must exclude group and other users.");
  const args = [getAddress(wallet), 3n, commitment, expiresAt, 1n];
  const sim = await ctx.client.simulateContract({ account: ctx.issuer, address: registry, abi: credentialRegistryAbi, functionName: "recordCredential", args });
  const gas = await ctx.client.estimateContractGas({ account: ctx.issuer, address: registry, abi: credentialRegistryAbi, functionName: "recordCredential", args });
  pass("policy-3 issuance simulation", `issuer role confirmed · estimated ${gas.toString()} gas · no transaction submitted`);
  console.log(`Protected witness file: ${resolved} · mode 0600 · do not upload to a public location or paste into logs.`);
  console.log(`Next, simulate/submit the matching commitment with: bun run robinhood:bootstrap issue-lending ${JSON.stringify(resolved)} [write authorization flags]`);
  console.log("The witness is project-issued test data, not an official Dojang balance or attestation.");
  void sim;
}

async function actionIssueLending(witnessPath, options) {
  assert.ok(witnessPath, "Provide the protected policy-3 witness JSON path.");
  const resolved = path.resolve(witnessPath);
  const stat = fs.statSync(resolved);
  assert.equal(stat.mode & 0o077, 0, "Witness file must have mode 0600 or stricter before use.");
  const witness = parseDemoCredentialWitness(JSON.parse(fs.readFileSync(resolved, "utf8")));
  assert.equal(witness.format, "robinhood-demo-credential-v1");
  assert.equal(witness.policyId, 3);
  const ctx = await liveContext(); ctx.options = options;
  assert.equal(BigInt(witness.expiresAt) > await chainTimestamp(ctx), true, "Witness has expired.");
  const registry = ctx.addresses.RobinhoodDemoCredentialRegistry;
  const current = await credentialRecord(ctx, witness.wallet, 3);
  assert.equal(current.version, 0n, "Policy-3 credential already exists; duplicate issuance is refused.");
  const roleHash = await read(ctx.client, registry, credentialIssuerRoleAbi, "ISSUER_ROLE");
  await requireRole(ctx.client, registry, roleHash, ctx.issuer, "Credential issuer");
  const expectedCommitment = await computeEligibilityCommitment({
    subject: witness.wallet, privateValue: witness.privateValue, salt: witness.salt,
    policyId: 3n, policyVersion: 1n, threshold: 1_000n, credentialVersion: 1n,
    expiresAt: BigInt(witness.expiresAt), chainId: BigInt(CHAIN_ID), vault: ctx.addresses.LendingPoolV2,
  });
  assert.equal(expectedCommitment.toLowerCase(), witness.commitment.toLowerCase(), "Witness commitment does not match chain 46630, pool, policy 3, wallet, expiry, and version.");
  const args = [witness.wallet, 3n, witness.commitment, BigInt(witness.expiresAt), 1n];
  console.log(`Issuing only the public commitment for ${witness.wallet}. The private value and salt are never passed to the contract.`);
  await printAndMaybeSend(ctx, "issue-lending", ctx.issuer, registry, credentialRegistryAbi, "recordCredential", args, async () => {
    const after = await credentialRecord(ctx, witness.wallet, 3);
    assert.equal(after.wallet.toLowerCase(), witness.wallet.toLowerCase());
    assert.equal(after.commitment.toLowerCase(), witness.commitment.toLowerCase());
    assert.equal(after.issuer.toLowerCase(), ctx.issuer.toLowerCase());
    assert.equal(after.version, 1n); assert.equal(after.expiresAt, BigInt(witness.expiresAt)); assert.equal(after.revoked, false);
    return `policy 3 commitment recorded; private witness remains local at ${resolved}`;
  });
}

async function main() {
  const command = process.argv[2] || "help";
  const { positional, options } = readArgs(process.argv.slice(3));
  if (command === "help" || command === "--help") return usage();
  if (command === "status") return status();
  if (command === "plan") return plan();
  if (command === "price") {
    if (positional.length !== 2) throw new Error("Usage: price <rUSD2|rCOL2> <decimal-price>");
    return actionPrice(positional[0], positional[1], options);
  }
  if (command === "refresh-price") {
    if (positional.length !== 1) throw new Error("Usage: refresh-price <rUSD2|rCOL2>");
    return actionRefreshPrice(positional[0], options);
  }
  if (command === "mint") {
    if (positional.length !== 3) throw new Error("Usage: mint <rUSD2|rCOL2> <wallet> <decimal-amount>");
    return actionMint(positional[0], positional[1], positional[2], options);
  }
  if (command === "issue-dao") {
    if (positional.length < 1 || positional.length > 2) throw new Error("Usage: issue-dao <wallet> [expiry-days]");
    return actionIssueDao(positional[0], positional[1], options);
  }
  if (command === "prepare-lending") {
    if (positional.length !== 3) throw new Error("Usage: prepare-lending <wallet> <expiry-days> <witness-file>");
    return prepareLending(positional[0], positional[1], positional[2]);
  }
  if (command === "issue-lending") {
    if (positional.length !== 1) throw new Error("Usage: issue-lending <witness-file>");
    return actionIssueLending(positional[0], options);
  }
  if (command === "credential") {
    if (positional.length !== 2) throw new Error("Usage: credential <wallet> <3|4>");
    return showCredential(positional[0], positional[1]);
  }
  if (command === "participant") {
    if (positional.length !== 1) throw new Error("Usage: participant <wallet>");
    return showParticipant(positional[0]);
  }
  if (command === "proposal") {
    if (positional.length !== 1) throw new Error("Usage: proposal <proposal-id>");
    return showProposal(positional[0]);
  }
  usage();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`Robinhood bootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
