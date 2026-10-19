#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { isAddress, isAddressEqual, parseAbi } from "viem";
import { robinhoodMainnetDemoContracts, ROBINHOOD_MAINNET_CHAIN_ID } from "../src/lib/config/robinhood-mainnet-demo.ts";
import { createVerifiedMainnetClient, getMainnetRpcCandidates, redactMainnetRpcUrls } from "./robinhood-mainnet-rpc.mjs";

const ROOT = process.cwd();
const ARTIFACT_PATH = path.join(ROOT, "contracts/broadcast/DeployRobinhoodMainnetDaoPhase2.s.sol/4663/run-latest.json");
const EXPLORER = "https://robinhoodchain.blockscout.com";
const EXPECTED = ["RobinhoodMainnetDemoLendingReputation", "RobinhoodMainnetDemoGovernancePhase2"];
const reputationAbi = parseAbi([
  "function lendingPool() view returns (address)", "function paused() view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)", "function REPUTATION_ISSUER_ROLE() view returns (bytes32)",
  "function PAUSER_ROLE() view returns (bytes32)", "function hasRole(bytes32,address) view returns (bool)",
  "function demoOnly() view returns (bool)",
]);
const governanceAbi = parseAbi([
  "function credentialRegistry() view returns (address)", "function reputationRegistry() view returns (address)",
  "function eligibilityVerifier() view returns (address)", "function commitPeriod() view returns (uint64)",
  "function revealPeriod() view returns (uint64)", "function executionWindow() view returns (uint64)",
  "function quorum() view returns (uint256)", "function minimumReputation() view returns (uint256)",
  "function paused() view returns (bool)", "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function PAUSER_ROLE() view returns (bytes32)", "function hasRole(bytes32,address) view returns (bool)",
  "function demoOnly() view returns (bool)",
]);
const markerAbi = parseAbi(["function demoOnly() view returns (bool)"]);

function fail(message) { console.error(`DAO Phase 2 status failed: ${message}`); process.exitCode = 1; }
export function parseDeploymentArtifact(artifact, deployer) {
  assert.equal(Number(artifact.chain), ROBINHOOD_MAINNET_CHAIN_ID, "artifact chain is not 4663");
  assert.ok(deployer && isAddress(deployer), "configured Mainnet deployer address is required");
  const deployed = {};
  for (const name of EXPECTED) {
    const tx = artifact.transactions?.find((item) => item.transactionType === "CREATE" && item.contractName === name);
    assert.ok(tx, `missing ${name} CREATE record`);
    assert.ok(tx.hash, `${name} CREATE record has no transaction hash`);
    // Forge can omit `from` in broadcast artifacts. Keep any recorded sender
    // as an additional assertion, and always verify the canonical RPC sender.
    if (tx.from) assert.ok(isAddressEqual(tx.from, deployer), `${name} artifact sender differs from the configured Mainnet deployer`);
    const receipt = artifact.receipts?.find((item) => item.transactionHash?.toLowerCase() === tx.hash?.toLowerCase());
    assert.ok(receipt && receipt.status === "0x1", `${name} receipt is missing or unsuccessful`);
    const address = receipt.contractAddress ?? tx.contractAddress;
    assert.ok(address, `${name} receipt has no contract address`);
    if (receipt.from) assert.ok(isAddressEqual(receipt.from, deployer), `${name} artifact receipt sender differs from the configured Mainnet deployer`);
    deployed[name] = {
      address,
      hash: tx.hash,
      artifactFrom: tx.from ?? receipt.from ?? undefined,
      blockNumber: BigInt(receipt.blockNumber),
      blockHash: receipt.blockHash,
    };
  }
  return deployed;
}

