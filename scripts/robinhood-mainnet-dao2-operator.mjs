#!/usr/bin/env bun
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import {
  createPublicClient, decodeEventLog, defineChain, encodeFunctionData, getAddress, http,
  isAddress, keccak256, parseAbi, toBytes,
} from "viem";
import { computeEligibilityCommitment, generateFieldSalt } from "../src/lib/zk/commitment.ts";
import { generateEligibilityProofFromArtifact } from "../src/lib/zk/eligibility-prover.ts";
import { parseDemoCredentialWitness } from "../src/lib/credential/witness.ts";
import { parsePhase2Ballot } from "../src/lib/governance/phase2-ballot.ts";
import { robinhoodMainnetDemoContracts as contracts, ROBINHOOD_MAINNET_CHAIN_ID } from "../src/lib/config/robinhood-mainnet-demo.ts";
import {
  assertMainnetProposalCreationReady, assertMainnetProposalExecutionReady,
  assertMainnetProposalFinalizationReady, mainnetPolicy5ProofContext,
} from "./robinhood-mainnet-dao2-proof-core.mjs";

const ROOT = process.cwd();
const CHAIN_ID = ROBINHOOD_MAINNET_CHAIN_ID;
const POLICY_ID = 5n;
const POLICY_VERSION = 1n;
const EXPLORER = "https://robinhoodchain.blockscout.com";
const BASE_ARTIFACT = path.join(ROOT, "contracts/broadcast/DeployRobinhoodMainnetDemoStack.s.sol/4663/run-latest.json");
const PHASE2_ARTIFACT = path.join(ROOT, "contracts/broadcast/DeployRobinhoodMainnetDaoPhase2.s.sol/4663/run-latest.json");
const CIRCUIT_ARTIFACT = path.join(ROOT, "public/circuits/private_eligibility.json");
const AUTH = {
  "register-membership": "mainnet-dao2-register-membership",
  "create-proposal": "mainnet-dao2-create-proposal",
  "finalize-proposal": "mainnet-dao2-finalize-proposal",
  "execute-proposal": "mainnet-dao2-execute-proposal",
  "issue-reputation": "mainnet-dao2-reputation",
  "issue-credential": "mainnet-dao2-credential",
  "unpause-reputation": "mainnet-dao2-unpause-reputation",
  "unpause-governance": "mainnet-dao2-unpause-governance",
  "commit-vote": "mainnet-dao2-commit-vote",
  "reveal-vote": "mainnet-dao2-reveal-vote",
};
const repAbi = parseAbi([
  "function lendingPool() view returns (address)", "function paused() view returns (bool)",
  "function demoOnly() view returns (bool)", "function isActiveClaim(address) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)", "function REPUTATION_ISSUER_ROLE() view returns (bytes32)",
  "function PAUSER_ROLE() view returns (bytes32)", "function hasRole(bytes32,address) view returns (bool)",
  "function getClaim(address) view returns ((address wallet,bytes32 commitment,address issuer,uint64 issuedAt,uint64 expiresAt,uint64 credentialVersion,uint64 modelVersion,uint256 observedFromBlock,uint256 observedToBlock,bytes32 evidenceHash,bool revoked))",
  "function recordClaim(address,bytes32,uint64,uint64,uint256,uint256,bytes32)", "function unpause()",
]);
const govAbi = parseAbi([
  "function credentialRegistry() view returns (address)", "function reputationRegistry() view returns (address)",
  "function eligibilityVerifier() view returns (address)", "function paused() view returns (bool)",
  "function commitPeriod() view returns (uint64)", "function revealPeriod() view returns (uint64)",
  "function executionWindow() view returns (uint64)", "function quorum() view returns (uint256)",
  "function minimumReputation() view returns (uint256)", "function unpause()",
  "function MAX_REPUTATION_THRESHOLD() view returns (uint256)",
  "function nextProposalId() view returns (uint256)", "function isActiveMember(address) view returns (bool)",
  "function registerMembership(bytes,uint256[9])", "function createProposal(string,uint256) returns (uint256)",
  "function finalizeProposal(uint256)", "function executeProposal(uint256)",
  "function proposalVoteCounts(uint256) view returns (uint256 forVotes,uint256 againstVotes,uint256 abstainVotes,uint256 committedVotes)",
  "function proposalState(uint256) view returns (uint8)",
  "function getProposal(uint256) view returns ((address proposer,string contentReference,uint64 createdAt,uint64 startAt,uint64 commitDeadline,uint64 revealDeadline,uint64 executionDeadline,uint256 proposedMinimumReputation,uint256 forVotes,uint256 againstVotes,uint256 abstainVotes,uint256 committedVotes,bool finalized,bool approved,bool executed))",
  "function voteNullifier(uint256,address) view returns (bytes32)",
  "function ballotCommitment(uint256,address,uint8,bytes32) view returns (bytes32)",
  "function ballotCommitments(uint256,bytes32) view returns (bytes32)",
  "function ballotRevealed(uint256,bytes32) view returns (bool)",
  "function commitVote(uint256,bytes32) returns (bytes32)",
  "function revealVote(uint256,uint8,bytes32)",
  "event ProposalCreated(uint256 indexed proposalId,address indexed proposer,uint64 startAt,uint64 commitDeadline,uint64 revealDeadline,uint64 executionDeadline,uint256 proposedMinimumReputation,string contentReference)",
]);
const credentialAbi = parseAbi([
  "function ISSUER_ROLE() view returns (bytes32)", "function hasRole(bytes32,address) view returns (bool)",
  "function getCredential(address,uint256) view returns ((address wallet,bytes32 commitment,address issuer,uint64 issuedAt,uint64 expiresAt,uint64 version,bool revoked))",
  "function recordCredential(address,uint256,bytes32,uint64,uint64) returns (uint64)",
]);
const verifierAbi = parseAbi(["function verifyProof(bytes proof,uint256[9] publicInputs) view returns (bool)"]);
const eventsAbi = parseAbi([
  "event LiquiditySupplied(address indexed asset,address indexed supplier,uint256 amount,uint256 shares)",
  "event CollateralDeposited(address indexed asset,address indexed user,uint256 amount,uint256 balance)",
  "event Borrowed(address indexed asset,address indexed borrower,uint256 amount,uint256 debtBalance,uint64 credentialVersion,bytes32 commitment)",
  "event Repaid(address indexed asset,address indexed borrower,uint256 amount,uint256 debtBalance)",
  "event Liquidated(address indexed debtAsset,address indexed collateralAsset,address indexed borrower,address liquidator,uint256 repaidAmount,uint256 seizedCollateral)",
]);
const arbSysAbi = parseAbi(["function arbBlockNumber() view returns (uint256)"]);

