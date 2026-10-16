#!/usr/bin/env bun
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import {
  createPublicClient, decodeEventLog, defineChain, encodeFunctionData, getAddress, http,
  isAddress, keccak256, parseAbi, zeroAddress,
} from "viem";
import { computeEligibilityCommitment, generateFieldSalt } from "../src/lib/zk/commitment.ts";
import { parseDemoCredentialWitness } from "../src/lib/credential/witness.ts";
import { robinhoodMainnetDemoContracts as contracts, ROBINHOOD_MAINNET_CHAIN_ID as CHAIN_ID } from "../src/lib/config/robinhood-mainnet-demo.ts";

const ROOT = process.cwd();
const ARTIFACT = path.join(ROOT, "contracts/broadcast/DeployRobinhoodMainnetDemoStack.s.sol/4663/run-latest.json");
const EXPLORER = "https://robinhoodchain.blockscout.com";
const POLICY_ID = 3n;
const POLICY_VERSION = 1n;
const THRESHOLD = 1_000n;
const EXPECTED_MARKER = keccak256(new TextEncoder().encode("ROBINHOOD_MAINNET_CONTROLLED_DEMO_ASSET_V1")).slice(0, 10);
const AUTH = {
  price: "oracle-price",
  mint: "token-mint",
  "issue-lending": "credential-policy-3",
  "unpause-pool": "unpause-lending",
};
const poolAbi = parseAbi([
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)", "function RISK_ADMIN_ROLE() view returns (bytes32)",
  "function PAUSER_ROLE() view returns (bytes32)", "function DEMO_PARTICIPANT_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)", "function paused() view returns (bool)",
  "function demoOnly() view returns (bool)", "function isDemoParticipant(address) view returns (bool)",
  "function credentialRegistry() view returns (address)", "function eligibilityVerifier() view returns (address)",
  "function priceOracle() view returns (address)", "function demoLoanAsset() view returns (address)",
  "function demoCollateralAsset() view returns (address)", "function getReserveAssets() view returns (address[])",
  "function getReserveConfig(address) view returns ((uint256 supplyCap,uint256 borrowCap,uint256 collateralCap,uint256 minBorrowAmount,uint64 maxOracleAge,uint16 maxLtvBps,uint16 liquidationThresholdBps,uint16 liquidationBonusBps,uint16 closeFactorBps,uint16 reserveFactorBps,uint16 optimalUtilizationBps,uint16 baseBorrowRateBps,uint16 slope1Bps,uint16 slope2Bps,bool active,bool supplyEnabled,bool borrowEnabled,bool collateralEnabled))",
  "function pauseRisk()", "function unpauseRisk()",
]);
const tokenAbi = parseAbi([
  "function totalSupply() view returns (uint256)", "function mintCap() view returns (uint256)",
  "function decimals() view returns (uint8)", "function symbol() view returns (string)",
  "function demoOnly() view returns (bool)", "function controlledDemoAssetMarker() view returns (bytes4)",
  "function MINTER_ROLE() view returns (bytes32)", "function hasRole(bytes32,address) view returns (bool)",
  "function balanceOf(address) view returns (uint256)", "function mint(address,uint256)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);
const oracleAbi = parseAbi([
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)", "function PRICE_UPDATER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)", "function demoOnly() view returns (bool)",
  "function getPriceBounds(address) view returns (uint128 minimumPriceWad,uint128 maximumPriceWad,uint128 priceWad,uint64 updatedAt)",
  "function setPrice(address,uint128)",
]);
const registryAbi = parseAbi([
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)", "function ISSUER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)", "function demoOnly() view returns (bool)",
  "function getCredential(address,uint256) view returns ((address wallet,bytes32 commitment,address issuer,uint64 issuedAt,uint64 expiresAt,uint64 version,bool revoked))",
  "function recordCredential(address,uint256,bytes32,uint64,uint64) returns (uint64)",
]);
const adapterAbi = parseAbi(["function honkVerifier() view returns (address)"]);
const governanceAbi = parseAbi([
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)", "function PAUSER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)", "function paused() view returns (bool)",
  "function demoOnly() view returns (bool)", "function credentialRegistry() view returns (address)",
]);
const accessControlEventsAbi = parseAbi([
  "event RoleGranted(bytes32 indexed role,address indexed account,address indexed sender)",
  "event RoleRevoked(bytes32 indexed role,address indexed account,address indexed sender)",
]);
const eventsAbi = parseAbi(["event Transfer(address indexed from,address indexed to,uint256 value)"]);

export function isSplittableRangeError(error) {
  return /block range|too many results|result limit|response size|query returned|exceeds.*limit|maximum.*blocks/i.test(String(error?.shortMessage ?? error?.message ?? error));
}

export function assertPriceWithinBounds(price, minimum, maximum) {
  const value = BigInt(price), low = BigInt(minimum), high = BigInt(maximum);
  assert.ok(value > 0n && low > 0n && high >= low && value >= low && value <= high, "Price must be a positive WAD value inside the on-chain synthetic bounds.");
}

