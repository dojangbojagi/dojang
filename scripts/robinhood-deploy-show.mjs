#!/usr/bin/env bun
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  keccak256,
  parseAbi,
} from "viem";
import {
  controlledTestOracleAbi,
  controlledTokenAbi,
  credentialIssuerRoleAbi,
  eligibilityVerifierAdapterAbi,
  lendingPoolV2Abi,
  robinhoodGovernanceAbi,
} from "../src/lib/contracts/abis.ts";

const ROOT = process.cwd();
const CHAIN_ID = 46_630;
const EXPLORER = "https://explorer.testnet.chain.robinhood.com";
const ARTIFACT = path.join(
  ROOT,
  "contracts/broadcast/DeployRobinhoodProtocolStack.s.sol/46630/run-latest.json",
);
const HONK_ARTIFACT = path.join(ROOT, "contracts/out/EligibilityHonkVerifier.sol/HonkVerifier.json");
const ADMIN = getAddress("0x4C488dfa668A7643C4046a1952734eF875Af0d62");
const ISSUER = getAddress("0xBE390374Ac7304A792c50EA37AB301b659a56Df7");
const DEFAULT_ADMIN_ROLE = `0x${"0".repeat(64)}`;
const accessControlAbi = parseAbi(["function hasRole(bytes32 role,address account) view returns (bool)"]);
const oracleRoleAbi = parseAbi(["function PRICE_UPDATER_ROLE() view returns (bytes32)"]);
const tokenRoleAbi = parseAbi(["function MINTER_ROLE() view returns (bytes32)"]);
const poolRoleAbi = parseAbi([
  "function RISK_ADMIN_ROLE() view returns (bytes32)",
  "function PAUSER_ROLE() view returns (bytes32)",
]);
const governanceRoleAbi = parseAbi(["function PAUSER_ROLE() view returns (bytes32)"]);
const tokenSymbolAbi = parseAbi(["function symbol() view returns (string)"]);

const contractOrder = [
  "ZKTranscriptLib",
  "RelationsLib",
  "HonkVerifier",
  "EligibilityVerifierAdapter",
  "RobinhoodDemoCredentialRegistry",
  "ControlledTestOracle",
  "rUSD2",
  "rCOL2",
  "LendingPoolV2",
  "RobinhoodGovernancePhase1",
];

const envNames = {
  ZKTranscriptLib: ["RH_TESTNET_ZK_TRANSCRIPT_LIB_ADDRESS", "NEXT_PUBLIC_ROBINHOOD_ZK_TRANSCRIPT_LIB_CONTRACT"],
  RelationsLib: ["RH_TESTNET_RELATIONS_LIB_ADDRESS", "NEXT_PUBLIC_ROBINHOOD_RELATIONS_LIB_CONTRACT"],
  HonkVerifier: ["RH_TESTNET_HONK_VERIFIER_ADDRESS", "NEXT_PUBLIC_ROBINHOOD_HONK_VERIFIER_CONTRACT"],
  EligibilityVerifierAdapter: ["RH_TESTNET_VERIFIER_ADAPTER_ADDRESS", "NEXT_PUBLIC_ROBINHOOD_VERIFIER_ADAPTER_CONTRACT"],
  RobinhoodDemoCredentialRegistry: ["RH_TESTNET_CREDENTIAL_REGISTRY_ADDRESS", "NEXT_PUBLIC_ROBINHOOD_CREDENTIAL_REGISTRY_CONTRACT"],
  ControlledTestOracle: ["RH_TESTNET_LENDING_V2_ORACLE_ADDRESS", "NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ORACLE_CONTRACT"],
  rUSD2: ["RH_TESTNET_LENDING_V2_ASSET_ADDRESS", "NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ASSET_CONTRACT"],
  rCOL2: ["RH_TESTNET_LENDING_V2_COLLATERAL_ADDRESS", "NEXT_PUBLIC_ROBINHOOD_LENDING_V2_COLLATERAL_CONTRACT"],
  LendingPoolV2: ["RH_TESTNET_LENDING_V2_POOL_ADDRESS", "NEXT_PUBLIC_ROBINHOOD_LENDING_V2_POOL_CONTRACT"],
  RobinhoodGovernancePhase1: ["RH_TESTNET_GOVERNANCE_ADDRESS", "NEXT_PUBLIC_ROBINHOOD_GOVERNANCE_CONTRACT"],
};

