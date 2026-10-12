#!/usr/bin/env bun
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, defineChain, getAddress, http, isAddress, keccak256 } from "viem";

const ROOT = process.cwd();
const CONTRACTS = path.join(ROOT, "contracts");
const CHAIN_ID = 46_630;
const EXPLORER = "https://explorer.testnet.chain.robinhood.com";
const VERIFY_API = `${EXPLORER}/api?`;
const DEPLOYMENT = path.join(CONTRACTS, "broadcast/DeployRobinhoodProtocolStack.s.sol/46630/run-latest.json");
const artifactPath = {
  ZKTranscriptLib: "out/EligibilityHonkVerifier.sol/ZKTranscriptLib.json",
  RelationsLib: "out/EligibilityHonkVerifier.sol/RelationsLib.json",
  HonkVerifier: "out/EligibilityHonkVerifier.sol/HonkVerifier.json",
  EligibilityVerifierAdapter: "out/EligibilityVerifierAdapter.sol/EligibilityVerifierAdapter.json",
  RobinhoodDemoCredentialRegistry: "out/RobinhoodDemoCredentialRegistry.sol/RobinhoodDemoCredentialRegistry.json",
  ControlledTestOracle: "out/ControlledTestOracle.sol/ControlledTestOracle.json",
  rUSD2: "out/ControlledTestToken.sol/ControlledTestToken.json",
  rCOL2: "out/ControlledTestToken.sol/ControlledTestToken.json",
  LendingPoolV2: "out/LendingPoolV2.sol/LendingPoolV2.json",
  RobinhoodGovernancePhase1: "out/RobinhoodGovernancePhase1.sol/RobinhoodGovernancePhase1.json",
};
const sourcePath = {
  ZKTranscriptLib: "src/generated/EligibilityHonkVerifier.sol:ZKTranscriptLib",
  RelationsLib: "src/generated/EligibilityHonkVerifier.sol:RelationsLib",
  HonkVerifier: "src/generated/EligibilityHonkVerifier.sol:HonkVerifier",
  EligibilityVerifierAdapter: "src/EligibilityVerifierAdapter.sol:EligibilityVerifierAdapter",
  RobinhoodDemoCredentialRegistry: "src/RobinhoodDemoCredentialRegistry.sol:RobinhoodDemoCredentialRegistry",
  ControlledTestOracle: "src/ControlledTestOracle.sol:ControlledTestOracle",
  rUSD2: "src/ControlledTestToken.sol:ControlledTestToken",
  rCOL2: "src/ControlledTestToken.sol:ControlledTestToken",
  LendingPoolV2: "src/LendingPoolV2.sol:LendingPoolV2",
  RobinhoodGovernancePhase1: "src/RobinhoodGovernancePhase1.sol:RobinhoodGovernancePhase1",
};
const names = Object.keys(artifactPath);