export function scoreMainnetLendingEvidence(metrics) {
  const participated = metrics.supplyActions + metrics.collateralActions + metrics.borrowActions + metrics.repaymentActions > 0;
  return Math.max(0, (participated ? 1 : 0) + (metrics.borrowActions > 0 ? 1 : 0)
    + (metrics.fullRepayments > 0 ? 2 : 0) - (metrics.liquidations > 0 ? 2 : 0));
}

export function assertCanonicalMainnetRange(from, to, finalized, arbL2Head) {
  const start = BigInt(from), end = BigInt(to);
  assert.ok(start <= end, "Evidence start block is after its end block.");
  assert.ok(end <= BigInt(finalized), "Evidence is newer than the RPC finalized block.");
  assert.ok(end < BigInt(arbL2Head), "Evidence end must be strictly below the deployed ArbSys L2 head.");
}

export function isSplittableLogRangeError(error) {
  const message = String(error?.shortMessage ?? error?.message ?? error);
  return /block range|too many results|result limit|response size|query returned|exceeds.*limit|maximum.*blocks/i.test(message);
}

export function parseVoteType(name) {
  const voteTypes = { against: 0, for: 1, abstain: 2 };
  const voteType = voteTypes[String(name).toLowerCase()];
  assert.notEqual(voteType, undefined, "Vote must be against, for, or abstain.");
  return voteType;
}

export function assertMainnetCommitReady({ paused, member, proposalState }) {
  assert.equal(paused, false, "Governance is paused; activation requires separate authorization.");
  assert.equal(member, true, "Voter is not an active proof-backed Mainnet member.");
  assert.equal(Number(proposalState), 2, "The proposal is not in its on-chain commit period.");
}

export function assertMainnetRevealReady({ proposalState, expectedCommitment, ballotCommitment, expectedNullifier, ballotNullifier, storedCommitment, revealed }) {
  assert.equal(Number(proposalState), 3, "The proposal is not in its on-chain reveal period.");
  assert.equal(String(expectedCommitment).toLowerCase(), String(ballotCommitment).toLowerCase(), "Ballot commitment does not match the private reveal file.");
  assert.equal(String(expectedNullifier).toLowerCase(), String(ballotNullifier).toLowerCase(), "Ballot nullifier does not match the private reveal file.");
  assert.equal(String(storedCommitment).toLowerCase(), String(ballotCommitment).toLowerCase(), "No matching public ballot commitment exists.");
  assert.equal(revealed, false, "This ballot has already been revealed.");
}

function requiredAddress(name) {
  const value = process.env[name]?.trim();
  assert.ok(value && isAddress(value), name + " is missing or invalid.");
  return getAddress(value);
}