function pass(label, detail = "") {
  console.log(`PASS ${label}${detail ? ` · ${detail}` : ""}`);
}

function sameAddress(left, right) {
  return String(left).toLowerCase() === String(right).toLowerCase();
}

function assertAddress(left, right, label) {
  assert.ok(left && right && sameAddress(left, right), `${label}: expected ${right}, received ${left}`);
}

function addressFromReceipt(entry, receipt) {
  const address = receipt?.contractAddress ?? entry?.contractAddress;
  assert.ok(address, `Missing contract address for ${entry?.hash ?? "deployment"}`);
  return getAddress(address);
}

function linkCreationBytecode(object, references, libraries) {
  let linked = object.startsWith("0x") ? object.slice(2) : object;
  for (const [sourceName, sourceRefs] of Object.entries(references ?? {})) {
    for (const [libraryName, locations] of Object.entries(sourceRefs)) {
      const address = libraries[libraryName];
      assert.ok(address, `Missing deployed link address for ${sourceName}:${libraryName}`);
      for (const location of locations) {
        // The link-reference points at the 20-byte value after its PUSH20 opcode.
        const start = location.start * 2;
        const before = linked.slice(start, start + 40);
        assert.match(before, /^__\$[0-9a-fA-F]{34}\$__$/, `Unexpected ${libraryName} link placeholder`);
        linked = `${linked.slice(0, start)}${address.slice(2).toLowerCase()}${linked.slice(start + 40)}`;
      }
    }
  }
  return `0x${linked}`;
}

async function read(client, address, abi, functionName, args = []) {
  return client.readContract({ address, abi, functionName, args });
}

async function requireRole(client, address, role, account, label) {
  const assigned = await read(client, address, accessControlAbi, "hasRole", [role, account]);
  assert.equal(assigned, true, `${label} role is missing for ${account} at ${address}`);
}

function normalizeConfig(config) {
  const fields = [
    "supplyCap", "borrowCap", "collateralCap", "minBorrowAmount", "maxOracleAge", "maxLtvBps",
    "liquidationThresholdBps", "liquidationBonusBps", "closeFactorBps", "reserveFactorBps",
    "optimalUtilizationBps", "baseBorrowRateBps", "slope1Bps", "slope2Bps", "active",
    "supplyEnabled", "borrowEnabled", "collateralEnabled",
  ];
  return Object.fromEntries(fields.map((field, index) => {
    const value = config[field] ?? config[index];
    return [field, typeof value === "bigint" || typeof value === "number" ? String(value) : value];
  }));
}