function sameAddress(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }
function strip0x(value) { return String(value).replace(/^0x/i, ""); }
function hex(value) { return `0x${strip0x(value)}`; }
function receiptFor(deployment, entry) {
  const receipt = deployment.receipts.find((item) => item.transactionHash.toLowerCase() === entry.hash.toLowerCase());
  assert.ok(receipt && receipt.status === "0x1", `Missing successful receipt for ${entry.hash}`);
  return receipt;
}
function deployAddress(entry, receipt) {
  const address = receipt.contractAddress ?? entry.contractAddress;
  assert.ok(address && isAddress(address), `No deployment address for ${entry.hash}`);
  return getAddress(address);
}
function linkBytecode(bytecodeObject, references, libraries) {
  let object = strip0x(bytecodeObject);
  for (const [source, byName] of Object.entries(references ?? {})) {
    for (const [library, locations] of Object.entries(byName)) {
      const address = libraries[library];
      assert.ok(address, `Missing deployed library ${source}:${library}`);
      for (const location of locations) {
        const start = location.start * 2;
        const length = location.length * 2;
        object = `${object.slice(0, start)}${strip0x(address).toLowerCase().padStart(length, "0")}${object.slice(start + length)}`;
      }
    }
  }
  assert.ok(!object.includes("__$"), "Unresolved linked-library placeholder remains in bytecode.");
  return object.toLowerCase();
}
function maskImmutables(object, immutableReferences) {
  let normalized = object;
  for (const locations of Object.values(immutableReferences ?? {})) {
    for (const location of locations) {
      const start = location.start * 2;
      const length = location.length * 2;
      normalized = `${normalized.slice(0, start)}${"0".repeat(length)}${normalized.slice(start + length)}`;
    }
  }
  return normalized;
}
function maskLibrarySelfAddress(actual, expected, address, name) {
  if (!new Set(["ZKTranscriptLib", "RelationsLib"]).has(name)) return [actual, expected];
  const actualPrefix = `73${strip0x(address).toLowerCase()}3014`;
  const expectedPrefix = `73${"0".repeat(40)}3014`;
  assert.ok(actual.startsWith(actualPrefix), `${name} deployed runtime does not contain its receipt-derived self address.`);
  assert.ok(expected.startsWith(expectedPrefix), `${name} compiled artifact is missing the expected Solidity library self-address placeholder.`);
  return [`73${"0".repeat(40)}3014${actual.slice(actualPrefix.length)}`, expected];
}
function loadArtifacts(deployment) {
  const created = deployment.transactions.filter((entry) => entry.transactionType === "CREATE");
  const find = (contractName) => {
    const entries = created.filter((entry) => entry.contractName === contractName);
    assert.equal(entries.length, 1, `Expected exactly one ${contractName} creation.`);
    return { entry: entries[0], receipt: receiptFor(deployment, entries[0]) };
  };
  const adapter = find("EligibilityVerifierAdapter");
  const tokens = created.filter((entry) => entry.contractName === "ControlledTestToken");
  const rusd = tokens.find((entry) => entry.arguments?.[1] === "rUSD2");
  const rcol = tokens.find((entry) => entry.arguments?.[1] === "rCOL2");
  assert.ok(rusd && rcol, "Could not identify demo tokens from their constructor symbols.");
  const byName = {
    ZKTranscriptLib: find("ZKTranscriptLib"),
    RelationsLib: find("RelationsLib"),
    HonkVerifier: null,
    EligibilityVerifierAdapter: adapter,
    RobinhoodDemoCredentialRegistry: find("RobinhoodDemoCredentialRegistry"),
    ControlledTestOracle: find("ControlledTestOracle"),
    rUSD2: { entry: rusd, receipt: receiptFor(deployment, rusd) },
    rCOL2: { entry: rcol, receipt: receiptFor(deployment, rcol) },
    LendingPoolV2: find("LendingPoolV2"),
    RobinhoodGovernancePhase1: find("RobinhoodGovernancePhase1"),
  };
  const libraryAddresses = {
    ZKTranscriptLib: deployAddress(byName.ZKTranscriptLib.entry, byName.ZKTranscriptLib.receipt),
    RelationsLib: deployAddress(byName.RelationsLib.entry, byName.RelationsLib.receipt),
  };
  const verifierArtifact = JSON.parse(fs.readFileSync(path.join(CONTRACTS, artifactPath.HonkVerifier), "utf8"));
  const verifierCreation = linkBytecode(verifierArtifact.bytecode.object, verifierArtifact.bytecode.linkReferences, libraryAddresses);
  const verifierCandidates = created.filter((entry) => !entry.contractName && strip0x(entry.transaction.input).toLowerCase().startsWith(verifierCreation));
  assert.equal(verifierCandidates.length, 1, "Could not derive HonkVerifier from its linked creation bytecode.");
  byName.HonkVerifier = { entry: verifierCandidates[0], receipt: receiptFor(deployment, verifierCandidates[0]) };
  assert.ok(sameAddress(adapter.entry.arguments[0], deployAddress(byName.HonkVerifier.entry, byName.HonkVerifier.receipt)), "Adapter constructor does not reference the receipt-derived HonkVerifier.");
  return { byName, libraryAddresses };
}