function rpc() {
  const url = process.env.RH_MAINNET_RPC_URL?.trim();
  assert.ok(url, "RH_MAINNET_RPC_URL is required; no network fallback is permitted.");
  const chain = defineChain({ id: CHAIN_ID, name: "Robinhood Chain Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
  return { url, client: createPublicClient({ chain, transport: http(url, { timeout: 15_000, retryCount: 1 }) }) };
}

function readArtifact(file, names) {
  assert.ok(fs.existsSync(file), "Missing confirmed Mainnet deployment artifact: " + path.relative(ROOT, file));
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(Number(data.chain), CHAIN_ID, "Deployment artifact is not chain 4663.");
  const result = {};
  for (const name of names) {
    const tx = data.transactions?.find((item) => item.transactionType === "CREATE" && item.contractName === name);
    assert.ok(tx, "Artifact has no CREATE entry for " + name + ".");
    const receipt = data.receipts?.find((item) => item.transactionHash?.toLowerCase() === tx.hash?.toLowerCase());
    assert.ok(receipt?.status === "0x1" && receipt.blockNumber, name + " has no successful recorded receipt.");
    const address = receipt.contractAddress ?? tx.contractAddress;
    assert.ok(address && isAddress(address), name + " receipt has no contract address.");
    result[name] = { address: getAddress(address), hash: tx.hash, block: BigInt(receipt.blockNumber) };
  }
  return result;
}

async function checkReceipt(client, item) {
  const receipt = await client.getTransactionReceipt({ hash: item.hash });
  assert.equal(receipt.status, "success", "Live receipt is not successful: " + item.hash);
  assert.ok(receipt.contractAddress?.toLowerCase() === item.address.toLowerCase(), "Live receipt address differs from recorded deployment artifact.");
  const code = await client.getBytecode({ address: item.address });
  assert.ok(code && code !== "0x", "Live bytecode missing at " + item.address);
}

async function getContext(requirePhase2 = true) {
  const { url, client } = rpc();
  assert.equal(await client.getChainId(), CHAIN_ID, "Configured RPC is not Robinhood Mainnet chain 4663.");
  const base = readArtifact(BASE_ARTIFACT, ["RobinhoodMainnetDemoCredentialRegistry", "RobinhoodMainnetDemoLendingPool"]);
  const pool = base.RobinhoodMainnetDemoLendingPool;
  assert.ok(pool.address.toLowerCase() === contracts.lendingPool?.toLowerCase(), "Mainnet Lending receipt differs from typed Mainnet registry.");
  await checkReceipt(client, pool);
  const ctx = { client, url, pool: pool.address, poolBlock: pool.block };
  if (!requirePhase2) return ctx;
  const p2 = readArtifact(PHASE2_ARTIFACT, ["RobinhoodMainnetDemoLendingReputation", "RobinhoodMainnetDemoGovernancePhase2"]);
  ctx.reputation = p2.RobinhoodMainnetDemoLendingReputation.address;
  ctx.governance = p2.RobinhoodMainnetDemoGovernancePhase2.address;
  assert.equal(process.env.RH_MAINNET_PHASE2_REPUTATION_REGISTRY_ADDRESS?.toLowerCase(), ctx.reputation.toLowerCase(), "Configured reputation address differs from successful receipt.");
  assert.equal(process.env.RH_MAINNET_PHASE2_GOVERNANCE_ADDRESS?.toLowerCase(), ctx.governance.toLowerCase(), "Configured governance address differs from successful receipt.");
  await Promise.all(Object.values(p2).map((item) => checkReceipt(client, item)));
  const [lending, registry, reputation, verifier, reputationPaused, governancePaused] = await Promise.all([
    client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "lendingPool" }),
    client.readContract({ address: ctx.governance, abi: govAbi, functionName: "credentialRegistry" }),
    client.readContract({ address: ctx.governance, abi: govAbi, functionName: "reputationRegistry" }),
    client.readContract({ address: ctx.governance, abi: govAbi, functionName: "eligibilityVerifier" }),
    client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "paused" }),
    client.readContract({ address: ctx.governance, abi: govAbi, functionName: "paused" }),
  ]);
  assert.ok(lending.toLowerCase() === ctx.pool.toLowerCase(), "Reputation source is not Mainnet Lending V2.");
  assert.ok(registry.toLowerCase() === contracts.credentialRegistry?.toLowerCase(), "Governance registry dependency mismatch.");
  assert.ok(reputation.toLowerCase() === ctx.reputation.toLowerCase(), "Governance reputation dependency mismatch.");
  assert.ok(verifier.toLowerCase() === contracts.verifierAdapter?.toLowerCase(), "Governance verifier dependency mismatch.");
  for (const [key, fn] of [
    ["RH_MAINNET_PHASE2_COMMIT_PERIOD", "commitPeriod"], ["RH_MAINNET_PHASE2_REVEAL_PERIOD", "revealPeriod"],
    ["RH_MAINNET_PHASE2_EXECUTION_WINDOW", "executionWindow"], ["RH_MAINNET_PHASE2_QUORUM", "quorum"],
    ["RH_MAINNET_PHASE2_MINIMUM_REPUTATION", "minimumReputation"],
  ]) {
    const value = await client.readContract({ address: ctx.governance, abi: govAbi, functionName: fn });
    assert.equal(BigInt(value), BigInt(process.env[key]), key + " differs from live governance state.");
  }
  return ctx;
}

async function evidenceFor(ctx, wallet, requestedEnd) {
  // A confirmed/finalized L2 block is required. Never substitute a fixed block
  // count or latest head if the RPC cannot provide the finalized tag.
  const finalized = await ctx.client.getBlock({ blockTag: "finalized" });
  const l2Head = await ctx.client.readContract({ address: "0x0000000000000000000000000000000000000064", abi: arbSysAbi, functionName: "arbBlockNumber" });
  const end = requestedEnd === undefined ? finalized.number : BigInt(requestedEnd);
  assertCanonicalMainnetRange(ctx.poolBlock, end, finalized.number, l2Head);
  const metrics = { supplyActions: 0, collateralActions: 0, borrowActions: 0, repaymentActions: 0, fullRepayments: 0, liquidations: 0 };
  let queries = 0, logsRead = 0;
  async function getRange(from, to) {
    queries += 1;
    assert.ok(queries <= 4096, "Mainnet log scan exceeded its bounded 4096-query budget.");
    try { return await ctx.client.getLogs({ address: ctx.pool, fromBlock: from, toBlock: to }); }
    catch (error) {
      if (!isSplittableLogRangeError(error)) throw error;
      if (from === to) throw error;
      const middle = from + (to - from) / 2n;
      return [...await getRange(from, middle), ...await getRange(middle + 1n, to)];
    }
  }
  for (let from = ctx.poolBlock; from <= end; from += 20_000n) {
    const to = from + 19_999n > end ? end : from + 19_999n;
    const logs = await getRange(from, to);
    logsRead += logs.length;
    for (const log of logs) {
      let decoded;
      try { decoded = decodeEventLog({ abi: eventsAbi, topics: log.topics, data: log.data, strict: true }); }
      catch { continue; }
      const actor = decoded.args.supplier ?? decoded.args.user ?? decoded.args.borrower;
      if (typeof actor !== "string" || actor.toLowerCase() !== wallet.toLowerCase()) continue;
      if (decoded.eventName === "LiquiditySupplied") metrics.supplyActions += 1;
      else if (decoded.eventName === "CollateralDeposited") metrics.collateralActions += 1;
      else if (decoded.eventName === "Borrowed") metrics.borrowActions += 1;
      else if (decoded.eventName === "Repaid") {
        metrics.repaymentActions += 1;
        if (decoded.args.debtBalance === 0n) metrics.fullRepayments += 1;
      } else if (decoded.eventName === "Liquidated") metrics.liquidations += 1;
    }
  }
  const body = {
    format: "gyevo-mainnet-lending-reputation-evidence-v1", chainId: CHAIN_ID,
    lendingPool: ctx.pool, wallet, observedFromBlock: ctx.poolBlock.toString(),
    observedToBlock: end.toString(), finalityTag: "finalized",
    scoreModel: "participation=1, borrow=1, full-repayment=2, any-liquidation=-2; repeated volume does not add points",
    metrics, score: scoreMainnetLendingEvidence(metrics),
  };
  return { body, evidenceHash: keccak256(toBytes(JSON.stringify(body))), queries, logsRead, l2Head: String(l2Head) };
}

