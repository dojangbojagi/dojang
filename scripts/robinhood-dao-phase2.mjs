#!/usr/bin/env bun
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  toBytes,
} from "viem";
import {
  credentialIssuerRoleAbi,
  credentialRegistryAbi,
  lendingPoolV2Abi,
  robinhoodGovernancePhase2Abi,
  robinhoodLendingReputationAbi,
} from "../src/lib/contracts/abis.ts";
import { computeEligibilityCommitment, generateFieldSalt } from "../src/lib/zk/commitment.ts";
import { parseDemoCredentialWitness } from "../src/lib/credential/witness.ts";

const ROOT = process.cwd();
const CHAIN_ID = 46_630;
const POLICY_ID = 5n;
const POLICY_VERSION = 1n;
const ARTIFACT = path.join(ROOT, "contracts/broadcast/DeployRobinhoodProtocolStack.s.sol/46630/run-latest.json");
const EXPLORER = "https://explorer.testnet.chain.robinhood.com";
const authLabels = {
  "issue-reputation": "phase2-reputation",
  "issue-credential": "phase2-credential",
  unpause: "phase2-unpause",
};

export function scoreLendingEvidence(metrics) {
  const participated = metrics.supplyActions + metrics.collateralActions + metrics.borrowActions + metrics.repaymentActions > 0;
  return Math.max(
    0,
    (participated ? 1 : 0)
      + (metrics.borrowActions > 0 ? 1 : 0)
      + (metrics.fullRepayments > 0 ? 2 : 0)
      - (metrics.liquidations > 0 ? 2 : 0),
  );
}

export function assertObservedRangeBeforeBlock(observedFromBlock, observedToBlock, l2BlockNumber) {
  const from = BigInt(observedFromBlock);
  const to = BigInt(observedToBlock);
  const at = BigInt(l2BlockNumber);
  assert.ok(from <= to, "Evidence observedFromBlock must not exceed observedToBlock.");
  assert.ok(to < at, "Evidence observedToBlock must be strictly before the pinned L2 simulation block.");
}

function usage() {
  console.log(`GYEVO DAO Phase 2 operator — Robinhood Testnet ${CHAIN_ID}\n\nRead-only/local:\n  bun run robinhood:dao2 status [wallet]\n  bun run robinhood:dao2 evidence <wallet> [evidence-file]\n  bun run robinhood:dao2 prepare-membership <wallet> <expiry-days> <witness-file>\n\nGuarded writes (simulation unless both execution flags are present):\n  bun run robinhood:dao2 unpause <reputation|governance>\n  bun run robinhood:dao2 issue-reputation <witness-file> <evidence-file>\n  bun run robinhood:dao2 issue-credential <witness-file>\n\nExecution flags:\n  --execute --authorize-public-testnet-write=<phase2-unpause|phase2-reputation|phase2-credential> --account-alias <Foundry alias>\n\nThis CLI never deploys, votes, or reads private keys. Witness contents are never printed.`);
}

function parseArgs(values) {
  const positional = [];
  const options = {};
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === "--execute") options.execute = true;
    else if (value.startsWith("--authorize-public-testnet-write=")) options.authorization = value.split("=")[1];
    else if (value === "--account-alias") options.accountAlias = values[++i];
    else if (value.startsWith("--account-alias=")) options.accountAlias = value.split("=")[1];
    else positional.push(value);
  }
  return { positional, options };
}

function requiredAddress(name) {
  const value = process.env[name];
  assert.ok(value && isAddress(value), `${name} is missing or invalid.`);
  return getAddress(value);
}

function sameAddress(left, right) {
  return left.toLowerCase() === right.toLowerCase();
}

function deploymentBlockAndPool() {
  assert.ok(fs.existsSync(ARTIFACT), `Missing confirmed Testnet artifact ${ARTIFACT}.`);
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  assert.equal(Number(artifact.chain), CHAIN_ID, "Deployment artifact is not chain 46630.");
  const deployment = artifact.transactions.find((entry) => entry.transactionType === "CREATE" && entry.contractName === "LendingPoolV2");
  assert.ok(deployment, "Deployment artifact has no LendingPoolV2 creation.");
  const receipt = artifact.receipts.find((entry) => entry.transactionHash.toLowerCase() === deployment.hash.toLowerCase());
  assert.ok(receipt?.blockNumber && receipt.status === "0x1", "LendingPoolV2 creation receipt is missing or unsuccessful.");
  const address = getAddress(receipt.contractAddress ?? deployment.contractAddress);
  return { blockNumber: BigInt(receipt.blockNumber), address };
}