export function assertDistinctParticipants(values) {
  const normalized = values.map((value) => getAddress(value).toLowerCase());
  assert.equal(new Set(normalized).size, normalized.length, "The Mainnet demo participant addresses must be distinct.");
}

export function assertExactDemoParticipants(actual, expected) {
  const normalize = (items) => [...items].map((value) => getAddress(value).toLowerCase()).sort();
  assert.deepEqual(normalize(actual), normalize(expected), "The pool's current DEMO_PARTICIPANT_ROLE holders differ from the two configured participants.");
}

export function credentialIsActive(record, now) {
  return record.wallet !== zeroAddress && !record.revoked && record.issuedAt <= BigInt(now) && record.expiresAt > BigInt(now);
}

export function assertFreshSyntheticPrice({ price, updatedAt, now, maxAge }) {
  const value = BigInt(price), updated = BigInt(updatedAt), timestamp = BigInt(now), ageLimit = BigInt(maxAge);
  assert.ok(value > 0n && updated > 0n, "Synthetic oracle price is not seeded.");
  assert.ok(updated <= timestamp, "Synthetic oracle update timestamp is in the future.");
  assert.ok(ageLimit > 0n && timestamp - updated <= ageLimit, "Synthetic oracle price is stale for this reserve.");
}

export function assertMainnetActivationPrerequisites({ paused, credentialA, credentialB, now, loanPrice, collateralPrice, loanMaxAge, collateralMaxAge, loanBalanceA, loanBalanceB, collateralBalanceA, collateralBalanceB }) {
  assert.equal(paused, true, "Lending is already active; refusing a duplicate unpause request.");
  assert.ok(credentialIsActive(credentialA, now) && credentialIsActive(credentialB, now), "Both allowlisted participants need active project Policy 3 credentials before Lending activation.");
  assertFreshSyntheticPrice({ ...loanPrice, now, maxAge: loanMaxAge });
  assertFreshSyntheticPrice({ ...collateralPrice, now, maxAge: collateralMaxAge });
  for (const [label, balance] of [["Wallet A loan token", loanBalanceA], ["Wallet B loan token", loanBalanceB], ["Wallet A collateral token", collateralBalanceA], ["Wallet B collateral token", collateralBalanceB]]) {
    assert.ok(BigInt(balance) > 0n, `${label} must have its explicitly approved synthetic token allocation before activation.`);
  }
}

export function assertWriteAuthorization(options, expected) {
  assert.equal(options.authorization, expected, `Execution requires --authorize-mainnet-lending-write=${expected}.`);
}

function envAddress(name) {
  const value = process.env[name]?.trim();
  assert.ok(value && isAddress(value), `${name} is missing or invalid.`);
  return getAddress(value);
}