function secureRead(file, transform = (value) => value) {
  const absolute = path.resolve(file), stat = fs.statSync(absolute);
  assert.equal(stat.mode & 0o077, 0, "Witness/evidence file must be private (mode 0600 or stricter).");
  return transform(JSON.parse(fs.readFileSync(absolute, "utf8")));
}

function writePrivate(file, value) {
  const absolute = path.resolve(file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true, mode: 0o700 });
  const fd = fs.openSync(absolute, "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); } finally { fs.closeSync(fd); }
  return absolute;
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return await rl.question(question); } finally { rl.close(); }
}

async function writeGuarded(ctx, command, actor, target, abi, functionName, args, options, confirm, blockNumber, beforeSend) {
  const request = { account: actor, address: target, abi, functionName, args, ...(blockNumber === undefined ? {} : { blockNumber }) };
  await ctx.client.simulateContract(request);
  const gas = await ctx.client.estimateContractGas(request);
  console.log("PASS read-only simulation: " + functionName + " · chain 4663 · gas " + gas);
  if (!options.execute) return console.log("Simulation only. No Mainnet transaction was signed or submitted.");
  assert.equal(options.authorization, AUTH[command], "Authorization must exactly equal " + AUTH[command] + ".");
  const alias = options.accountAlias ?? process.env.RH_MAINNET_ACCOUNT;
  assert.ok(alias && /^[A-Za-z0-9._-]+$/.test(alias) && process.stdin.isTTY, "Execution requires an interactive terminal and encrypted Foundry account alias.");
  const signer = spawnSync("cast", ["wallet", "address", "--account", alias], { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });
  assert.equal(signer.status, 0, "Could not unlock encrypted Foundry keystore to verify its public address.");
  const derived = signer.stdout.match(/0x[a-fA-F0-9]{40}/g) ?? [];
  assert.ok(derived.some((address) => getAddress(address).toLowerCase() === actor.toLowerCase()), "Keystore alias does not match the authorized role.");
  const phrase = "WRITE Robinhood Mainnet " + AUTH[command];
  assert.equal(await prompt("Type exactly “" + phrase + "” to sign and submit: "), phrase, "Final typed authorization did not match.");
  await beforeSend?.();
  const data = encodeFunctionData({ abi, functionName, args });
  const child = spawn("cast", ["send", "--rpc-url", ctx.url, "--chain", "4663", "--account", alias, "--async", "--data", data, target], { stdio: ["inherit", "pipe", "inherit"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  const exit = await new Promise((resolve) => child.on("close", resolve));
  assert.equal(exit, 0, "cast send failed before returning a transaction hash.");
  const hash = output.match(/0x[a-fA-F0-9]{64}/)?.[0];
  assert.ok(hash, "No transaction hash returned.");
  const receipt = await ctx.client.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success", "Transaction receipt failed: " + hash);
  assert.equal(await confirm(receipt), true, "Transaction receipt succeeded but post-state check failed.");
  console.log("CONFIRMED " + hash + "\n" + EXPLORER + "/tx/" + hash);
}

async function showStatus(wallet) {
  if (!fs.existsSync(PHASE2_ARTIFACT)) return console.log("Robinhood Mainnet DAO Phase 2: NOT DEPLOYED (no Mainnet Phase 2 receipt artifact).");
  const ctx = await getContext(true);
  const [paused, reputationPaused, quorum, threshold] = await Promise.all([
    ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "paused" }),
    ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "paused" }),
    ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "quorum" }),
    ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "minimumReputation" }),
  ]);
  console.log("Robinhood Mainnet DAO Phase 2 · Governance " + (paused ? "PAUSED" : "ACTIVE") + " · Reputation " + (reputationPaused ? "PAUSED" : "ACTIVE") + " · quorum " + quorum + " · threshold " + threshold);
  if (!wallet) return;
  assert.ok(isAddress(wallet), "Invalid wallet.");
  const address = getAddress(wallet);
  const [claim, active, member] = await Promise.all([
    ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "getClaim", args: [address] }),
    ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "isActiveClaim", args: [address] }),
    ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "isActiveMember", args: [address] }),
  ]);
  const credential = await ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "getCredential", args: [address, POLICY_ID] });
  console.log("Wallet " + address + " · Policy 5 version " + credential.version + " · active reputation claim " + active + " · claim version " + claim.credentialVersion + " · proof-backed DAO member " + member);
}

async function buildMainnetPolicy5Proof(witnessFile) {
  const witness = secureRead(witnessFile, parseDemoCredentialWitness);
  assert.equal(witness.format, "robinhood-demo-credential-v1", "Expected a private Mainnet-domain credential witness.");
  assert.equal(witness.policyId, Number(POLICY_ID), "DAO Phase 2 requires a Policy 5 witness.");
  const ctx = await getContext(true), wallet = getAddress(witness.wallet);
  const [block, credential, claim, activeClaim, threshold, credentialIssuerRole, claimIssuerRole] = await Promise.all([
    ctx.client.getBlock({ blockTag: "latest" }),
    ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "getCredential", args: [wallet, POLICY_ID] }),
    ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "getClaim", args: [wallet] }),
    ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "isActiveClaim", args: [wallet] }),
    ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "minimumReputation" }),
    ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "ISSUER_ROLE" }),
    ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "REPUTATION_ISSUER_ROLE" }),
  ]);
  const [credentialIssuerActive, claimIssuerActive] = await Promise.all([
    ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "hasRole", args: [credentialIssuerRole, credential.issuer] }),
    ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "hasRole", args: [claimIssuerRole, claim.issuer] }),
  ]);
  assert.equal(credentialIssuerActive, true, "Policy 5 credential issuer is no longer authorized by the registry.");
  assert.equal(claimIssuerActive, true, "Reputation claim issuer is no longer authorized.");
  const proofContext = mainnetPolicy5ProofContext({ witness, wallet, credential, claim, activeClaim, threshold, now: block.timestamp, governance: ctx.governance, chainId: CHAIN_ID });
  const expectedCommitment = await computeEligibilityCommitment({
    subject: wallet, privateValue: witness.privateValue, salt: witness.salt,
    policyId: POLICY_ID, policyVersion: POLICY_VERSION, threshold,
    credentialVersion: credential.version, expiresAt: credential.expiresAt,
    chainId: BigInt(CHAIN_ID), vault: ctx.governance,
  });
  assert.equal(expectedCommitment.toLowerCase(), witness.commitment.toLowerCase(), "Policy 5 witness does not open the commitment stored on-chain.");
  assert.ok(fs.existsSync(CIRCUIT_ARTIFACT), "Missing checked-in Noir eligibility circuit artifact.");
  const circuit = JSON.parse(fs.readFileSync(CIRCUIT_ARTIFACT, "utf8"));
  const generated = await generateEligibilityProofFromArtifact(witness, proofContext, circuit, (stage) => console.log("Proof: " + stage));
  assert.equal(generated.localVerification, "verified", "Local Barretenberg verification failed.");
  const accepted = await ctx.client.readContract({ address: contracts.verifierAdapter, abi: verifierAbi, functionName: "verifyProof", args: [generated.proof, [...generated.publicInputs]] });
  assert.equal(accepted, true, "The deployed Mainnet verifier adapter rejected this participant's Policy 5 proof.");
  return { ctx, wallet, proof: generated };
}

