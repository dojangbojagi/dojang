#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createPublicClient, defineChain, http, isAddressEqual, parseAbi } from "viem";
import { robinhoodMainnetDemoContracts, ROBINHOOD_MAINNET_CHAIN_ID } from "../src/lib/config/robinhood-mainnet-demo.ts";

const ROOT = process.cwd();
const ARTIFACT_PATH = path.join(ROOT, "contracts/broadcast/DeployRobinhoodMainnetDaoPhase2.s.sol/4663/run-latest.json");
const RPC = process.env.RH_MAINNET_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
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
function readArtifact() {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    console.log("Robinhood Mainnet DAO Phase 2: NOT DEPLOYED");
    console.log(`No deployment artifact at ${path.relative(ROOT, ARTIFACT_PATH)}.`);
    return undefined;
  }
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
  assert.equal(Number(artifact.chain), ROBINHOOD_MAINNET_CHAIN_ID, "artifact chain is not 4663");
  const deployed = {};
  for (const name of EXPECTED) {
    const tx = artifact.transactions?.find((item) => item.transactionType === "CREATE" && item.contractName === name);
    assert.ok(tx, `missing ${name} CREATE record`);
    const receipt = artifact.receipts?.find((item) => item.transactionHash?.toLowerCase() === tx.hash?.toLowerCase());
    assert.ok(receipt && receipt.status === "0x1", `${name} receipt is missing or unsuccessful`);
    const address = receipt.contractAddress ?? tx.contractAddress;
    assert.ok(address, `${name} receipt has no contract address`);
    deployed[name] = { address, hash: tx.hash, blockNumber: BigInt(receipt.blockNumber) };
  }
  return deployed;
}

const deployment = readArtifact();
if (deployment) {
  console.log("Robinhood Mainnet DAO Phase 2 · chain 4663 · recorded deployment receipts");
  for (const name of EXPECTED) {
    const item = deployment[name];
    console.log(`${name}: ${item.address}`);
    console.log(`  receipt: ${item.hash} · block ${item.blockNumber.toString()} · SUCCESS (local Foundry artifact)`);
  }
  const chain = defineChain({
    id: ROBINHOOD_MAINNET_CHAIN_ID,
    name: "Robinhood Chain Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC] } },
  });
  const client = createPublicClient({ chain, transport: http(RPC, { timeout: 15_000, retryCount: 1 }) });
  try {
    const actualChain = await client.getChainId();
    assert.equal(actualChain, ROBINHOOD_MAINNET_CHAIN_ID, `RPC returned chain ${actualChain}`);
    const repAddress = deployment.RobinhoodMainnetDemoLendingReputation.address;
    const govAddress = deployment.RobinhoodMainnetDemoGovernancePhase2.address;
    const targets = [
      repAddress, govAddress,
      robinhoodMainnetDemoContracts.credentialRegistry,
      robinhoodMainnetDemoContracts.verifierAdapter,
      robinhoodMainnetDemoContracts.lendingPool,
    ];
    const codes = await Promise.all(targets.map((address) => client.getBytecode({ address })));
    assert.ok(codes.every((code) => code && code !== "0x"), "one or more configured Mainnet contracts have no runtime bytecode");

    const [pool, registry, rep, verifier, repPaused, govPaused, repDemo, govDemo, registryDemo, poolDemo] = await Promise.all([
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
    ]);
    assert.ok(isAddressEqual(pool, robinhoodMainnetDemoContracts.lendingPool), "reputation source is not the registered Mainnet demo pool");
    assert.ok(isAddressEqual(registry, robinhoodMainnetDemoContracts.credentialRegistry), "governance registry is not the Mainnet demo registry");
    assert.ok(isAddressEqual(rep, repAddress), "governance does not reference this reputation deployment");
    assert.ok(isAddressEqual(verifier, robinhoodMainnetDemoContracts.verifierAdapter), "governance verifier is not the registered Mainnet adapter");
    assert.ok(repDemo && govDemo && registryDemo && poolDemo, "a Mainnet dependency is not marked demo-only");
    assert.ok(repPaused && govPaused, "Mainnet DAO Phase 2 must remain paused after deployment");

    const admin = process.env.RH_MAINNET_ADMIN_ADDRESS;
    const repIssuer = process.env.RH_MAINNET_RISK_ADMIN_ADDRESS;
    const pauseAuthority = process.env.RH_MAINNET_PAUSE_AUTHORITY_ADDRESS;
    assert.ok(admin && repIssuer && pauseAuthority, "role readback requires configured Mainnet admin, risk-admin, and pause addresses");
    const [repAdminRole, repIssuerRole, repPauseRole, govAdminRole, govPauseRole] = await Promise.all([
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "DEFAULT_ADMIN_ROLE" }),
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "REPUTATION_ISSUER_ROLE" }),
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "PAUSER_ROLE" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "DEFAULT_ADMIN_ROLE" }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "PAUSER_ROLE" }),
    ]);
    const roleChecks = await Promise.all([
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "hasRole", args: [repAdminRole, admin] }),
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "hasRole", args: [repIssuerRole, repIssuer] }),
      client.readContract({ address: repAddress, abi: reputationAbi, functionName: "hasRole", args: [repPauseRole, pauseAuthority] }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "hasRole", args: [govAdminRole, admin] }),
      client.readContract({ address: govAddress, abi: governanceAbi, functionName: "hasRole", args: [govPauseRole, pauseAuthority] }),
    ]);
    assert.ok(roleChecks.every(Boolean), "a configured Mainnet Phase 2 role does not match on-chain state");
    console.log(`Live RPC: chain ${actualChain} · runtime bytecode 5/5 · dependencies match · demo-only markers confirmed`);
    console.log("Live paused state: reputation PAUSED · governance PAUSED · configured admin, issuer, and pause roles confirmed");
    console.log(`Explorer: ${EXPLORER}/address/${govAddress} · ${EXPLORER}/address/${repAddress}`);
    console.log("Source verification is not inferred from runtime bytecode; check each Blockscout source page separately.");
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(RPC, "<configured Mainnet RPC>") : "unknown read error";
    fail(`live verification unavailable or failed: ${message}`);
  }
}