function rpc() {
  const url = process.env.RH_MAINNET_RPC_URL?.trim();
  assert.ok(url, "RH_MAINNET_RPC_URL is required; no network fallback is permitted.");
  const chain = defineChain({ id: CHAIN_ID, name: "Robinhood Chain Mainnet", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
  return { url, client: createPublicClient({ chain, transport: http(url, { timeout: 15_000, retryCount: 1 }) }) };
}

function roles() {
  const result = {
    deployer: envAddress("RH_MAINNET_DEPLOYER_ADDRESS"), admin: envAddress("RH_MAINNET_ADMIN_ADDRESS"),
    issuer: envAddress("RH_MAINNET_ISSUER_ADDRESS"), oracleUpdater: envAddress("RH_MAINNET_ORACLE_UPDATER_ADDRESS"),
    riskAdmin: envAddress("RH_MAINNET_RISK_ADMIN_ADDRESS"), pauseAuthority: envAddress("RH_MAINNET_PAUSE_AUTHORITY_ADDRESS"),
    minter: envAddress("RH_MAINNET_DEMO_MINTER_ADDRESS"), participantA: envAddress("RH_MAINNET_DEMO_PARTICIPANT_A_ADDRESS"),
    participantB: envAddress("RH_MAINNET_DEMO_PARTICIPANT_B_ADDRESS"),
  };
  assertDistinctParticipants(Object.values(result));
  return result;
}

function artifactReceipt(name, address) {
  assert.ok(fs.existsSync(ARTIFACT), "Missing Mainnet deployment artifact: contracts/broadcast/DeployRobinhoodMainnetDemoStack.s.sol/4663/run-latest.json");
  const file = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  assert.equal(Number(file.chain), CHAIN_ID, "Mainnet deployment artifact is not chain 4663.");
  const matches = (file.transactions ?? []).filter((item) => item.transactionType === "CREATE" && item.contractName === name);
  for (const tx of matches) {
    const receipt = (file.receipts ?? []).find((item) => item.transactionHash?.toLowerCase() === tx.hash?.toLowerCase());
    const created = receipt?.contractAddress ?? tx.contractAddress;
    if (created?.toLowerCase() === address.toLowerCase() && receipt?.status === "0x1") {
      return { hash: tx.hash, block: BigInt(receipt.blockNumber), address: getAddress(created) };
    }
  }
  throw new Error(`${name} has no successful receipt for the configured address in the chain-4663 artifact.`);
}

async function confirmedCode(client, item) {
  const receipt = await client.getTransactionReceipt({ hash: item.hash });
  assert.equal(receipt.status, "success", `Recorded deployment receipt is not successful: ${item.hash}`);
  assert.equal(receipt.contractAddress?.toLowerCase(), item.address.toLowerCase(), "Live receipt contract address differs from artifact.");
  const code = await client.getBytecode({ address: item.address });
  assert.ok(code && code !== "0x", `Runtime bytecode is absent at ${item.address}.`);
}

async function getContext() {
  const { url, client } = rpc();
  assert.equal(await client.getChainId(), CHAIN_ID, "Configured RPC is not Robinhood Mainnet chain 4663.");
  const configuredRoles = roles();
  const entries = {
    registry: artifactReceipt("RobinhoodMainnetDemoCredentialRegistry", contracts.credentialRegistry),
    oracle: artifactReceipt("RobinhoodMainnetDemoOracle", contracts.oracle),
    loan: artifactReceipt("RobinhoodMainnetDemoToken", contracts.loanToken),
    collateral: artifactReceipt("RobinhoodMainnetDemoToken", contracts.collateralToken),
    pool: artifactReceipt("RobinhoodMainnetDemoLendingPool", contracts.lendingPool),
    adapter: artifactReceipt("EligibilityVerifierAdapter", contracts.verifierAdapter),
    verifier: artifactReceipt("HonkVerifier", contracts.honkVerifier),
    transcript: artifactReceipt("ZKTranscriptLib", contracts.zkTranscriptLib),
    relations: artifactReceipt("RelationsLib", contracts.relationsLib),
    governance: artifactReceipt("RobinhoodMainnetDemoGovernancePhase1", contracts.governance),
  };
  await Promise.all(Object.values(entries).map((item) => confirmedCode(client, item)));
  const [poolRegistry, verifier, oracle, loan, collateral, poolDemo, registryDemo, oracleDemo, loanDemo, collDemo, loanMarker, collMarker, honk] = await Promise.all([
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "credentialRegistry" }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "eligibilityVerifier" }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "priceOracle" }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "demoLoanAsset" }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "demoCollateralAsset" }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "controlledDemoAssetMarker" }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "controlledDemoAssetMarker" }),
    client.readContract({ address: contracts.verifierAdapter, abi: adapterAbi, functionName: "honkVerifier" }),
  ]);
  assert.equal(poolRegistry.toLowerCase(), contracts.credentialRegistry.toLowerCase(), "Pool credential registry dependency mismatch.");
  assert.equal(verifier.toLowerCase(), contracts.verifierAdapter.toLowerCase(), "Pool verifier dependency mismatch.");
  assert.equal(oracle.toLowerCase(), contracts.oracle.toLowerCase(), "Pool oracle dependency mismatch.");
  assert.equal(loan.toLowerCase(), contracts.loanToken.toLowerCase(), "Pool loan token dependency mismatch.");
  assert.equal(collateral.toLowerCase(), contracts.collateralToken.toLowerCase(), "Pool collateral token dependency mismatch.");
  assert.equal(honk.toLowerCase(), contracts.honkVerifier.toLowerCase(), "Verifier adapter Honk dependency mismatch.");
  const [governanceRegistry, governanceDemo] = await Promise.all([
    client.readContract({ address: contracts.governance, abi: governanceAbi, functionName: "credentialRegistry" }),
    client.readContract({ address: contracts.governance, abi: governanceAbi, functionName: "demoOnly" }),
  ]);
  assert.equal(governanceRegistry.toLowerCase(), contracts.credentialRegistry.toLowerCase(), "Governance credential registry dependency mismatch.");
  assert.ok(poolDemo && registryDemo && oracleDemo && loanDemo && collDemo, "One or more Mainnet components lack demoOnly marker.");
  assert.ok(governanceDemo, "Mainnet governance lacks its demoOnly marker.");
  assert.equal(loanMarker.toLowerCase(), EXPECTED_MARKER.toLowerCase(), "Loan token demo marker mismatch.");
  assert.equal(collMarker.toLowerCase(), EXPECTED_MARKER.toLowerCase(), "Collateral token demo marker mismatch.");
  return { client, url, roles: configuredRoles, entries };
}

async function hasRole(client, target, abi, roleFunction, account) {
  const role = await client.readContract({ address: target, abi, functionName: roleFunction });
  return client.readContract({ address: target, abi, functionName: "hasRole", args: [role, account] });
}