export function assertCanonicalDeployment({ name, item, transaction, receipt, deployer }) {
  assert.ok(deployer && isAddress(deployer), "configured Mainnet deployer address is required");
  assert.ok(transaction, `${name} canonical Mainnet transaction is unavailable`);
  assert.ok(transaction.from && isAddressEqual(transaction.from, deployer), `${name} canonical RPC sender differs from the configured Mainnet deployer`);
  if (item.artifactFrom) assert.ok(isAddressEqual(transaction.from, item.artifactFrom), `${name} canonical RPC sender differs from the artifact sender`);
  if (transaction.chainId != null) assert.equal(transaction.chainId, ROBINHOOD_MAINNET_CHAIN_ID, `${name} transaction chain ID is not 4663`);
  assert.equal(transaction.to, null, `${name} transaction is not a contract creation`);
  assert.ok(receipt, `${name} canonical Mainnet receipt is unavailable`);
  assert.equal(receipt.transactionHash.toLowerCase(), item.hash.toLowerCase(), `${name} live receipt transaction hash differs from the artifact`);
  assert.equal(receipt.status, "success", `${name} live Mainnet receipt failed`);
  assert.ok(receipt.contractAddress && isAddressEqual(receipt.contractAddress, item.address), `${name} live receipt address differs from the recorded artifact`);
  assert.equal(receipt.blockNumber, item.blockNumber, `${name} live receipt block differs from the recorded artifact`);
  if (item.blockHash) assert.equal(receipt.blockHash.toLowerCase(), item.blockHash.toLowerCase(), `${name} live receipt block hash differs from the recorded artifact`);
  assert.equal(transaction.blockHash, receipt.blockHash, `${name} transaction and receipt are not in the same canonical block`);
  return true;
}

function readArtifact() {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    console.log("Robinhood Mainnet DAO Phase 2: NOT DEPLOYED");
    console.log(`No deployment artifact at ${path.relative(ROOT, ARTIFACT_PATH)}.`);
    return undefined;
  }
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
  return parseDeploymentArtifact(artifact, process.env.RH_MAINNET_DEPLOYER_ADDRESS);
}