async function main() {
  const command = process.argv[2] ?? "help";
  const positional = [], options = {};
  for (let i = 3; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === "--execute") options.execute = true;
    else if (arg.startsWith("--authorize-mainnet-dao2-write=")) options.authorization = arg.split("=")[1];
    else if (arg === "--account-alias") options.accountAlias = process.argv[++i];
    else if (arg.startsWith("--account-alias=")) options.accountAlias = arg.split("=")[1];
    else if (arg === "--voter-address") options.voterAddress = process.argv[++i];
    else if (arg.startsWith("--voter-address=")) options.voterAddress = arg.split("=")[1];
    else if (arg === "--proposer-address") options.proposerAddress = process.argv[++i];
    else if (arg.startsWith("--proposer-address=")) options.proposerAddress = arg.split("=")[1];
    else positional.push(arg);
  }
  if (command === "help" || command === "--help") {
    console.log("Read-only: status [wallet] | evidence <wallet> [output.json] | prepare-membership <wallet> <days> <witness.json> | proof <policy5-witness.json> | proposal <id>\nSimulated by default: register-membership <witness> | create-proposal <reference> <min-reputation> --proposer-address <address> | commit-vote <id> <against|for|abstain> <ballot.json> --voter-address <address> | reveal-vote <ballot.json> --voter-address <address> | finalize-proposal <id> | execute-proposal <id> | issue-reputation <witness> <evidence> | issue-credential <witness> | unpause reputation|governance. Writes require --execute, operation-specific authorization, an encrypted alias matching the signer, and typed confirmation. Commit/reveal secrets stay in mode-0600 files. Votes are hidden only until reveal, not anonymous. `proof` uses the selected real witness, on-chain credential/claim readbacks, local Barretenberg verification, and the deployed Mainnet adapter; it never broadcasts.");
    return;
  }
  if (command === "status") return showStatus(positional[0]);
  if (command === "evidence") {
    assert.ok(isAddress(positional[0]), "Provide an EVM wallet address.");
    const ctx = await getContext(false);
    const result = await evidenceFor(ctx, getAddress(positional[0]));
    console.log("Canonical Robinhood Mainnet Lending evidence · finalized L2 blocks " + ctx.poolBlock + "-" + result.body.observedToBlock + " · score " + result.body.score + " · " + result.logsRead + " logs, " + result.queries + " bounded RPC queries.");
    if (positional[1]) console.log("Evidence file: " + writePrivate(positional[1], { ...result.body, evidenceHash: result.evidenceHash }));
    return;
  }
  if (command === "prepare-membership") {
    assert.ok(isAddress(positional[0]), "Provide an EVM wallet address.");
    const days = Number(positional[1]);
    assert.ok(Number.isInteger(days) && days >= 1 && days <= 90, "Expiry must be 1–90 days.");
    const ctx = await getContext(true), wallet = getAddress(positional[0]);
    assert.ok(positional[2], "Provide a private witness output path.");
    const result = await evidenceFor(ctx, wallet);
    const [threshold, current, claim, latest] = await Promise.all([
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "minimumReputation" }),
      ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "getCredential", args: [wallet, POLICY_ID] }),
      ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "getClaim", args: [wallet] }),
      ctx.client.getBlock({ blockTag: "latest" }),
    ]);
    assert.ok(BigInt(result.body.score) >= threshold, "Canonical Mainnet score is below Policy 5 threshold.");
    assert.equal(current.version, claim.credentialVersion, "Existing credential and claim versions do not match.");
    const version = current.version + 1n, expiresAt = latest.timestamp + BigInt(days * 86_400), salt = generateFieldSalt();
    const commitment = await computeEligibilityCommitment({ subject: wallet, privateValue: String(result.body.score), salt,
      policyId: POLICY_ID, policyVersion: POLICY_VERSION, threshold, credentialVersion: version, expiresAt,
      chainId: BigInt(CHAIN_ID), vault: ctx.governance });
    const witness = { format: "robinhood-demo-credential-v1", wallet, policyId: 5, commitment,
      privateValue: String(result.body.score), salt, expiresAt: Number(expiresAt) };
    const witnessPath = writePrivate(positional[2], witness);
    const evidencePath = writePrivate(positional[2] + ".evidence.json", { ...result.body, evidenceHash: result.evidenceHash });
    console.log("Prepared Mainnet Policy 5 witness for " + wallet + " · version " + version + ".\nWitness: " + witnessPath + "\nEvidence: " + evidencePath + "\nPrivate score and salt were not printed.");
    return;
  }
  if (command === "proof") {
    assert.ok(positional[0], "Use proof <private-policy5-witness.json>.");
    const { ctx, wallet } = await buildMainnetPolicy5Proof(positional[0]);
    console.log(`Policy 5 proof VERIFIED · wallet ${wallet} · chain 4663 · governance ${ctx.governance} · local verifier and deployed adapter accepted (read-only). Proof bytes and private witness values were not printed.`);
    return;
  }
  if (command === "register-membership") {
    assert.ok(positional[0], "Use register-membership <private-policy5-witness.json>.");
    const { ctx, wallet, proof } = await buildMainnetPolicy5Proof(positional[0]);
    assert.equal(await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "isActiveMember", args: [wallet] }), false, "Wallet is already an active member; refusing duplicate registration.");
    await writeGuarded(ctx, command, wallet, ctx.governance, govAbi, "registerMembership", [proof.proof, [...proof.publicInputs]], options,
      async () => ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "isActiveMember", args: [wallet] }));
    return;
  }
  if (command === "proposal") {
    const proposalId = BigInt(positional[0] ?? "0");
    assert.ok(proposalId > 0n, "Use proposal <positive-id>.");
    const ctx = await getContext(true);
    const [proposal, state, votes] = await Promise.all([
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "getProposal", args: [proposalId] }),
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "proposalState", args: [proposalId] }),
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "proposalVoteCounts", args: [proposalId] }),
    ]);
    const states = ["None", "Pending", "Commit", "Reveal", "Succeeded", "Rejected", "Expired", "Executed"];
    console.log(JSON.stringify({ chainId: CHAIN_ID, governance: ctx.governance, proposalId: proposalId.toString(), proposer: proposal.proposer,
      contentReference: proposal.contentReference, state: states[Number(state)] ?? `Unknown(${state})`, createdAt: proposal.createdAt.toString(),
      startAt: proposal.startAt.toString(), commitDeadline: proposal.commitDeadline.toString(), revealDeadline: proposal.revealDeadline.toString(),
      executionDeadline: proposal.executionDeadline.toString(), minimumReputation: proposal.proposedMinimumReputation.toString(),
      votes: { for: votes[0].toString(), against: votes[1].toString(), abstain: votes[2].toString(), committed: votes[3].toString() },
      finalized: proposal.finalized, approved: proposal.approved, executed: proposal.executed }, null, 2));
    return;
  }
  if (command === "create-proposal") {
    assert.ok(positional[0] && positional[0].length <= 512, "Use create-proposal <content-reference<=512 chars> <minimum-reputation> --proposer-address <address>.");
    const proposedMinimumReputation = BigInt(positional[1] ?? "0");
    const proposerValue = options.proposerAddress ?? process.env.RH_MAINNET_DEMO_PARTICIPANT_A_ADDRESS;
    assert.ok(proposerValue && isAddress(proposerValue), "Supply --proposer-address for the member that will propose.");
    const proposer = getAddress(proposerValue), ctx = await getContext(true);
    const [paused, member, maxThreshold] = await Promise.all([
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "paused" }),
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "isActiveMember", args: [proposer] }),
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "MAX_REPUTATION_THRESHOLD" }),
    ]);
    assertMainnetProposalCreationReady({ paused, activeMember: member, maximumReputation: maxThreshold, proposedMinimumReputation });
    let created;
    await writeGuarded(ctx, command, proposer, ctx.governance, govAbi, "createProposal", [positional[0], proposedMinimumReputation], options,
      async (receipt) => {
        if (!receipt) return true;
        let args;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== ctx.governance.toLowerCase()) continue;
          try {
            const decoded = decodeEventLog({ abi: govAbi, topics: log.topics, data: log.data, strict: true });
            if (decoded.eventName === "ProposalCreated") { args = decoded.args; break; }
          } catch { /* other Governance event */ }
        }
        assert.ok(args, "Confirmed creation receipt has no ProposalCreated event from the configured Governance contract.");
        const proposalId = BigInt(args.proposalId);
        const proposal = await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "getProposal", args: [proposalId] });
        assert.equal(proposal.proposer.toLowerCase(), proposer.toLowerCase(), "Created proposal proposer differs from signer.");
        assert.equal(proposal.contentReference, positional[0], "Created proposal reference differs from the simulated request.");
        assert.equal(proposal.proposedMinimumReputation, proposedMinimumReputation, "Created proposal parameter differs from the simulated request.");
        created = { proposalId, proposal };
        return true;
      });
    if (created) console.log(`Confirmed Proposal #${created.proposalId} · createdAt ${created.proposal.createdAt} · startAt ${created.proposal.startAt} · commit deadline ${created.proposal.commitDeadline} · reveal deadline ${created.proposal.revealDeadline}`);
    return;
  }
  if (command === "finalize-proposal") {
    const proposalId = BigInt(positional[0] ?? "0");
    assert.ok(proposalId > 0n, "Use finalize-proposal <positive-id>.");
    const ctx = await getContext(true), proposal = await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "getProposal", args: [proposalId] });
    assertMainnetProposalFinalizationReady({ finalized: proposal.finalized, now: (await ctx.client.getBlock({ blockTag: "latest" })).timestamp, revealDeadline: proposal.revealDeadline });
    const actor = requiredAddress("RH_MAINNET_ADMIN_ADDRESS");
    await writeGuarded(ctx, command, actor, ctx.governance, govAbi, "finalizeProposal", [proposalId], options,
      async () => (await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "getProposal", args: [proposalId] })).finalized);
    if (options.execute) {
      const final = await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "getProposal", args: [proposalId] });
      console.log(`Finalized Proposal #${proposalId} · approved ${final.approved} · for ${final.forVotes} · against ${final.againstVotes} · abstain ${final.abstainVotes}`);
    }
    return;
  }
  if (command === "execute-proposal") {
    const proposalId = BigInt(positional[0] ?? "0");
    assert.ok(proposalId > 0n, "Use execute-proposal <positive-id>.");
    const ctx = await getContext(true), [proposal, paused, state] = await Promise.all([
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "getProposal", args: [proposalId] }),
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "paused" }),
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "proposalState", args: [proposalId] }),
    ]);
    assertMainnetProposalExecutionReady({ paused, finalized: proposal.finalized, approved: proposal.approved, proposalState: state });
    const actor = requiredAddress("RH_MAINNET_ADMIN_ADDRESS");
    await writeGuarded(ctx, command, actor, ctx.governance, govAbi, "executeProposal", [proposalId], options,
      async () => {
        const after = await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "getProposal", args: [proposalId] });
        const nextMinimum = await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "minimumReputation" });
        return after.executed && nextMinimum === proposal.proposedMinimumReputation;
      });
    if (options.execute) console.log(`Executed Proposal #${proposalId} · minimum reputation is now ${proposal.proposedMinimumReputation}`);
    return;
  }
  if (command === "issue-reputation") {
    const ctx = await getContext(true), witness = secureRead(positional[0], parseDemoCredentialWitness), stored = secureRead(positional[1]);
    assert.equal(witness.policyId, 5, "Witness is not Policy 5.");
    assert.equal(witness.format, "robinhood-demo-credential-v1", "Witness must be Mainnet-domain formatted.");
    assert.equal(stored.format, "gyevo-mainnet-lending-reputation-evidence-v1", "Evidence is not Mainnet-specific.");
    assert.equal(stored.chainId, CHAIN_ID, "Evidence is not chain 4663.");
    assert.ok(stored.wallet.toLowerCase() === witness.wallet.toLowerCase(), "Evidence and witness wallet mismatch.");
    assert.ok(stored.lendingPool.toLowerCase() === ctx.pool.toLowerCase(), "Evidence does not use Mainnet Lending.");
    const { evidenceHash, ...body } = stored;
    assert.equal(keccak256(toBytes(JSON.stringify(body))), evidenceHash, "Evidence hash mismatch.");
    const canonical = await evidenceFor(ctx, witness.wallet, body.observedToBlock);
    assert.equal(canonical.evidenceHash, evidenceHash, "Evidence does not match canonical finalized Mainnet logs.");
    assert.equal(String(canonical.body.score), witness.privateValue, "Witness score differs from canonical public history.");
    const [claim, credential, threshold, paused, role] = await Promise.all([
      ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "getClaim", args: [witness.wallet] }),
      ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "getCredential", args: [witness.wallet, POLICY_ID] }),
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "minimumReputation" }),
      ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "paused" }),
      ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "REPUTATION_ISSUER_ROLE" }),
    ]);
    assert.equal(paused, false, "Reputation registry is paused; activation requires separate authorization.");
    assert.equal(claim.credentialVersion, credential.version, "Claim/credential versions are inconsistent.");
    const version = claim.credentialVersion + 1n;
    const commitment = await computeEligibilityCommitment({ subject: witness.wallet, privateValue: witness.privateValue,
      salt: witness.salt, policyId: POLICY_ID, policyVersion: POLICY_VERSION, threshold,
      credentialVersion: version, expiresAt: BigInt(witness.expiresAt), chainId: BigInt(CHAIN_ID), vault: ctx.governance });
    assert.equal(commitment.toLowerCase(), witness.commitment.toLowerCase(), "Witness commitment mismatch.");
    const actor = requiredAddress("RH_MAINNET_RISK_ADMIN_ADDRESS");
    assert.equal(await ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "hasRole", args: [role, actor] }), true, "Configured reputation issuer lacks on-chain role.");
    const args = [witness.wallet, witness.commitment, BigInt(witness.expiresAt), version, BigInt(body.observedFromBlock), BigInt(body.observedToBlock), evidenceHash];
    return writeGuarded(ctx, command, actor, ctx.reputation, repAbi, "recordClaim", args, options, async () => {
      const after = await ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "getClaim", args: [witness.wallet] });
      return after.credentialVersion === version && after.commitment.toLowerCase() === witness.commitment.toLowerCase();
    }, await ctx.client.getBlockNumber());
  }
  if (command === "issue-credential") {
    const ctx = await getContext(true), witness = secureRead(positional[0], parseDemoCredentialWitness);
    assert.equal(witness.policyId, 5, "Witness is not Policy 5.");
    assert.equal(witness.format, "robinhood-demo-credential-v1", "Witness must be Mainnet-domain formatted.");
    const [current, claim, active, threshold, role] = await Promise.all([
      ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "getCredential", args: [witness.wallet, POLICY_ID] }),
      ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "getClaim", args: [witness.wallet] }),
      ctx.client.readContract({ address: ctx.reputation, abi: repAbi, functionName: "isActiveClaim", args: [witness.wallet] }),
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "minimumReputation" }),
      ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "ISSUER_ROLE" }),
    ]);
    const version = current.version + 1n;
    assert.equal(active, true, "An active reputation claim must be recorded first.");
    assert.equal(claim.credentialVersion, version, "Claim version is not the next Policy 5 credential version.");
    assert.ok(claim.commitment.toLowerCase() === witness.commitment.toLowerCase() && claim.expiresAt === BigInt(witness.expiresAt), "Claim does not match witness.");
    const commitment = await computeEligibilityCommitment({ subject: witness.wallet, privateValue: witness.privateValue,
      salt: witness.salt, policyId: POLICY_ID, policyVersion: POLICY_VERSION, threshold,
      credentialVersion: version, expiresAt: BigInt(witness.expiresAt), chainId: BigInt(CHAIN_ID), vault: ctx.governance });
    assert.equal(commitment.toLowerCase(), witness.commitment.toLowerCase(), "Witness commitment mismatch.");
    const actor = requiredAddress("RH_MAINNET_ISSUER_ADDRESS");
    assert.equal(await ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "hasRole", args: [role, actor] }), true, "Membership issuer lacks registry role.");
    const args = [witness.wallet, POLICY_ID, witness.commitment, BigInt(witness.expiresAt), version];
    return writeGuarded(ctx, command, actor, contracts.credentialRegistry, credentialAbi, "recordCredential", args, options, async () => {
      const after = await ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "getCredential", args: [witness.wallet, POLICY_ID] });
      return after.version === version && after.commitment.toLowerCase() === witness.commitment.toLowerCase();
    });
  }
  if (command === "commit-vote") {
    assert.ok(positional.length >= 3, "Use commit-vote <proposal-id> <against|for|abstain> <private-ballot-file> --voter-address <address>.");
    const proposalId = BigInt(positional[0]);
    assert.ok(proposalId > 0n, "Proposal ID must be positive.");
    const voteType = parseVoteType(positional[1]);
    const ballotFile = positional[2];
    assert.ok(ballotFile && !fs.existsSync(path.resolve(ballotFile)), "Choose a new private ballot-file path; refusing to overwrite an existing ballot secret.");
    const voterValue = options.voterAddress ?? process.env.RH_MAINNET_DEMO_PARTICIPANT_A_ADDRESS;
    assert.ok(voterValue && isAddress(voterValue), "Set --voter-address or RH_MAINNET_DEMO_PARTICIPANT_A_ADDRESS for the read-only simulation.");
    const voter = getAddress(voterValue), ctx = await getContext(true);
    const [paused, member, state] = await Promise.all([
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "paused" }),
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "isActiveMember", args: [voter] }),
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "proposalState", args: [proposalId] }),
    ]);
    assertMainnetCommitReady({ paused, member, proposalState: state });
    const nullifier = await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "voteNullifier", args: [proposalId, voter] });
    const alreadyCommitted = await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "ballotCommitments", args: [proposalId, nullifier] });
    assert.equal(alreadyCommitted, `0x${"0".repeat(64)}`, "This wallet already committed a ballot for this proposal.");
    const salt = `0x${randomBytes(32).toString("hex")}`;
    const commitment = await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "ballotCommitment", args: [proposalId, voter, voteType, salt] });
    const ballot = { format: "gyevo-dao-phase2-ballot-v1", chainId: CHAIN_ID, governance: ctx.governance,
      voter, proposalId: proposalId.toString(), voteType, salt, commitment, nullifier };
    const saveBallot = options.execute ? () => writePrivate(ballotFile, ballot) : undefined;
    await writeGuarded(ctx, command, voter, ctx.governance, govAbi, "commitVote", [proposalId, commitment], options,
      async () => (await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "ballotCommitments", args: [proposalId, nullifier] })).toLowerCase() === commitment.toLowerCase(),
      undefined, saveBallot);
    console.log(options.execute ? `Private reveal file saved with mode 0600: ${path.resolve(ballotFile)}. Keep it until reveal; its contents were not printed.` : "Simulation only. No ballot file was written and no transaction was signed or submitted.");
    return;
  }
  if (command === "reveal-vote") {
    assert.ok(positional[0], "Use reveal-vote <private-ballot-file> --voter-address <address>.");
    const ballot = secureRead(positional[0], (value) => parsePhase2Ballot(value, CHAIN_ID));
    const voterValue = options.voterAddress ?? ballot.voter;
    assert.ok(isAddress(voterValue), "Provide a valid --voter-address.");
    const voter = getAddress(voterValue), ctx = await getContext(true);
    assert.equal(ballot.governance.toLowerCase(), ctx.governance.toLowerCase(), "Ballot belongs to a different Mainnet governance address.");
    assert.equal(ballot.voter.toLowerCase(), voter.toLowerCase(), "Ballot belongs to a different voter.");
    const proposalId = BigInt(ballot.proposalId);
    const [state, expectedCommitment, expectedNullifier] = await Promise.all([
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "proposalState", args: [proposalId] }),
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "ballotCommitment", args: [proposalId, voter, ballot.voteType, ballot.salt] }),
      ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "voteNullifier", args: [proposalId, voter] }),
    ]);
    const stored = await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "ballotCommitments", args: [proposalId, ballot.nullifier] });
    const revealed = await ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "ballotRevealed", args: [proposalId, ballot.nullifier] });
    assertMainnetRevealReady({ proposalState: state, expectedCommitment, ballotCommitment: ballot.commitment,
      expectedNullifier, ballotNullifier: ballot.nullifier, storedCommitment: stored, revealed });
    const voteName = ["against", "for", "abstain"][ballot.voteType];
    await writeGuarded(ctx, command, voter, ctx.governance, govAbi, "revealVote", [proposalId, ballot.voteType, ballot.salt], options,
      async () => ctx.client.readContract({ address: ctx.governance, abi: govAbi, functionName: "ballotRevealed", args: [proposalId, ballot.nullifier] }));
    console.log(`Reveal ${voteName} · proposal ${proposalId}. The choice is now public and linkable to the voter.`);
    return;
  }
  if (command === "unpause") {
    assert.ok(["reputation", "governance"].includes(positional[0]), "Use unpause reputation or unpause governance.");
    const ctx = await getContext(true), target = positional[0] === "reputation" ? ctx.reputation : ctx.governance;
    const abi = positional[0] === "reputation" ? repAbi : govAbi, actor = requiredAddress("RH_MAINNET_ADMIN_ADDRESS");
    const paused = await ctx.client.readContract({ address: target, abi, functionName: "paused" });
    assert.equal(paused, true, "Target already active; refusing duplicate unpause.");
    const authCommand = "unpause-" + positional[0];
    return writeGuarded(ctx, authCommand, actor, target, abi, "unpause", [], options,
      async () => !(await ctx.client.readContract({ address: target, abi, functionName: "paused" })));
  }
  console.log("Unknown operator command: " + command);
  process.exitCode = 2;
}

if (import.meta.main) main().catch((error) => {
  const message = String(error?.message ?? error);
  const rpcUrl = process.env.RH_MAINNET_RPC_URL?.trim();
  console.error("Mainnet DAO Phase 2 operator stopped: " + (rpcUrl ? message.replaceAll(rpcUrl, "<configured Mainnet RPC>") : message));
  process.exitCode = 1;
});