async function readDemoParticipantHolders(ctx) {
  const role = await ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "DEMO_PARTICIPANT_ROLE" });
  const head = await ctx.client.getBlockNumber();
  const events = [];
  let queryCount = 0;
  async function readEventRange(event, fromBlock, toBlock) {
    queryCount += 1;
    assert.ok(queryCount <= 8192, "Demo participant role history exceeded its bounded 8192-query budget.");
    try {
      return await ctx.client.getLogs({ address: contracts.lendingPool, event, args: { role }, fromBlock, toBlock });
    } catch (error) {
      if (!isSplittableRangeError(error) || fromBlock >= toBlock) throw error;
      const middle = fromBlock + (toBlock - fromBlock) / 2n;
      return [...await readEventRange(event, fromBlock, middle), ...await readEventRange(event, middle + 1n, toBlock)];
    }
  }
  for (let from = ctx.entries.pool.block; from <= head; from += 20_000n) {
    const to = from + 19_999n > head ? head : from + 19_999n;
    const [granted, revoked] = await Promise.all([
      readEventRange(accessControlEventsAbi[0], from, to),
      readEventRange(accessControlEventsAbi[1], from, to),
    ]);
    events.push(...granted, ...revoked);
  }
  events.sort((a, b) => a.blockNumber === b.blockNumber
    ? Number(a.logIndex ?? 0n) - Number(b.logIndex ?? 0n)
    : a.blockNumber < b.blockNumber ? -1 : 1);
  const holders = new Set();
  for (const event of events) {
    const account = event.args.account.toLowerCase();
    if (event.eventName === "RoleGranted") holders.add(account);
    else holders.delete(account);
  }
  return { holders: [...holders], head, queryCount };
}

async function showStatus(ctx) {
  const { client, roles: r } = ctx;
  const participantHistory = await readDemoParticipantHolders(ctx);
  assertExactDemoParticipants(participantHistory.holders, [r.participantA, r.participantB]);
  const [paused, governancePaused, assets, loanSupply, loanCap, loanDecimals, loanSymbol, collSupply, collCap, collDecimals, collSymbol,
    loanPoolBalance, collateralPoolBalance, loanBounds, collBounds, loanConfig, collConfig, adminPool, riskAdmin, pauser, participantA, participantB,
    registryAdmin, issuer, oracleAdmin, updater, minterLoan, minterColl, governanceAdmin, governancePauser,
    credentialA, credentialB, now] = await Promise.all([
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "paused" }),
    client.readContract({ address: contracts.governance, abi: governanceAbi, functionName: "paused" }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "getReserveAssets" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "totalSupply" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "mintCap" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "decimals" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "symbol" }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "totalSupply" }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "mintCap" }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "decimals" }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "symbol" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "balanceOf", args: [contracts.lendingPool] }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "balanceOf", args: [contracts.lendingPool] }),
    client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [contracts.loanToken] }),
    client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [contracts.collateralToken] }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "getReserveConfig", args: [contracts.loanToken] }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "getReserveConfig", args: [contracts.collateralToken] }),
    hasRole(client, contracts.lendingPool, poolAbi, "DEFAULT_ADMIN_ROLE", r.admin),
    hasRole(client, contracts.lendingPool, poolAbi, "RISK_ADMIN_ROLE", r.riskAdmin),
    hasRole(client, contracts.lendingPool, poolAbi, "PAUSER_ROLE", r.pauseAuthority),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [r.participantA] }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [r.participantB] }),
    hasRole(client, contracts.credentialRegistry, registryAbi, "DEFAULT_ADMIN_ROLE", r.admin),
    hasRole(client, contracts.credentialRegistry, registryAbi, "ISSUER_ROLE", r.issuer),
    hasRole(client, contracts.oracle, oracleAbi, "DEFAULT_ADMIN_ROLE", r.admin),
    hasRole(client, contracts.oracle, oracleAbi, "PRICE_UPDATER_ROLE", r.oracleUpdater),
    hasRole(client, contracts.loanToken, tokenAbi, "MINTER_ROLE", r.minter),
    hasRole(client, contracts.collateralToken, tokenAbi, "MINTER_ROLE", r.minter),
    hasRole(client, contracts.governance, governanceAbi, "DEFAULT_ADMIN_ROLE", r.admin),
    hasRole(client, contracts.governance, governanceAbi, "PAUSER_ROLE", r.pauseAuthority),
    client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [r.participantA, POLICY_ID] }),
    client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [r.participantB, POLICY_ID] }),
    client.getBlock({ blockTag: "latest" }),
  ]);
  assert.equal(assets.length, 2, "Pool must contain exactly the two controlled demo reserves.");
  assert.ok(assets.some((asset) => asset.toLowerCase() === contracts.loanToken.toLowerCase()) && assets.some((asset) => asset.toLowerCase() === contracts.collateralToken.toLowerCase()), "Pool reserves do not match the receipt-derived Mainnet synthetic token pair.");
  const roleRows = [adminPool, riskAdmin, pauser, registryAdmin, issuer, oracleAdmin, updater, minterLoan, minterColl, governanceAdmin, governancePauser];
  assert.ok(roleRows.every(Boolean), "One or more configured operator addresses do not hold their expected on-chain role.");
  assert.ok(participantA && participantB, "Both configured participants must have the pool's on-chain DEMO_PARTICIPANT_ROLE.");
  for (const [label, token, supply, cap, decimals, symbol] of [
    ["Loan", contracts.loanToken, loanSupply, loanCap, loanDecimals, loanSymbol],
    ["Collateral", contracts.collateralToken, collSupply, collCap, collDecimals, collSymbol],
  ]) {
    assert.ok(supply <= cap, `${label} token supply exceeds its immutable mint cap.`);
    console.log(`${label} ${symbol} · ${decimals} decimals · supply ${supply}/${cap} base units`);
  }
  console.log(`Robinhood Mainnet ${CHAIN_ID} · live block ${now.number} · pool ${contracts.lendingPool} · ${paused ? "PAUSED" : "ACTIVE"} · Phase 1 Governance ${governancePaused ? "PAUSED" : "ACTIVE"}`);
  console.log(`Receipts and bytecode: 10/10 live-checked · dependencies and demo markers verified · no Testnet address fallback.`);
  console.log(`Participants: A ${r.participantA} ${participantA ? "ALLOWLISTED" : "BLOCKED"} · B ${r.participantB} ${participantB ? "ALLOWLISTED" : "BLOCKED"}`);
  console.log(`Complete participant-role history: exactly the configured two wallets through block ${participantHistory.head} · ${participantHistory.queryCount} bounded queries.`);
  console.log(`Roles: admin/pool=${adminPool} risk-admin=${riskAdmin} pause-authority=${pauser} issuer=${issuer} oracle-updater=${updater} minter=${minterLoan && minterColl} governance-admin=${governanceAdmin} governance-pauser=${governancePauser}`);
  const freshness = (price, updatedAt, maxAge) => price === 0n || updatedAt === 0n ? "UNSEEDED" : updatedAt > now.timestamp ? "INVALID FUTURE TIMESTAMP" : now.timestamp - updatedAt > maxAge ? `STALE (${now.timestamp - updatedAt}s; max ${maxAge}s)` : `FRESH (${now.timestamp - updatedAt}s old)`;
  console.log(`Oracle loan bounds ${loanBounds.minimumPriceWad}..${loanBounds.maximumPriceWad} WAD · ${loanBounds.priceWad === 0n ? "UNSEEDED" : `price ${loanBounds.priceWad} WAD · ${freshness(loanBounds.priceWad, loanBounds.updatedAt, loanConfig.maxOracleAge)}`}`);
  console.log(`Oracle collateral bounds ${collBounds.minimumPriceWad}..${collBounds.maximumPriceWad} WAD · ${collBounds.priceWad === 0n ? "UNSEEDED" : `price ${collBounds.priceWad} WAD · ${freshness(collBounds.priceWad, collBounds.updatedAt, collConfig.maxOracleAge)}`}`);
  console.log(`Actual pool token balances: loan ${loanPoolBalance} · collateral ${collateralPoolBalance} base units.`);
  console.log(`Loan reserve: active=${loanConfig.active} supply=${loanConfig.supplyEnabled} borrow=${loanConfig.borrowEnabled} caps=${loanConfig.supplyCap}/${loanConfig.borrowCap} · collateral reserve: active=${collConfig.active} accepted=${collConfig.collateralEnabled} cap=${collConfig.collateralCap}`);
  for (const [label, credential] of [["A", credentialA], ["B", credentialB]]) {
    const current = credentialIsActive(credential, now.timestamp);
    console.log(`Policy 3 ${label}: ${current ? `credential active · version ${credential.version} · expires ${credential.expiresAt}` : "no active project credential"}`);
  }
  if (paused) console.log("Risk-increasing Lending is paused. This command did not request an oracle write, mint, credential, or unpause.");
}