async function context(requirePhase2 = true) {
  const rpcUrl = process.env.RH_TESTNET_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL || "https://rpc.testnet.chain.robinhood.com";
  const chain = defineChain({
    id: CHAIN_ID,
    name: "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 30_000, retryCount: 2 }) });
  assert.equal(await client.getChainId(), CHAIN_ID, "Configured RPC is not Robinhood Testnet 46630.");
  const lending = deploymentBlockAndPool();
  const configuredPool = requiredAddress("RH_TESTNET_LENDING_V2_POOL_ADDRESS");
  assert.ok(sameAddress(lending.address, configuredPool), "Configured Lending V2 pool differs from its confirmed deployment receipt.");
  const base = { client, rpcUrl, lendingPool: lending.address, lendingDeploymentBlock: lending.blockNumber };
  if (!requirePhase2) return base;
  const governance = requiredAddress("RH_TESTNET_PHASE2_GOVERNANCE_ADDRESS");
  const reputation = requiredAddress("RH_TESTNET_PHASE2_REPUTATION_REGISTRY_ADDRESS");
  const credentialRegistry = requiredAddress("RH_TESTNET_CREDENTIAL_REGISTRY_ADDRESS");
  const verifier = requiredAddress("RH_TESTNET_VERIFIER_ADAPTER_ADDRESS");
  const codes = await Promise.all([governance, reputation, credentialRegistry, verifier].map((address) => client.getBytecode({ address })));
  assert.ok(codes.every((code) => code && code !== "0x"), "A configured Phase 2 dependency has no live bytecode.");
  const [actualRegistry, actualReputation, actualVerifier, actualPool] = await Promise.all([
    client.readContract({ address: governance, abi: robinhoodGovernancePhase2Abi, functionName: "credentialRegistry" }),
    client.readContract({ address: governance, abi: robinhoodGovernancePhase2Abi, functionName: "reputationRegistry" }),
    client.readContract({ address: governance, abi: robinhoodGovernancePhase2Abi, functionName: "eligibilityVerifier" }),
    client.readContract({ address: reputation, abi: robinhoodLendingReputationAbi, functionName: "lendingPool" }),
  ]);
  assert.ok(sameAddress(actualRegistry, credentialRegistry), "Phase 2 credential registry mismatch.");
  assert.ok(sameAddress(actualReputation, reputation), "Phase 2 reputation registry mismatch.");
  assert.ok(sameAddress(actualVerifier, verifier), "Phase 2 verifier mismatch.");
  assert.ok(sameAddress(actualPool, lending.address), "Phase 2 reputation source is not the confirmed Lending V2 pool.");
  return { ...base, governance, reputation, credentialRegistry, verifier };
}

async function completeLendingEvidence(ctx, wallet, requestedToBlock) {
  const initialHead = await ctx.client.getBlockNumber();
  assert.ok(initialHead > ctx.lendingDeploymentBlock + 5n, "The Lending V2 deployment has insufficient finalized history.");
  const initialFinalizedHead = initialHead - 5n;
  const toBlock = requestedToBlock === undefined ? initialFinalizedHead : BigInt(requestedToBlock);
  assert.ok(toBlock >= ctx.lendingDeploymentBlock, "Evidence ends before the Lending V2 deployment block.");
  assert.ok(toBlock <= initialFinalizedHead, "Evidence includes blocks that have not reached the required finality depth.");
  // Pin reads and simulation to one L2 block. The reputation contract validates
  // evidence ranges with ArbSys.arbBlockNumber(), which uses the same L2 domain.
  const simulationBlockNumber = await ctx.client.getBlockNumber();
  assert.ok(simulationBlockNumber > 5n, "Robinhood RPC returned an invalid simulation block.");
  assert.ok(toBlock <= simulationBlockNumber - 5n, "Evidence range is not finalized at the current RPC head.");
  assertObservedRangeBeforeBlock(ctx.lendingDeploymentBlock, toBlock, simulationBlockNumber);
  const metrics = {
    supplyActions: 0,
    collateralActions: 0,
    borrowActions: 0,
    repaymentActions: 0,
    fullRepayments: 0,
    liquidations: 0,
  };
  let inspectedLogs = 0;
  const chunk = 20_000n;
  let queries = 0;
  async function readRange(fromBlock, toBlock) {
    queries += 1;
    assert.ok(queries <= 4_096, "Evidence scan exceeded its bounded query limit.");
    try {
      return await ctx.client.getLogs({ address: ctx.lendingPool, fromBlock, toBlock });
    } catch (error) {
      const width = toBlock - fromBlock + 1n;
      if (width <= 1n) throw error;
      const middle = fromBlock + width / 2n - 1n;
      return [...await readRange(fromBlock, middle), ...await readRange(middle + 1n, toBlock)];
    }
  }
  for (let fromBlock = ctx.lendingDeploymentBlock; fromBlock <= toBlock; fromBlock += chunk) {
    const end = fromBlock + chunk - 1n > toBlock ? toBlock : fromBlock + chunk - 1n;
    const logs = await readRange(fromBlock, end);
    inspectedLogs += logs.length;
    for (const log of logs) {
      let decoded;
      try { decoded = decodeEventLog({ abi: lendingPoolV2Abi, topics: log.topics, data: log.data, strict: false }); }
      catch { continue; }
      const args = decoded.args ?? {};
      const actor = args.supplier ?? args.user ?? args.borrower;
      if (typeof actor !== "string" || !sameAddress(actor, wallet)) continue;
      if (decoded.eventName === "LiquiditySupplied") metrics.supplyActions += 1;
      else if (decoded.eventName === "CollateralDeposited") metrics.collateralActions += 1;
      else if (decoded.eventName === "Borrowed") metrics.borrowActions += 1;
      else if (decoded.eventName === "Repaid") {
        metrics.repaymentActions += 1;
        if (args.debtBalance === 0n) metrics.fullRepayments += 1;
      } else if (decoded.eventName === "Liquidated") metrics.liquidations += 1;
    }
  }
  const score = scoreLendingEvidence(metrics);
  const evidence = {
    format: "gyevo-lending-reputation-evidence-v1",
    chainId: CHAIN_ID,
    lendingPool: ctx.lendingPool,
    wallet,
    observedFromBlock: ctx.lendingDeploymentBlock.toString(),
    observedToBlock: toBlock.toString(),
    finalityBlocks: 5,
    scoreModel: "participation=1, borrow=1, full-repayment=2, any-liquidation=-2; repeated volume does not add points",
    metrics,
    score,
  };
  const evidenceHash = keccak256(toBytes(JSON.stringify(evidence)));
  return {
    evidence,
    evidenceHash,
    diagnostics: {
      inspectedLogs,
      rpcQueries: queries,
      simulationBlockNumber: simulationBlockNumber.toString(),
    },
  };
}

function writeExclusive(file, value) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
  const handle = fs.openSync(resolved, "wx", 0o600);
  try { fs.writeFileSync(handle, `${JSON.stringify(value, null, 2)}\n`); }
  finally { fs.closeSync(handle); }
  return resolved;
}

async function status(wallet) {
  const ctx = await context(true);
  const [governancePaused, reputationPaused, threshold, quorum, commitPeriod, revealPeriod] = await Promise.all([
    ctx.client.readContract({ address: ctx.governance, abi: robinhoodGovernancePhase2Abi, functionName: "paused" }),
    ctx.client.readContract({ address: ctx.reputation, abi: robinhoodLendingReputationAbi, functionName: "paused" }),
    ctx.client.readContract({ address: ctx.governance, abi: robinhoodGovernancePhase2Abi, functionName: "minimumReputation" }),
    ctx.client.readContract({ address: ctx.governance, abi: robinhoodGovernancePhase2Abi, functionName: "quorum" }),
    ctx.client.readContract({ address: ctx.governance, abi: robinhoodGovernancePhase2Abi, functionName: "commitPeriod" }),
    ctx.client.readContract({ address: ctx.governance, abi: robinhoodGovernancePhase2Abi, functionName: "revealPeriod" }),
  ]);
  console.log(`DAO Phase 2 · chain ${CHAIN_ID}\nGovernance ${ctx.governance} · ${governancePaused ? "PAUSED" : "ACTIVE"}\nReputation ${ctx.reputation} · ${reputationPaused ? "PAUSED" : "ACTIVE"}\nPolicy 5 threshold ${threshold} · quorum ${quorum} · commit ${commitPeriod}s · reveal ${revealPeriod}s`);
  if (!wallet) return;
  assert.ok(isAddress(wallet), "Wallet is invalid.");
  const address = getAddress(wallet);
  const [credential, claim, activeClaim, member] = await Promise.all([
    ctx.client.readContract({ address: ctx.credentialRegistry, abi: credentialRegistryAbi, functionName: "getCredential", args: [address, POLICY_ID] }),
    ctx.client.readContract({ address: ctx.reputation, abi: robinhoodLendingReputationAbi, functionName: "getClaim", args: [address] }),
    ctx.client.readContract({ address: ctx.reputation, abi: robinhoodLendingReputationAbi, functionName: "isActiveClaim", args: [address] }),
    ctx.client.readContract({ address: ctx.governance, abi: robinhoodGovernancePhase2Abi, functionName: "isActiveMember", args: [address] }),
  ]);
  console.log(`Wallet ${address}\nCredential version ${credential.version} · revoked ${credential.revoked}\nReputation version ${claim.credentialVersion} · active ${activeClaim}\nProof-backed membership ${member}`);
}

async function evidence(wallet, output) {
  assert.ok(isAddress(wallet), "Wallet is invalid.");
  const ctx = await context(false);
  const result = await completeLendingEvidence(ctx, getAddress(wallet));
  console.log(`PASS complete Lending V2 evidence · blocks ${result.evidence.observedFromBlock}-${result.evidence.observedToBlock} · ${result.diagnostics.rpcQueries} bounded ranges · evidence ${result.evidenceHash}`);
  console.log(`Reputation score ${result.evidence.score} under model v1. This score is derived from public chain events; no private witness material was read.`);
  if (output) console.log(`Evidence written to ${writeExclusive(output, { ...result.evidence, evidenceHash: result.evidenceHash })}`);
  return result;
}

async function prepareMembership(wallet, daysText, witnessFile) {
  assert.ok(isAddress(wallet), "Wallet is invalid.");
  const days = Number(daysText);
  assert.ok(Number.isInteger(days) && days >= 1 && days <= 90, "Expiry must be 1-90 days.");
  assert.ok(witnessFile, "Provide a protected witness output path.");
  const ctx = await context(true);
  const address = getAddress(wallet);
  const result = await completeLendingEvidence(ctx, address);
  const [threshold, credential, claim, latestBlock] = await Promise.all([
    ctx.client.readContract({ address: ctx.governance, abi: robinhoodGovernancePhase2Abi, functionName: "minimumReputation" }),
    ctx.client.readContract({ address: ctx.credentialRegistry, abi: credentialRegistryAbi, functionName: "getCredential", args: [address, POLICY_ID] }),
    ctx.client.readContract({ address: ctx.reputation, abi: robinhoodLendingReputationAbi, functionName: "getClaim", args: [address] }),
    ctx.client.getBlock({ blockTag: "latest" }),
  ]);
  assert.ok(BigInt(result.evidence.score) >= threshold, `Canonical Lending V2 score ${result.evidence.score} is below threshold ${threshold}.`);
  assert.equal(credential.version, claim.credentialVersion, "Credential and reputation versions are already out of sync.");
  const version = credential.version + 1n;
  const expiresAt = latestBlock.timestamp + BigInt(days * 86_400);
  const salt = generateFieldSalt();
  const commitment = await computeEligibilityCommitment({
    subject: address,
    privateValue: String(result.evidence.score),
    salt,
    policyId: POLICY_ID,
    policyVersion: POLICY_VERSION,
    threshold,
    credentialVersion: version,
    expiresAt,
    chainId: BigInt(CHAIN_ID),
    vault: ctx.governance,
  });
  const witness = {
    format: "robinhood-demo-credential-v1",
    wallet: address,
    policyId: Number(POLICY_ID),
    commitment,
    privateValue: String(result.evidence.score),
    salt,
    expiresAt: Number(expiresAt),
  };
  const resolvedWitness = writeExclusive(witnessFile, witness);
  const evidenceFile = writeExclusive(`${witnessFile}.evidence.json`, { ...result.evidence, evidenceHash: result.evidenceHash });
  console.log(`PASS prepared Policy 5 membership version ${version} for ${address}.\nWitness: ${resolvedWitness}\nEvidence: ${evidenceFile}\nPrivate score and salt were not printed. No transaction was signed or submitted.`);
}

function secureJson(file, parser = (value) => value) {
  const resolved = path.resolve(file);
  const stat = fs.statSync(resolved);
  assert.equal(stat.mode & 0o077, 0, `${resolved} must use mode 0600 or stricter.`);
  return { resolved, value: parser(JSON.parse(fs.readFileSync(resolved, "utf8"))) };
}

async function readLine(prompt) {
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try { return await reader.question(prompt); } finally { reader.close(); }
}

async function guardedWrite(ctx, command, actor, target, abi, functionName, args, options, confirm, simulationBlockNumber) {
  const pinnedBlock = simulationBlockNumber === undefined ? {} : { blockNumber: simulationBlockNumber };
  const simulation = await ctx.client.simulateContract({ account: actor, address: target, abi, functionName, args, ...pinnedBlock });
  const gas = await ctx.client.estimateContractGas({ account: actor, address: target, abi, functionName, args, ...pinnedBlock });
  console.log(`PASS simulate ${functionName} · from ${actor} · to ${target} · estimated ${gas} gas${simulationBlockNumber === undefined ? "" : ` · pinned block ${simulationBlockNumber}`}`);
  if (!options.execute) {
    console.log(`Simulation only. Execution additionally requires --execute --authorize-public-testnet-write=${authLabels[command]} --account-alias <Foundry alias>.`);
    return;
  }
  assert.equal(options.authorization, authLabels[command], `Authorization must exactly match ${authLabels[command]}.`);
  assert.ok(options.accountAlias && /^[A-Za-z0-9._-]+$/.test(options.accountAlias), "Provide a valid non-secret Foundry account alias.");
  assert.equal(process.stdin.isTTY, true, "Execution requires an interactive terminal.");
  const alias = spawnSync("cast", ["wallet", "address", "--account", options.accountAlias], { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });
  assert.equal(alias.status, 0, "The encrypted Foundry account could not be unlocked.");
  assert.ok((alias.stdout.match(/0x[a-fA-F0-9]{40}/g) ?? []).some((value) => sameAddress(value, actor)), `Account alias is not required signer ${actor}.`);
  const phrase = `WRITE Robinhood Testnet ${authLabels[command]}`;
  assert.equal(await readLine(`Type exactly “${phrase}” to sign and submit: `), phrase, "Confirmation did not match.");
  const calldata = encodeFunctionData({ abi, functionName, args });
  const child = spawn("cast", ["send", "--rpc-url", ctx.rpcUrl, "--chain", String(CHAIN_ID), "--account", options.accountAlias, "--async", "--data", calldata, target], { stdio: ["inherit", "pipe", "inherit"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  const exitCode = await new Promise((resolve) => child.on("close", resolve));
  assert.equal(exitCode, 0, "cast send failed before returning a transaction hash.");
  const hash = output.match(/0x[a-fA-F0-9]{64}/)?.[0];
  assert.ok(hash, "No transaction hash was returned.");
  const receipt = await ctx.client.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success", `Transaction ${hash} reverted.`);
  assert.equal(await confirm(), true, "Receipt succeeded but expected post-state was not confirmed.");
  console.log(`CONFIRMED ${hash}\n${EXPLORER}/tx/${hash}`);
  void simulation;
}

async function issueReputation(witnessFile, evidenceFile, options) {
  const ctx = await context(true);
  const witness = secureJson(witnessFile, parseDemoCredentialWitness).value;
  const evidenceRecord = secureJson(evidenceFile).value;
  assert.equal(witness.policyId, Number(POLICY_ID), "Witness is not Policy 5.");
  assert.ok(sameAddress(witness.wallet, evidenceRecord.wallet), "Witness/evidence wallet mismatch.");
  assert.ok(sameAddress(ctx.lendingPool, evidenceRecord.lendingPool), "Evidence uses a different Lending V2 pool.");
  const { evidenceHash: storedHash, ...evidenceBody } = evidenceRecord;
  assert.equal(keccak256(toBytes(JSON.stringify(evidenceBody))), storedHash, "Evidence digest does not match its canonical contents.");
  assert.equal(evidenceBody.format, "gyevo-lending-reputation-evidence-v1", "Unsupported reputation evidence format.");
  assert.equal(evidenceBody.chainId, CHAIN_ID, "Evidence is not from Robinhood Testnet 46630.");
  assert.equal(String(evidenceBody.score), witness.privateValue, "Witness private score does not match the evidence score.");
  const canonical = await completeLendingEvidence(ctx, witness.wallet, evidenceBody.observedToBlock);
  assert.equal(canonical.evidenceHash, storedHash, "Evidence does not match the complete canonical Lending V2 event history.");
  const simulationBlockNumber = BigInt(canonical.diagnostics.simulationBlockNumber);
  const [claim, credential, threshold] = await Promise.all([
    ctx.client.readContract({ address: ctx.reputation, abi: robinhoodLendingReputationAbi, functionName: "getClaim", args: [witness.wallet], blockNumber: simulationBlockNumber }),
    ctx.client.readContract({ address: ctx.credentialRegistry, abi: credentialRegistryAbi, functionName: "getCredential", args: [witness.wallet, POLICY_ID], blockNumber: simulationBlockNumber }),
    ctx.client.readContract({ address: ctx.governance, abi: robinhoodGovernancePhase2Abi, functionName: "minimumReputation", blockNumber: simulationBlockNumber }),
  ]);
  assert.equal(claim.credentialVersion, credential.version, "Credential and reputation versions are out of sync.");
  const version = claim.credentialVersion + 1n;
  const expectedCommitment = await computeEligibilityCommitment({
    subject: witness.wallet,
    privateValue: witness.privateValue,
    salt: witness.salt,
    policyId: POLICY_ID,
    policyVersion: POLICY_VERSION,
    threshold,
    credentialVersion: version,
    expiresAt: BigInt(witness.expiresAt),
    chainId: BigInt(CHAIN_ID),
    vault: ctx.governance,
  });
  assert.equal(expectedCommitment.toLowerCase(), witness.commitment.toLowerCase(), "Witness commitment does not match the current Phase 2 policy context.");
  const actor = requiredAddress("RH_TESTNET_PHASE2_REPUTATION_ISSUER_ADDRESS");
  const role = await ctx.client.readContract({ address: ctx.reputation, abi: robinhoodLendingReputationAbi, functionName: "REPUTATION_ISSUER_ROLE", blockNumber: simulationBlockNumber });
  const authorized = await ctx.client.readContract({ address: ctx.reputation, abi: credentialIssuerRoleAbi, functionName: "hasRole", args: [role, actor], blockNumber: simulationBlockNumber });
  assert.equal(authorized, true, "Configured reputation issuer lacks the on-chain role.");
  const args = [witness.wallet, witness.commitment, BigInt(witness.expiresAt), version, BigInt(evidenceBody.observedFromBlock), BigInt(evidenceBody.observedToBlock), storedHash];
  await guardedWrite(ctx, "issue-reputation", actor, ctx.reputation, robinhoodLendingReputationAbi, "recordClaim", args, options, async () => {
    const after = await ctx.client.readContract({ address: ctx.reputation, abi: robinhoodLendingReputationAbi, functionName: "getClaim", args: [witness.wallet] });
    return after.credentialVersion === version && after.commitment.toLowerCase() === witness.commitment.toLowerCase();
  }, simulationBlockNumber);
}

async function issueCredential(witnessFile, options) {
  const ctx = await context(true);
  const witness = secureJson(witnessFile, parseDemoCredentialWitness).value;
  assert.equal(witness.policyId, Number(POLICY_ID), "Witness is not Policy 5.");
  const actor = requiredAddress("RH_TESTNET_PHASE2_MEMBERSHIP_ISSUER_ADDRESS");
  const issuerRole = await ctx.client.readContract({ address: ctx.credentialRegistry, abi: credentialIssuerRoleAbi, functionName: "ISSUER_ROLE" });
  const authorized = await ctx.client.readContract({ address: ctx.credentialRegistry, abi: credentialIssuerRoleAbi, functionName: "hasRole", args: [issuerRole, actor] });
  assert.equal(authorized, true, "Configured membership issuer lacks the credential registry role.");
  const [current, claim, claimActive, threshold] = await Promise.all([
    ctx.client.readContract({ address: ctx.credentialRegistry, abi: credentialRegistryAbi, functionName: "getCredential", args: [witness.wallet, POLICY_ID] }),
    ctx.client.readContract({ address: ctx.reputation, abi: robinhoodLendingReputationAbi, functionName: "getClaim", args: [witness.wallet] }),
    ctx.client.readContract({ address: ctx.reputation, abi: robinhoodLendingReputationAbi, functionName: "isActiveClaim", args: [witness.wallet] }),
    ctx.client.readContract({ address: ctx.governance, abi: robinhoodGovernancePhase2Abi, functionName: "minimumReputation" }),
  ]);
  const version = current.version + 1n;
  assert.equal(claimActive, true, "A matching active reputation claim must be recorded before the Policy 5 credential.");
  assert.equal(claim.credentialVersion, version, "Reputation claim version does not match the next credential version.");
  assert.equal(claim.commitment.toLowerCase(), witness.commitment.toLowerCase(), "Reputation claim commitment differs from the witness.");
  assert.equal(claim.expiresAt, BigInt(witness.expiresAt), "Reputation claim expiry differs from the witness.");
  const expectedCommitment = await computeEligibilityCommitment({
    subject: witness.wallet,
    privateValue: witness.privateValue,
    salt: witness.salt,
    policyId: POLICY_ID,
    policyVersion: POLICY_VERSION,
    threshold,
    credentialVersion: version,
    expiresAt: BigInt(witness.expiresAt),
    chainId: BigInt(CHAIN_ID),
    vault: ctx.governance,
  });
  assert.equal(expectedCommitment.toLowerCase(), witness.commitment.toLowerCase(), "Witness commitment does not match the current Phase 2 policy context.");
  const args = [witness.wallet, POLICY_ID, witness.commitment, BigInt(witness.expiresAt), version];
  await guardedWrite(ctx, "issue-credential", actor, ctx.credentialRegistry, credentialRegistryAbi, "recordCredential", args, options, async () => {
    const after = await ctx.client.readContract({ address: ctx.credentialRegistry, abi: credentialRegistryAbi, functionName: "getCredential", args: [witness.wallet, POLICY_ID] });
    return after.version === version && after.commitment.toLowerCase() === witness.commitment.toLowerCase();
  });
}

async function unpause(targetName, options) {
  assert.ok(targetName === "reputation" || targetName === "governance", "Unpause target must be reputation or governance.");
  const ctx = await context(true);
  const actor = requiredAddress("RH_TESTNET_PHASE2_ADMIN_ADDRESS");
  const target = targetName === "reputation" ? ctx.reputation : ctx.governance;
  const abi = targetName === "reputation" ? robinhoodLendingReputationAbi : robinhoodGovernancePhase2Abi;
  const paused = await ctx.client.readContract({ address: target, abi, functionName: "paused" });
  assert.equal(paused, true, `${targetName} is already unpaused; refusing a duplicate write.`);
  await guardedWrite(ctx, "unpause", actor, target, abi, "unpause", [], options, async () => {
    return !(await ctx.client.readContract({ address: target, abi, functionName: "paused" }));
  });
}

async function main() {
  const command = process.argv[2] ?? "help";
  const { positional, options } = parseArgs(process.argv.slice(3));
  if (command === "help" || command === "--help") return usage();
  if (command === "status") return status(positional[0]);
  if (command === "evidence") return evidence(positional[0], positional[1]);
  if (command === "prepare-membership") return prepareMembership(positional[0], positional[1], positional[2]);
  if (command === "unpause") return unpause(positional[0], options);
  if (command === "issue-reputation") return issueReputation(positional[0], positional[1], options);
  if (command === "issue-credential") return issueCredential(positional[0], options);
  usage();
  throw new Error(`Unknown command ${command}.`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`DAO Phase 2 operator failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