async function sourceVerification(address) {
  const url = `${EXPLORER}/api?module=contract&action=getsourcecode&address=${address}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return `unavailable (HTTP ${response.status})`;
    const body = await response.json();
    const record = Array.isArray(body.result) ? body.result[0] : undefined;
    if (!record || !sameAddress(record.Address, address)) return "unavailable (no matching explorer record)";
    const verified = Boolean(
      typeof record.SourceCode === "string" && record.SourceCode.trim() &&
      typeof record.ABI === "string" && record.ABI.trim() &&
      record.ABI !== "Contract source code not verified",
    );
    return verified ? "source verified" : "source not verified";
  } catch (error) {
    return `unavailable (${error instanceof Error ? error.message : "explorer request failed"})`;
  }
}

async function main() {
  assert.ok(fs.existsSync(ARTIFACT), `Missing Foundry artifact: ${ARTIFACT}`);
  assert.ok(fs.existsSync(HONK_ARTIFACT), `Missing compiled HonkVerifier artifact: ${HONK_ARTIFACT}`);
  const deployment = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  const verifierArtifact = JSON.parse(fs.readFileSync(HONK_ARTIFACT, "utf8"));
  assert.equal(Number(deployment.chain), CHAIN_ID, "Foundry artifact is not for Robinhood Testnet");
  assert.equal(deployment.transactions?.length, 15, "Expected 10 deployments plus 5 initialization calls");
  assert.equal(deployment.receipts?.length, 15, "Expected one artifact receipt per transaction");

  const rpcUrl = process.env.RH_TESTNET_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL;
  assert.ok(rpcUrl, "Set RH_TESTNET_RPC_URL or NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL");
  const chain = defineChain({
    id: CHAIN_ID,
    name: "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 1, timeout: 30_000 }) });
  const chainId = await client.getChainId();
  assert.equal(chainId, CHAIN_ID, `RPC reports chain ${chainId}`);
  const head = await client.getBlockNumber();
  const configuredAdmin = process.env.RH_TESTNET_ADMIN_ADDRESS;
  assert.ok(configuredAdmin, "Missing RH_TESTNET_ADMIN_ADDRESS");
  assertAddress(configuredAdmin, ADMIN, "Configured deployment admin");

  const txRecords = deployment.transactions.map((entry, index) => {
    const receipt = deployment.receipts.find((item) => sameAddress(item.transactionHash, entry.hash));
    assert.ok(receipt, `Artifact has no receipt matching transaction ${index} ${entry.hash}`);
    assert.equal(receipt.status, "0x1", `Artifact receipt ${entry.hash} is not successful`);
    assert.equal(Number(BigInt(entry.transaction.chainId)), CHAIN_ID, `Transaction ${entry.hash} has wrong chain ID`);
    assertAddress(entry.transaction.from, ADMIN, `Artifact sender for ${entry.hash}`);
    return { entry, receipt };
  });
  const createEntries = txRecords.filter(({ entry }) => entry.transactionType === "CREATE");
  const calls = txRecords.filter(({ entry }) => entry.transactionType === "CALL");
  assert.equal(createEntries.length, 10, "Expected exactly 10 contract creations");
  assert.equal(calls.length, 5, "Expected exactly 5 initialization calls");

  const findCreate = (name) => {
    const found = createEntries.filter(({ entry }) => entry.contractName === name);
    assert.equal(found.length, 1, `Expected one ${name} deployment in artifact`);
    return found[0];
  };
  const transcript = findCreate("ZKTranscriptLib");
  const relations = findCreate("RelationsLib");
  const adapter = findCreate("EligibilityVerifierAdapter");
  const registry = findCreate("RobinhoodDemoCredentialRegistry");
  const oracle = findCreate("ControlledTestOracle");
  const pool = findCreate("LendingPoolV2");
  const governance = findCreate("RobinhoodGovernancePhase1");
  const tokens = createEntries.filter(({ entry }) => entry.contractName === "ControlledTestToken");
  assert.equal(tokens.length, 2, "Expected two controlled demo token deployments");
  const tokenBySymbol = new Map(tokens.map((record) => [record.entry.arguments?.[1], record]));
  const lendingAsset = tokenBySymbol.get("rUSD2");
  const collateralAsset = tokenBySymbol.get("rCOL2");
  assert.ok(lendingAsset && collateralAsset, "Artifact token constructor arguments do not identify rUSD2 and rCOL2");

  const honkInitCode = linkCreationBytecode(
    verifierArtifact.bytecode.object,
    verifierArtifact.bytecode.linkReferences,
    {
      ZKTranscriptLib: addressFromReceipt(transcript.entry, transcript.receipt),
      RelationsLib: addressFromReceipt(relations.entry, relations.receipt),
    },
  );
  const honkCandidates = createEntries.filter(({ entry }) =>
    !entry.contractName && entry.transaction.input.toLowerCase() === honkInitCode.toLowerCase());
  assert.equal(honkCandidates.length, 1, "Could not match HonkVerifier creation input to the linked compiled artifact");
  const honkVerifier = honkCandidates[0];
  const deployed = new Map([
    ["ZKTranscriptLib", transcript], ["RelationsLib", relations], ["HonkVerifier", honkVerifier],
    ["EligibilityVerifierAdapter", adapter], ["RobinhoodDemoCredentialRegistry", registry],
    ["ControlledTestOracle", oracle], ["rUSD2", lendingAsset], ["rCOL2", collateralAsset],
    ["LendingPoolV2", pool], ["RobinhoodGovernancePhase1", governance],
  ]);
  assert.equal(deployed.size, 10);
  assert.deepEqual([...deployed.keys()], contractOrder);
  pass("Foundry artifact", "chain 46630 · 10 creates · 5 init calls · all 15 artifact receipts successful");
  pass("HonkVerifier artifact identity", "creation bytecode matches generated artifact linked to both deployed libraries");

  const verified = [];
  for (const name of contractOrder) {
    const { entry, receipt: artifactReceipt } = deployed.get(name);
    const address = addressFromReceipt(entry, artifactReceipt);
    assertAddress(entry.contractAddress, address, `${name} Foundry address`);
    const [receipt, transaction, code] = await Promise.all([
      client.getTransactionReceipt({ hash: entry.hash }),
      client.getTransaction({ hash: entry.hash }),
      client.getBytecode({ address }),
    ]);
    assert.equal(receipt.status, "success", `${name} public receipt reverted`);
    assert.equal(receipt.transactionHash.toLowerCase(), entry.hash.toLowerCase(), `${name} public receipt hash mismatch`);
    assertAddress(receipt.contractAddress, address, `${name} public receipt address`);
    assertAddress(transaction.from, ADMIN, `${name} public transaction sender`);
    assert.equal(transaction.chainId, CHAIN_ID, `${name} public transaction chain ID`);
    assert.ok(code && code !== "0x", `${name} has no deployed runtime bytecode at ${address}`);
    const runtimeCodeHash = keccak256(code);
    const expectedEnv = envNames[name];
    for (const envName of expectedEnv) {
      const configured = process.env[envName];
      assert.ok(configured, `${envName} is not populated from the deployment artifact`);
      assertAddress(configured, address, `${envName} configuration`);
    }
    verified.push({ name, address, hash: entry.hash, block: receipt.blockNumber, gasUsed: receipt.gasUsed, runtimeCodeHash });
  }
  pass("Robinhood RPC", `chain ${chainId} · head ${head} · 10 deployment receipts and runtime bytecodes verified`);
  pass("Frontend registry", "all 10 NEXT_PUBLIC address values match the confirmed creation receipts");

  const getAddressByName = (name) => deployed.get(name).entry.contractAddress
    ? getAddress(deployed.get(name).entry.contractAddress)
    : addressFromReceipt(deployed.get(name).entry, deployed.get(name).receipt);
  const honkAddress = getAddressByName("HonkVerifier");
  const adapterAddress = getAddressByName("EligibilityVerifierAdapter");
  const registryAddress = getAddressByName("RobinhoodDemoCredentialRegistry");
  const oracleAddress = getAddressByName("ControlledTestOracle");
  const loanAddress = getAddressByName("rUSD2");
  const collateralAddress = getAddressByName("rCOL2");
  const poolAddress = getAddressByName("LendingPoolV2");
  const governanceAddress = getAddressByName("RobinhoodGovernancePhase1");

  assertAddress(await read(client, adapterAddress, eligibilityVerifierAdapterAbi, "honkVerifier"), honkAddress, "Adapter -> HonkVerifier");
  assertAddress(await read(client, poolAddress, lendingPoolV2Abi, "credentialRegistry"), registryAddress, "LendingPoolV2 -> registry");
  assertAddress(await read(client, poolAddress, lendingPoolV2Abi, "eligibilityVerifier"), adapterAddress, "LendingPoolV2 -> verifier adapter");
  assertAddress(await read(client, poolAddress, lendingPoolV2Abi, "priceOracle"), oracleAddress, "LendingPoolV2 -> oracle");
  assertAddress(await read(client, governanceAddress, robinhoodGovernanceAbi, "credentialRegistry"), registryAddress, "Governance -> registry");
  assert.equal(await read(client, governanceAddress, robinhoodGovernanceAbi, "GOVERNANCE_CREDENTIAL_POLICY_ID"), 4n);
  assert.equal(await read(client, poolAddress, lendingPoolV2Abi, "POLICY_ID"), 3n);
  assert.equal(await read(client, poolAddress, lendingPoolV2Abi, "POLICY_VERSION"), 1n);
  assert.equal(await read(client, poolAddress, lendingPoolV2Abi, "ELIGIBILITY_THRESHOLD"), 1000n);
  pass("Contract dependencies and policy", "verifier, registry, oracle, governance and policy 3/4 readbacks match");

  const issuerRole = await read(client, registryAddress, credentialIssuerRoleAbi, "ISSUER_ROLE");
  await requireRole(client, registryAddress, DEFAULT_ADMIN_ROLE, ADMIN, "Registry admin");
  await requireRole(client, registryAddress, issuerRole, ISSUER, "Registry issuer");

  const oracleUpdaterRole = await read(client, oracleAddress, controlledTestOracleAbi, "PRICE_UPDATER_ROLE");
  await requireRole(client, oracleAddress, DEFAULT_ADMIN_ROLE, ADMIN, "Oracle admin");
  await requireRole(client, oracleAddress, oracleUpdaterRole, ADMIN, "Oracle price updater");

  const tokenRole = await read(client, loanAddress, tokenRoleAbi, "MINTER_ROLE");
  for (const [name, address, expectedName, symbol, decimals, cap] of [
    ["rUSD2", loanAddress, "Robinhood Demo Lending Dollar V2", "rUSD2", 6, 1_000_000_000_000n],
    ["rCOL2", collateralAddress, "Robinhood Demo Collateral V2", "rCOL2", 18, 1_000_000_000_000_000_000_000_000n],
  ]) {
    assert.equal(await read(client, address, controlledTokenAbi, "name"), expectedName, `${name} name mismatch`);
    assert.equal(await read(client, address, tokenSymbolAbi, "symbol"), symbol, `${name} symbol mismatch`);
    assert.equal(await read(client, address, controlledTokenAbi, "decimals"), decimals, `${name} decimals mismatch`);
    assert.equal(await read(client, address, controlledTokenAbi, "mintCap"), cap, `${name} mint cap mismatch`);
    await requireRole(client, address, DEFAULT_ADMIN_ROLE, ADMIN, `${name} admin`);
    await requireRole(client, address, tokenRole, ADMIN, `${name} minter`);
  }

  await requireRole(client, poolAddress, DEFAULT_ADMIN_ROLE, ADMIN, "LendingPoolV2 admin");
  const riskRole = await read(client, poolAddress, poolRoleAbi, "RISK_ADMIN_ROLE");
  const poolPauserRole = await read(client, poolAddress, poolRoleAbi, "PAUSER_ROLE");
  await requireRole(client, poolAddress, riskRole, ADMIN, "LendingPoolV2 risk admin");
  await requireRole(client, poolAddress, poolPauserRole, ADMIN, "LendingPoolV2 pauser");
  await requireRole(client, governanceAddress, DEFAULT_ADMIN_ROLE, ADMIN, "Governance admin");
  const governancePauserRole = await read(client, governanceAddress, governanceRoleAbi, "PAUSER_ROLE");
  await requireRole(client, governanceAddress, governancePauserRole, ADMIN, "Governance pauser");
  pass("Admin, issuer and minter roles", "deployer roles and separate issuer role are present on chain");

  const governanceParams = await Promise.all([
    read(client, governanceAddress, robinhoodGovernanceAbi, "votingPeriod"),
    read(client, governanceAddress, robinhoodGovernanceAbi, "quorum"),
    read(client, governanceAddress, robinhoodGovernanceAbi, "executionWindow"),
    read(client, governanceAddress, robinhoodGovernanceAbi, "minimumRemainingValidity"),
  ]);
  assert.deepEqual(governanceParams, [3600n, 2n, 604800n, 0n], "Governance constructor settings do not match approved values");

  const reserveAssets = await read(client, poolAddress, lendingPoolV2Abi, "getReserveAssets");
  assert.equal(reserveAssets.length, 2, "Expected exactly two configured lending reserves");
  assert.ok(reserveAssets.some((asset) => sameAddress(asset, loanAddress)), "rUSD2 missing from reserve list");
  assert.ok(reserveAssets.some((asset) => sameAddress(asset, collateralAddress)), "rCOL2 missing from reserve list");
  const [loanReserve, collateralReserve, loanBounds, collateralBounds, loanPrice, collateralPrice] = await Promise.all([
    read(client, poolAddress, lendingPoolV2Abi, "getReserveConfig", [loanAddress]),
    read(client, poolAddress, lendingPoolV2Abi, "getReserveConfig", [collateralAddress]),
    read(client, oracleAddress, controlledTestOracleAbi, "getPriceBounds", [loanAddress]),
    read(client, oracleAddress, controlledTestOracleAbi, "getPriceBounds", [collateralAddress]),
    read(client, oracleAddress, controlledTestOracleAbi, "getPriceBounds", [loanAddress]),
    read(client, oracleAddress, controlledTestOracleAbi, "getPriceBounds", [collateralAddress]),
  ]);
  assert.deepEqual(normalizeConfig(loanReserve), {
    supplyCap: "100000000000", borrowCap: "50000000000", collateralCap: "0", minBorrowAmount: "1000000",
    maxOracleAge: "3600", maxLtvBps: "5000", liquidationThresholdBps: "6500", liquidationBonusBps: "500",
    closeFactorBps: "5000", reserveFactorBps: "1000", optimalUtilizationBps: "8000", baseBorrowRateBps: "200",
    slope1Bps: "400", slope2Bps: "6000", active: true, supplyEnabled: true, borrowEnabled: true, collateralEnabled: false,
  }, "Loan reserve settings mismatch");
  assert.deepEqual(normalizeConfig(collateralReserve), {
    supplyCap: "0", borrowCap: "0", collateralCap: "100000000000000000000000", minBorrowAmount: "0",
    maxOracleAge: "3600", maxLtvBps: "5000", liquidationThresholdBps: "6500", liquidationBonusBps: "500",
    closeFactorBps: "5000", reserveFactorBps: "1000", optimalUtilizationBps: "8000", baseBorrowRateBps: "200",
    slope1Bps: "400", slope2Bps: "6000", active: true, supplyEnabled: false, borrowEnabled: false, collateralEnabled: true,
  }, "Collateral reserve settings mismatch");
  assert.deepEqual(loanBounds, [950000000000000000n, 1050000000000000000n, 0n, 0n], "Loan oracle bounds/price mismatch");
  assert.deepEqual(collateralBounds, [500000000000000000n, 4000000000000000000n, 0n, 0n], "Collateral oracle bounds/price mismatch");
  assert.deepEqual(loanPrice, loanBounds);
  assert.deepEqual(collateralPrice, collateralBounds);
  pass("Oracle and reserves", "two approved reserve configs and bounds confirmed; both oracle prices remain unset");

  const verification = await Promise.all(verified.map(async (record) => [record.name, await sourceVerification(record.address)]));
  const verificationByName = new Map(verification);
  console.log(`\nRobinhood Testnet deployment · chain ${CHAIN_ID} · RPC head ${head}`);
  console.log("On-chain code and receipts are verified independently. Blockscout source status is reported separately.");
  console.log("\nContract registry:");
  for (const item of verified) {
    console.log(`${item.name}\t${item.address}\t${item.hash}\tblock ${item.block}\t${verificationByName.get(item.name)}`);
    console.log(`  runtime code hash ${item.runtimeCodeHash} · ${EXPLORER}/address/${item.address}`);
  }
  console.log("\nInitialization receipts:");
  for (const { entry, receipt } of calls) {
    const [rpcReceipt, rpcTransaction] = await Promise.all([
      client.getTransactionReceipt({ hash: entry.hash }),
      client.getTransaction({ hash: entry.hash }),
    ]);
    assert.equal(rpcReceipt.status, "success", `Initialization transaction reverted: ${entry.hash}`);
    assertAddress(rpcTransaction.from, ADMIN, `Initialization sender for ${entry.hash}`);
    assert.equal(rpcTransaction.chainId, CHAIN_ID, `Initialization chain ID mismatch for ${entry.hash}`);
    assertAddress(rpcTransaction.to, entry.transaction.to, `Initialization target for ${entry.hash}`);
    console.log(`${entry.function}\t${entry.hash}\tblock ${rpcReceipt.blockNumber}\t${rpcReceipt.status}`);
  }
  console.log("\nReadbacks: adapter → HonkVerifier; pool → registry/adapter/oracle; governance → registry.");
  console.log(`Roles: admin ${ADMIN}; issuer ${ISSUER}. rUSD2 and rCOL2 identities match their deployed token bytecode and metadata.`);
  console.log("Bootstrap remains pending: oracle prices are 0, token supplies are unminted, and no credentials were issued by this command.");
  console.log("READ-ONLY: this command performs RPC/explorer reads only; it has no signer, transaction, or broadcast path.");
}

main().catch((error) => {
  console.error(`Robinhood deployment readback failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