function participantAddress(value, r) {
  assert.ok(value && isAddress(value), "Provide a valid participant wallet address.");
  const address = getAddress(value);
  assert.ok([r.participantA, r.participantB].some((wallet) => wallet.toLowerCase() === address.toLowerCase()), "Recipient is not one of the two configured Mainnet demo participants.");
  return address;
}

async function getCompleteMintHistory(ctx, token, recipient, fromBlock) {
  let queries = 0;
  async function scan(from, to) {
    queries += 1;
    assert.ok(queries <= 4096, "Mint audit exceeded its bounded 4096-query limit.");
    try {
      return await ctx.client.getLogs({ address: token, event: eventsAbi[0], args: { from: zeroAddress, to: recipient }, fromBlock: from, toBlock: to });
    } catch (error) {
      if (!isSplittableRangeError(error) || from >= to) throw error;
      const middle = from + (to - from) / 2n;
      return [...await scan(from, middle), ...await scan(middle + 1n, to)];
    }
  }
  const head = await ctx.client.getBlockNumber();
  const logs = await scan(fromBlock, head);
  return { count: logs.length, head, queries };
}

function writePrivate(file, value) {
  const absolute = path.resolve(file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true, mode: 0o700 });
  const fd = fs.openSync(absolute, "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); } finally { fs.closeSync(fd); }
  return absolute;
}

function secureRead(file) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), "Witness must be a regular file, not a symlink.");
  assert.equal(stat.mode & 0o077, 0, "Witness file must be private (mode 0600 or stricter).");
  assert.ok(stat.size <= 16_384, "Witness file exceeds the supported size limit.");
  return parseDemoCredentialWitness(JSON.parse(fs.readFileSync(absolute, "utf8")));
}