async function blockscoutSourceStatus(address) {
  try {
    const response = await fetch(`${EXPLORER}/api?module=contract&action=getsourcecode&address=${address}`, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return `unavailable (HTTP ${response.status})`;
    const body = await response.json();
    const row = Array.isArray(body.result) ? body.result[0] : undefined;
    if (!row || !isAddressEqual(row.Address, address)) return "no matching Blockscout record";
    return typeof row.SourceCode === "string" && row.SourceCode.trim() && row.ABI && row.ABI !== "Contract source code not verified"
      ? "source verified"
      : "source not verified";
  } catch { return "unavailable"; }
}

async function runStatus() {
const deployment = readArtifact();
if (deployment) {
  console.log("Robinhood Mainnet DAO Phase 2 · chain 4663 · recorded deployment receipts");
  for (const name of EXPECTED) {
    const item = deployment[name];
    console.log(`${name}: ${item.address}`);
    console.log(`  receipt: ${item.hash} · block ${item.blockNumber.toString()} · SUCCESS (local Foundry artifact)`);
  }
  try {
    const { client, selected } = await createVerifiedMainnetClient({
      primaryUrl: process.env.RH_MAINNET_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL,
      fallbackUrl: process.env.RH_MAINNET_RPC_FALLBACK_URL || process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_FALLBACK_URL,
      fallbackApiKey: process.env.RH_MAINNET_RPC_FALLBACK_API_KEY || process.env.BLOCKVECTRA_API_KEY,
      requiredCapabilities: ["read", "simulation", "receipt"],
    });
    const actualChain = await client.getChainId();
    assert.equal(actualChain, ROBINHOOD_MAINNET_CHAIN_ID, `RPC returned chain ${actualChain}`);
    const repAddress = deployment.RobinhoodMainnetDemoLendingReputation.address;
    const govAddress = deployment.RobinhoodMainnetDemoGovernancePhase2.address;
    const liveReceipts = await Promise.all(EXPECTED.map(async (name) => {
      const item = deployment[name];
      const [transaction, receipt] = await Promise.all([
        client.getTransaction({ hash: item.hash }),
        client.getTransactionReceipt({ hash: item.hash }),
      ]);
      assertCanonicalDeployment({ name, item, transaction, receipt, deployer: process.env.RH_MAINNET_DEPLOYER_ADDRESS });
      return receipt;
    }));
    const targets = [
      repAddress, govAddress,
      robinhoodMainnetDemoContracts.credentialRegistry,
      robinhoodMainnetDemoContracts.verifierAdapter,
      robinhoodMainnetDemoContracts.lendingPool,
    ];
    const codes = await Promise.all(targets.map((address) => client.getBytecode({ address })));
    assert.ok(codes.every((code) => code && code !== "0x"), "one or more configured Mainnet contracts have no runtime bytecode");

    const [pool, registry, rep, verifier, repPaused, govPaused, repDemo, govDemo, registryDemo, poolDemo,
      commitPeriod, revealPeriod, executionWindow, quorum, minimumReputation] = await Promise.all([
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "lendingPool" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "credentialRegistry" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "reputationRegistry" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "eligibilityVerifier" }),
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "paused" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "paused" }),
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "demoOnly" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "demoOnly" }),
      client.readContract({ address: robinhoodMainnetDemoContracts.credentialRegistry, abi: markerAbi, functionName: "demoOnly" }),
      client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: markerAbi, functionName: "demoOnly" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "commitPeriod" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "revealPeriod" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "executionWindow" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "quorum" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "minimumReputation" }),
    ]);
    assert.ok(isAddressEqual(pool, robinhoodMainnetDemoContracts.lendingPool), "reputation source is not the registered Mainnet demo pool");
    assert.ok(isAddressEqual(registry, robinhoodMainnetDemoContracts.credentialRegistry), "governance registry is not the Mainnet demo registry");
    assert.ok(isAddressEqual(rep, repAddress), "governance does not reference this reputation deployment");
    assert.ok(isAddressEqual(verifier, robinhoodMainnetDemoContracts.verifierAdapter), "governance verifier is not the registered Mainnet adapter");
    assert.ok(repDemo && govDemo && registryDemo && poolDemo, "a Mainnet dependency is not marked demo-only");
    assert.ok(repPaused && govPaused, "Mainnet DAO Phase 2 must remain paused after deployment");

    const configuredParameters = [
      ["RH_MAINNET_PHASE2_COMMIT_PERIOD", commitPeriod],
      ["RH_MAINNET_PHASE2_REVEAL_PERIOD", revealPeriod],
      ["RH_MAINNET_PHASE2_EXECUTION_WINDOW", executionWindow],
      ["RH_MAINNET_PHASE2_QUORUM", quorum],
      ["RH_MAINNET_PHASE2_MINIMUM_REPUTATION", minimumReputation],
    ];
    for (const [name, actual] of configuredParameters) {
      const configured = process.env[name];
      assert.ok(configured && /^\d+$/.test(configured), `${name} is required for live parameter readback`);
      assert.equal(BigInt(actual), BigInt(configured), `${name} differs from Mainnet state`);
    }

    const admin = process.env.RH_MAINNET_ADMIN_ADDRESS;
    const deployer = process.env.RH_MAINNET_DEPLOYER_ADDRESS;
    const membershipIssuer = process.env.RH_MAINNET_ISSUER_ADDRESS;
    const repIssuer = process.env.RH_MAINNET_RISK_ADMIN_ADDRESS;
    const pauseAuthority = process.env.RH_MAINNET_PAUSE_AUTHORITY_ADDRESS;
    assert.ok(deployer && admin && membershipIssuer && repIssuer && pauseAuthority, "role readback requires configured Mainnet deployer, admin, issuer, risk-admin, and pause addresses");
    const roles = [deployer, admin, membershipIssuer, repIssuer, pauseAuthority];
    assert.equal(new Set(roles.map((address) => address.toLowerCase())).size, roles.length, "Mainnet Phase 2 operational roles must be distinct");
    const [repAdminRole, repIssuerRole, repPauseRole, govAdminRole, govPauseRole, credentialIssuerRole] = await Promise.all([
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "DEFAULT_ADMIN_ROLE" }),
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "REPUTATION_ISSUER_ROLE" }),
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "PAUSER_ROLE" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "DEFAULT_ADMIN_ROLE" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "PAUSER_ROLE" }),
      client.readContract({ address: robinhoodMainnetDemoContracts.credentialRegistry, abi: parseAbi(["function ISSUER_ROLE() view returns (bytes32)"]), functionName: "ISSUER_ROLE" }),
    ]);
    const roleChecks = await Promise.all([
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "hasRole", args: [repAdminRole, admin] }),
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "hasRole", args: [repIssuerRole, repIssuer] }),
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "hasRole", args: [repPauseRole, pauseAuthority] }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "hasRole", args: [govAdminRole, admin] }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "hasRole", args: [govPauseRole, pauseAuthority] }),
      client.readContract({ address: robinhoodMainnetDemoContracts.credentialRegistry, abi: parseAbi(["function hasRole(bytes32,address) view returns (bool)"]), functionName: "hasRole", args: [credentialIssuerRole, membershipIssuer] }),
    ]);
    assert.ok(roleChecks.every(Boolean), "a configured Mainnet Phase 2 role does not match on-chain state");
    console.log(`Live RPC (${selected.label}; ${Object.entries(selected.capabilities).filter(([, ok]) => ok).map(([name]) => name).join("/")}): chain ${actualChain} · confirmed deployment receipts ${liveReceipts.length}/2 · runtime bytecode 5/5 · dependencies match · demo-only markers confirmed`);
    console.log("Live paused state: reputation PAUSED · governance PAUSED · configured admin, issuer, and pause roles confirmed");
    console.log(`Live governance parameters: commit ${commitPeriod}s · reveal ${revealPeriod}s · execution ${executionWindow}s · quorum ${quorum} · reputation ${minimumReputation}`);
    console.log(`Explorer: ${EXPLORER}/address/${govAddress} · ${EXPLORER}/address/${repAddress}`);
    const [repSource, govSource] = await Promise.all([blockscoutSourceStatus(repAddress), blockscoutSourceStatus(govAddress)]);
    console.log(`Blockscout source status: reputation ${repSource} · governance ${govSource} (runtime bytecode does not imply source verification).`);
    const registeredRep = process.env.RH_MAINNET_PHASE2_REPUTATION_REGISTRY_ADDRESS;
    const registeredGov = process.env.RH_MAINNET_PHASE2_GOVERNANCE_ADDRESS;
    const publicRep = process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_REPUTATION_REGISTRY_CONTRACT;
    const publicGov = process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_GOVERNANCE_CONTRACT;
    for (const [label, configured, actual] of [
      ["RH_MAINNET_PHASE2_REPUTATION_REGISTRY_ADDRESS", registeredRep, repAddress],
      ["RH_MAINNET_PHASE2_GOVERNANCE_ADDRESS", registeredGov, govAddress],
      ["NEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_REPUTATION_REGISTRY_CONTRACT", publicRep, repAddress],
      ["NEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_GOVERNANCE_CONTRACT", publicGov, govAddress],
    ]) {
      if (configured) assert.ok(isAddressEqual(configured, actual), `${label} does not match the confirmed receipt address`);
    }
    console.log(`Receipt-derived environment values:\nRH_MAINNET_PHASE2_REPUTATION_REGISTRY_ADDRESS=${repAddress}\nRH_MAINNET_PHASE2_GOVERNANCE_ADDRESS=${govAddress}\nNEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_REPUTATION_REGISTRY_CONTRACT=${repAddress}\nNEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_GOVERNANCE_CONTRACT=${govAddress}`);
  } catch (error) {
    const message = error instanceof Error ? redactMainnetRpcUrls(error.message, getMainnetRpcCandidates()) : "unknown read error";
    fail(`live verification unavailable or failed: ${message}`);
  }
}
}

if (import.meta.main) {
  runStatus().catch((error) => {
    const message = error instanceof Error ? redactMainnetRpcUrls(error.message, getMainnetRpcCandidates()) : "unknown read error";
    fail(`live verification unavailable or failed: ${message}`);
  });
}