async function checkSourceStatus(address) {
  const url = `${VERIFY_API}module=contract&action=getsourcecode&address=${address}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return `unavailable HTTP ${response.status}`;
    const body = await response.json();
    const row = Array.isArray(body.result) ? body.result[0] : undefined;
    if (!row || !sameAddress(row.Address, address)) return "no matching Blockscout record";
    return typeof row.SourceCode === "string" && row.SourceCode.trim() && row.ABI && row.ABI !== "Contract source code not verified"
      ? "source verified"
      : "source not verified";
  } catch (error) {
    return `unavailable (${error instanceof Error ? error.message : "request failed"})`;
  }
}

function verificationCommand(name, address, constructorArgs, libraries) {
  const args = [
    "forge verify-contract", address, sourcePath[name],
    "--profile robinhood_testnet", "--chain 46630", "--compiler-version 0.8.28",
    "--evm-version prague", "--num-of-optimizations 200", "--verifier blockscout",
    `--verifier-url '${VERIFY_API}'`,
  ];
  if (constructorArgs.length > 2) args.push(`--constructor-args ${hex(constructorArgs)}`);
  for (const [library, libraryAddress] of Object.entries(libraries)) {
    args.push(`--libraries '${sourcePath[library]}'`);
  }
  // Correct Foundry linker syntax is source.sol:Library:address.
  const rendered = args.join(" ");
  const corrected = rendered.replace(/--libraries '([^']+)'/g, (_, libraryIdentifier) => {
    const [sourceFile, libraryName] = libraryIdentifier.split(":");
    const symbol = libraryName;
    const addressForLibrary = libraries[symbol];
    return `--libraries '${sourceFile}:${symbol}:${addressForLibrary}'`;
  });
  return `cd contracts && ${corrected}`;
}

async function main() {
  assert.ok(fs.existsSync(DEPLOYMENT), `Missing deployment receipt artifact: ${DEPLOYMENT}`);
  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT, "utf8"));
  assert.equal(Number(deployment.chain), CHAIN_ID, "Deployment artifact is not chain 46630.");
  const { byName, libraryAddresses } = loadArtifacts(deployment);
  const rpcUrl = process.env.RH_TESTNET_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL;
  assert.ok(rpcUrl, "Set RH_TESTNET_RPC_URL or NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL.");
  const chain = defineChain({ id: CHAIN_ID, name: "Robinhood Chain Testnet", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
  const client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 1, timeout: 30_000 }) });
  assert.equal(await client.getChainId(), CHAIN_ID, "RPC is not Robinhood Testnet.");
  const head = await client.getBlockNumber();
  const details = [];
  for (const name of names) {
    const { entry, receipt } = byName[name];
    const address = deployAddress(entry, receipt);
    const artifact = JSON.parse(fs.readFileSync(path.join(CONTRACTS, artifactPath[name]), "utf8"));
    const initExpected = linkBytecode(artifact.bytecode.object, artifact.bytecode.linkReferences, libraryAddresses);
    const initObserved = strip0x(entry.transaction.input).toLowerCase();
    assert.ok(initObserved.startsWith(initExpected), `${name} deployment initcode does not match current compiled source artifact.`);
    const constructorArgs = `0x${initObserved.slice(initExpected.length)}`;
    const runtimeObserved = await client.getBytecode({ address });
    assert.ok(runtimeObserved && runtimeObserved !== "0x", `${name} has no on-chain runtime bytecode.`);
    const runtimeExpected = linkBytecode(artifact.deployedBytecode.object, artifact.deployedBytecode.linkReferences, libraryAddresses);
    assert.equal(strip0x(runtimeObserved).length, runtimeExpected.length, `${name} runtime bytecode length differs from compiled artifact.`);
    const mask = artifact.deployedBytecode.immutableReferences;
    const normalizedExpected = maskImmutables(runtimeExpected, mask);
    const [runtimeWithSelfAddressMasked] = maskLibrarySelfAddress(strip0x(runtimeObserved).toLowerCase(), normalizedExpected, address, name);
    const normalizedActual = maskImmutables(runtimeWithSelfAddressMasked, mask);
    if (normalizedActual !== normalizedExpected) {
      throw new Error(`${name} deployed runtime differs from compiled artifact (actual ${keccak256(`0x${normalizedActual}`)}, expected ${keccak256(`0x${normalizedExpected}`)}).`);
    }
    const receiptOnRpc = await client.getTransactionReceipt({ hash: entry.hash });
    assert.equal(receiptOnRpc.status, "success", `${name} creation receipt failed on RPC.`);
    assert.ok(sameAddress(receiptOnRpc.contractAddress, address), `${name} receipt address mismatch.`);
    const compiler = artifact.metadata.compiler.version;
    const settings = artifact.metadata.settings;
    assert.equal(compiler, "0.8.28+commit.7893614a", `${name} compiler version mismatch.`);
    assert.equal(settings.evmVersion, "prague", `${name} EVM version mismatch.`);
    assert.equal(settings.optimizer.enabled, true, `${name} optimizer is not enabled.`);
    assert.equal(settings.optimizer.runs, 200, `${name} optimizer runs mismatch.`);
    const linkedForVerify = name === "HonkVerifier" ? libraryAddresses : {};
    details.push({ name, address, hash: entry.hash, constructorArgs, compiler, runtimeHash: keccak256(runtimeObserved), linkedForVerify });
  }
  console.log(`PASS source-to-bytecode parity · chain ${CHAIN_ID} · block ${head} · 10 initcodes, receipts, and deployed runtimes match compiled artifacts`);
  console.log("Compiler evidence: solc 0.8.28+commit.7893614a · Prague · optimizer enabled · 200 runs.");
  console.log("Immutable regions were normalized only for constructor-bound runtime values; linked libraries were filled from receipt-derived deployed addresses.");
  console.log("\nBlockscout status and prepared verification commands (commands are printed, never executed):");
  for (const item of details) {
    const status = await checkSourceStatus(item.address);
    console.log(`${item.name}\t${item.address}\t${status}`);
    console.log(`  ${verificationCommand(item.name, item.address, item.constructorArgs, item.linkedForVerify)}`);
  }
  console.log("\nVerification submission is intentionally not performed by this read-only command.");
}

main().catch((error) => {
  console.error(`Robinhood source verification preparation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