async function hiddenPrompt(label) {
  assert.ok(process.stdin.isTTY && process.stdin.setRawMode, "Private value input requires a local interactive terminal.");
  process.stdout.write(label);
  return new Promise((resolve, reject) => {
    let value = "";
    const input = process.stdin;
    const finish = (error) => {
      input.setRawMode(false);
      input.pause();
      input.off("data", onData);
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const onData = (buffer) => {
      for (const byte of buffer) {
        if (byte === 3) return finish(new Error("Input cancelled."));
        if (byte === 13 || byte === 10) return finish();
        if (byte === 8 || byte === 127) value = value.slice(0, -1);
        else if (byte >= 48 && byte <= 57 && value.length < 20) value += String.fromCharCode(byte);
      }
    };
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function prepareCredential(ctx, walletText, daysText, output) {
  const wallet = participantAddress(walletText, ctx.roles);
  const days = Number(daysText);
  assert.ok(Number.isInteger(days) && days >= 1 && days <= 90, "Expiry must be 1–90 days.");
  assert.ok(output, "Provide a private witness output path.");
  const participant = await ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [wallet] });
  assert.ok(participant, "Wallet is not an on-chain Mainnet demo participant.");
  const [current, block] = await Promise.all([
    ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [wallet, POLICY_ID] }),
    ctx.client.getBlock({ blockTag: "latest" }),
  ]);
  assert.ok(current.wallet === zeroAddress || current.revoked || current.expiresAt <= block.timestamp, "An active Policy 3 credential already exists; refusing accidental replacement.");
  const privateValue = await hiddenPrompt("Enter the project test eligibility value (input hidden): ");
  assert.ok(/^(0|[1-9][0-9]*)$/.test(privateValue) && BigInt(privateValue) >= THRESHOLD && BigInt(privateValue) <= (1n << 64n) - 1n, "Value must meet Policy 3 and fit uint64.");
  const version = current.wallet === zeroAddress ? 1n : current.version + 1n;
  const expiresAt = block.timestamp + BigInt(days * 86_400);
  const salt = generateFieldSalt();
  const commitment = await computeEligibilityCommitment({ subject: wallet, privateValue, salt, policyId: POLICY_ID, policyVersion: POLICY_VERSION,
    threshold: THRESHOLD, credentialVersion: version, expiresAt, chainId: BigInt(CHAIN_ID), vault: contracts.lendingPool });
  const file = writePrivate(output, { format: "robinhood-demo-credential-v1", wallet, policyId: Number(POLICY_ID), commitment,
    privateValue, salt, expiresAt: Number(expiresAt) });
  console.log(`Prepared private Mainnet Policy 3 witness for ${wallet} · version ${version} · expiry ${expiresAt}.`);
  console.log(`Witness saved mode 0600: ${file}. Private value, salt, and witness content were not printed.`);
  console.log(`Next read-only command: bun run robinhood:mainnet:lending:operator issue-lending ${JSON.stringify(file)}`);
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return await rl.question(question); } finally { rl.close(); }
}

async function writeGuarded(ctx, command, actor, target, abi, functionName, args, options, confirm) {
  const request = { account: actor, address: target, abi, functionName, args };
  await ctx.client.simulateContract(request);
  const gas = await ctx.client.estimateContractGas(request);
  console.log(`PASS read-only simulation: ${functionName} · chain ${CHAIN_ID} · estimated gas ${gas}.`);
  if (!options.execute) return console.log("Simulation only. No Mainnet signature or transaction was requested.");
  assertWriteAuthorization(options, AUTH[command]);
  const alias = options.accountAlias ?? process.env.RH_MAINNET_ACCOUNT;
  assert.ok(alias && /^[A-Za-z0-9._-]+$/.test(alias) && process.stdin.isTTY, "Execution needs an interactive terminal and encrypted Foundry keystore alias.");
  const signer = spawnSync("cast", ["wallet", "address", "--account", alias], { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });
  assert.equal(signer.status, 0, "Could not unlock encrypted Foundry keystore to verify its public role address.");
  const derived = signer.stdout.match(/0x[a-fA-F0-9]{40}/g) ?? [];
  assert.ok(derived.some((address) => getAddress(address).toLowerCase() === actor.toLowerCase()), "Encrypted keystore alias does not match the required on-chain role address.");
  const phrase = `WRITE Robinhood Mainnet ${AUTH[command]}`;
  assert.equal(await prompt(`Type exactly “${phrase}” to sign and submit: `), phrase, "Final typed authorization did not match.");
  const data = encodeFunctionData({ abi, functionName, args });
  const child = spawn("cast", ["send", "--rpc-url", ctx.url, "--chain", String(CHAIN_ID), "--account", alias, "--async", "--data", data, target], { stdio: ["inherit", "pipe", "inherit"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  const exit = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  assert.equal(exit, 0, "cast send failed before returning a transaction hash.");
  const hash = output.match(/0x[a-fA-F0-9]{64}/)?.[0];
  assert.ok(hash, "No transaction hash returned.");
  const receipt = await ctx.client.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success", `Transaction receipt failed: ${hash}`);
  assert.equal(await confirm(), true, "Receipt succeeded but post-transaction state did not match the requested operation.");
  console.log(`CONFIRMED ${hash}\n${EXPLORER}/tx/${hash}`);
}

async function main() {
  const command = process.argv[2] ?? "help";
  const positional = [], options = {};
  for (let i = 3; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === "--execute") options.execute = true;
    else if (arg.startsWith("--authorize-mainnet-lending-write=")) options.authorization = arg.split("=")[1];
    else if (arg === "--account-alias") options.accountAlias = process.argv[++i];
    else if (arg.startsWith("--account-alias=")) options.accountAlias = arg.split("=")[1];
    else positional.push(arg);
  }
  if (["help", "--help"].includes(command)) {
    console.log("Read-only: status | prepare-lending <participant> <expiry-days> <private-witness.json>. Simulated by default: price loan|collateral <price-wad> | mint loan|collateral <participant> <base-units> | issue-lending <private-witness.json> | unpause-pool.\n\nEvery write simulates first. Public Mainnet writes require --execute, exact --authorize-mainnet-lending-write=<label>, an encrypted Foundry keystore alias matching the required role, and an interactive typed confirmation. No operation grants roles, deploys, or initializes reserve configuration.");
    return;
  }
  const ctx = await getContext();
  if (command === "status") return showStatus(ctx);
  if (command === "prepare-lending") return prepareCredential(ctx, positional[0], positional[1], positional[2]);
  if (command === "price") {
    assert.ok(["loan", "collateral"].includes(positional[0]) && /^\d+$/.test(positional[1] ?? ""), "Use price loan|collateral <price-in-WAD-base-units>.");
    const asset = positional[0] === "loan" ? contracts.loanToken : contracts.collateralToken;
    const price = BigInt(positional[1]);
    const [bounds] = await Promise.all([ctx.client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [asset] })]);
    assertPriceWithinBounds(price, bounds.minimumPriceWad, bounds.maximumPriceWad);
    const role = await ctx.client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "PRICE_UPDATER_ROLE" });
    const updater = ctx.roles.oracleUpdater;
    assert.equal(await ctx.client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "hasRole", args: [role, updater] }), true, "Configured oracle updater lacks its on-chain role.");
    const before = bounds.priceWad;
    if (before === price) return console.log("SKIPPED — requested synthetic price already matches on-chain state.");
    return writeGuarded(ctx, command, updater, contracts.oracle, oracleAbi, "setPrice", [asset, price], options,
      async () => (await ctx.client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [asset] })).priceWad === price);
  }
  if (command === "mint") {
    assert.ok(["loan", "collateral"].includes(positional[0]) && /^\d+$/.test(positional[2] ?? ""), "Use mint loan|collateral <participant> <amount-in-base-units>.");
    const recipient = participantAddress(positional[1], ctx.roles), amount = BigInt(positional[2]);
    assert.ok(amount > 0n, "Mint amount must be greater than zero.");
    const token = positional[0] === "loan" ? contracts.loanToken : contracts.collateralToken;
    const entry = positional[0] === "loan" ? ctx.entries.loan : ctx.entries.collateral;
    const [supply, cap, balance, maxSingleMint] = await Promise.all([
      ctx.client.readContract({ address: token, abi: tokenAbi, functionName: "totalSupply" }),
      ctx.client.readContract({ address: token, abi: tokenAbi, functionName: "mintCap" }),
      ctx.client.readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [recipient] }),
      Promise.resolve(process.env[positional[0] === "loan" ? "RH_MAINNET_DEMO_SINGLE_MINT_LIMIT_LOAN" : "RH_MAINNET_DEMO_SINGLE_MINT_LIMIT_COLLATERAL"]),
    ]);
    assert.ok(maxSingleMint && /^\d+$/.test(maxSingleMint), `Set the owner-approved ${positional[0] === "loan" ? "RH_MAINNET_DEMO_SINGLE_MINT_LIMIT_LOAN" : "RH_MAINNET_DEMO_SINGLE_MINT_LIMIT_COLLATERAL"} in local configuration before mint simulation.`);
    assert.ok(amount <= BigInt(maxSingleMint), "Mint exceeds the owner-approved single-transaction allocation limit.");
    assert.ok(supply + amount <= cap, "Mint would exceed the immutable total supply cap.");
    assert.equal(balance, 0n, "Recipient already has a token balance; duplicate-safe mint is refused.");
    const history = await getCompleteMintHistory(ctx, token, recipient, entry.block);
    assert.equal(history.count, 0, `Recipient has ${history.count} historical mint event(s); refusing duplicate mint.`);
    console.log(`Complete mint-history scan: no prior mint to recipient · ${history.queries} bounded RPC query(ies) · through block ${history.head}.`);
    const minterRole = await ctx.client.readContract({ address: token, abi: tokenAbi, functionName: "MINTER_ROLE" });
    assert.equal(await ctx.client.readContract({ address: token, abi: tokenAbi, functionName: "hasRole", args: [minterRole, ctx.roles.minter] }), true, "Configured minter lacks the on-chain role.");
    return writeGuarded(ctx, command, ctx.roles.minter, token, tokenAbi, "mint", [recipient, amount], options,
      async () => (await ctx.client.readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [recipient] })) === amount);
  }
  if (command === "issue-lending") {
    assert.ok(positional[0], "Use issue-lending <private-policy-3-witness.json>.");
    const witness = secureRead(positional[0]);
    assert.equal(witness.format, "robinhood-demo-credential-v1", "Witness must use the Robinhood project credential format.");
    assert.equal(witness.policyId, Number(POLICY_ID), "Witness must be Policy 3.");
    assert.ok([ctx.roles.participantA, ctx.roles.participantB].some((wallet) => wallet.toLowerCase() === witness.wallet.toLowerCase()), "Witness wallet is not one of the configured demo participants.");
    const [current, block, role] = await Promise.all([
      ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [witness.wallet, POLICY_ID] }),
      ctx.client.getBlock({ blockTag: "latest" }),
      ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "ISSUER_ROLE" }),
    ]);
    assert.ok(!credentialIsActive(current, block.timestamp), "An active Policy 3 credential already exists; refusing duplicate or unapproved replacement.");
    const version = current.wallet === zeroAddress ? 1n : current.version + 1n;
    assert.equal(witness.expiresAt > Number(block.timestamp), true, "Witness is expired or not yet valid.");
    const commitment = await computeEligibilityCommitment({ subject: witness.wallet, privateValue: witness.privateValue, salt: witness.salt,
      policyId: POLICY_ID, policyVersion: POLICY_VERSION, threshold: THRESHOLD, credentialVersion: version,
      expiresAt: BigInt(witness.expiresAt), chainId: BigInt(CHAIN_ID), vault: contracts.lendingPool });
    assert.equal(commitment.toLowerCase(), witness.commitment.toLowerCase(), "Witness commitment does not match the Mainnet chain and Lending pool.");
    assert.equal(await ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "hasRole", args: [role, ctx.roles.issuer] }), true, "Configured issuer lacks the on-chain credential role.");
    const args = [witness.wallet, POLICY_ID, witness.commitment, BigInt(witness.expiresAt), version];
    return writeGuarded(ctx, command, ctx.roles.issuer, contracts.credentialRegistry, registryAbi, "recordCredential", args, options,
      async () => {
        const after = await ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [witness.wallet, POLICY_ID] });
        return after.version === version && after.commitment.toLowerCase() === witness.commitment.toLowerCase() && !after.revoked;
      });
  }
  if (command === "unpause-pool") {
    const r = ctx.roles;
    const participantHistory = await readDemoParticipantHolders(ctx);
    assertExactDemoParticipants(participantHistory.holders, [r.participantA, r.participantB]);
    const [paused, latest, credentialA, credentialB, loanBounds, collateralBounds, loanConfig, collateralConfig,
      loanBalanceA, loanBalanceB, collateralBalanceA, collateralBalanceB, allowedA, allowedB] = await Promise.all([
      ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "paused" }),
      ctx.client.getBlock({ blockTag: "latest" }),
      ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [r.participantA, POLICY_ID] }),
      ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [r.participantB, POLICY_ID] }),
      ctx.client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [contracts.loanToken] }),
      ctx.client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [contracts.collateralToken] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "getReserveConfig", args: [contracts.loanToken] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "getReserveConfig", args: [contracts.collateralToken] }),
      ctx.client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "balanceOf", args: [r.participantA] }),
      ctx.client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "balanceOf", args: [r.participantB] }),
      ctx.client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "balanceOf", args: [r.participantA] }),
      ctx.client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "balanceOf", args: [r.participantB] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [r.participantA] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [r.participantB] }),
    ]);
    assert.ok(allowedA && allowedB, "Both configured participants must remain allowlisted immediately before unpause.");
    assert.ok(loanConfig.active && loanConfig.supplyEnabled && loanConfig.borrowEnabled, "The loan reserve is not configured for the intended demo journey.");
    assert.ok(collateralConfig.active && collateralConfig.collateralEnabled, "The collateral reserve is not configured for the intended demo journey.");
    assertMainnetActivationPrerequisites({ paused, now: latest.timestamp, credentialA, credentialB,
      loanPrice: { price: loanBounds.priceWad, updatedAt: loanBounds.updatedAt },
      collateralPrice: { price: collateralBounds.priceWad, updatedAt: collateralBounds.updatedAt },
      loanMaxAge: loanConfig.maxOracleAge, collateralMaxAge: collateralConfig.maxOracleAge,
      loanBalanceA, loanBalanceB, collateralBalanceA, collateralBalanceB });
    assert.equal(await hasRole(ctx.client, contracts.lendingPool, poolAbi, "PAUSER_ROLE", ctx.roles.pauseAuthority), true, "Configured pause authority lacks pool PAUSER_ROLE.");
    return writeGuarded(ctx, command, ctx.roles.pauseAuthority, contracts.lendingPool, poolAbi, "unpauseRisk", [], options,
      async () => (await ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "paused" })) === false);
  }
  throw new Error(`Unknown Mainnet Lending operator command: ${command}`);
}

if (import.meta.main) main().catch((error) => {
  const message = String(error?.shortMessage ?? error?.message ?? error);
  const rpcUrl = process.env.RH_MAINNET_RPC_URL?.trim();
  console.error("Mainnet Lending operator stopped: " + (rpcUrl ? message.replaceAll(rpcUrl, "<configured Mainnet RPC>") : message));
  process.exitCode = 1;
});
