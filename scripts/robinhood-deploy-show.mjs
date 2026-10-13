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
  credentialRegistryAbi,
  eligibilityVerifierAdapterAbi,
  lendingPoolV2Abi,
  robinhoodGovernanceAbi,
} from "../src/lib/contracts/abis.ts";
import { validateGovernanceReadback } from "./robinhood-deploy-show-core.mjs";
import {
  presentationColorDepth,
  renderPresentationFailure,
  runPresentation,
  safePresentationError,
} from "./robinhood-deploy-presentation.mjs";

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

const argv = new Set(process.argv.slice(2));
for (const arg of argv) {
  assert.ok(arg === "--verbose" || arg === "--plain" || arg === "--presentation", `Unknown option: ${arg}`);
}
const verbose = argv.has("--verbose");
const plain = argv.has("--plain");
const presentation = argv.has("--presentation");
assert.ok(!(presentation && verbose), "Use --presentation by itself; --verbose remains available for diagnostics");
const supportsColor = !plain && process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
const checks = [];

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
  checks.push({ label, detail });
}

function cleanAscii(value) {
  return String(value).replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function paint(value, code) {
  if (!supportsColor) return value;
  const depth = presentationColorDepth();
  const burgundy = depth === "truecolor"
    ? "38;2;198;56;96"
    : depth === "256"
      ? "38;5;168"
      : "91";
  const resolvedCode = code.replace("38;5;160", burgundy);
  return `\u001b[${resolvedCode}m${value}\u001b[0m`;
}

function shortHash(hash) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function shortAddress(address) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatWad(value) {
  const wad = 10n ** 18n;
  const whole = value / wad;
  const hundredths = ((value % wad) * 100n + wad / 2n) / wad;
  return hundredths === 100n
    ? `${whole + 1n}.00 WAD`
    : `${whole}.${hundredths.toString().padStart(2, "0")} WAD`;
}

function sourceLabel(value) {
  if (value === "source verified") return "VERIFIED";
  if (value.startsWith("source not verified")) return "NOT VERIFIED";
  return "UNAVAILABLE";
}

function renderReport({ chainId, head, verified, verificationByName, calls, initReceipts, oracleStates, demoReadiness }) {
  const lines = [];
  const rule = "+----------------------------------------------------------------------------+";
  const line = (value = "") => lines.push(cleanAscii(value));
  const section = (value) => line(paint(value, "97;1"));
  const good = (value) => paint(value, "97;1");
  const warning = (value) => paint(value, "38;5;160;1");
  const sourceStatuses = [...verificationByName.values()];
  const sourceVerifiedCount = sourceStatuses.filter((value) => value === "source verified").length;
  const sourceNotVerifiedCount = sourceStatuses.filter((value) => value === "source not verified").length;
  const sourceUnavailableCount = sourceStatuses.length - sourceVerifiedCount - sourceNotVerifiedCount;
  const ready = oracleStates.every((state) => state.state === "fresh");

  line(paint(rule, "38;5;160"));
  line(`${paint("| G Y E V O", "38;5;160;1")} | ${paint("ROBINHOOD TESTNET DEPLOYMENT", "97;1")}`);
  line(`| CHAIN ${chainId} | RPC REACHABLE | CURRENT BLOCK ${head}`);
  line(paint(rule, "38;5;160"));
  line();
  section("DEPLOYMENT SUMMARY");
  line(`Contracts deployed: ${good(`${verified.length}/10`)}`);
  line(`Deployment receipts confirmed: ${good(`${verified.length}/10`)} | initialization receipts: ${good(`${initReceipts.length}/${calls.length}`)}`);
  line(`Runtime bytecode verified present on RPC: ${good(`${verified.length}/10`)}`);
  line(`Explorer source: ${sourceVerifiedCount} verified | ${sourceNotVerifiedCount} not verified | ${sourceUnavailableCount} unavailable`);
  line();
  section("OPERATOR READINESS");
  line(`DEPLOYED: ${verified.length}/10 contracts | ${initReceipts.length}/${calls.length} initialization receipts confirmed`);
  line("PUBLIC RECEIPT CONFIRMED: 10/10 contract creations and 5/5 initialization transactions");
  line(`READY TO TEST: ${demoReadiness.daoReady
    ? `DAO Phase 1 membership ready for Wallet A + Wallet B | quorum ${demoReadiness.quorum} | voting ${demoReadiness.votingPeriod}s | next proposal ${demoReadiness.nextProposalId}`
    : "DAO proposal creation blocked by missing active policy-4 membership"}`);
  line(`NEEDS OWNER ACTION: ${demoReadiness.ownerActions.join("; ") || "none identified by read-only checks"}`);
  line(`BLOCKED: ${demoReadiness.lendingReady
    ? "Lending V2 prerequisites currently pass read-only checks; wallet transactions still require participant approval"
    : `Lending risk-increasing actions unavailable until ${demoReadiness.lendingBlockers.join("; ")}`}`);
  line(`BLOCKSCOUT SOURCE: ${sourceVerifiedCount}/10 verified | ${sourceNotVerifiedCount} not verified | ${sourceUnavailableCount} unavailable`);
  line();

  const categories = [
    ["ZK PROOF INFRASTRUCTURE", ["ZKTranscriptLib", "RelationsLib", "HonkVerifier", "EligibilityVerifierAdapter"]],
    ["CREDENTIAL INFRASTRUCTURE", ["RobinhoodDemoCredentialRegistry"]],
    ["LENDING", ["ControlledTestOracle", "rUSD2", "rCOL2", "LendingPoolV2"]],
    ["GOVERNANCE", ["RobinhoodGovernancePhase1"]],
  ];
  const byName = new Map(verified.map((record) => [record.name, record]));
  for (const [category, names] of categories) {
    section(category);
    for (const name of names) {
      const item = byName.get(name);
      const source = verificationByName.get(name);
      const tx = verbose ? item.hash : shortHash(item.hash);
      line(`${name.padEnd(35)} ${verbose ? item.address : shortAddress(item.address)}`);
      line(`  deployed YES | receipt CONFIRMED ${tx}`);
      line(`  runtime bytecode PRESENT ON RPC | explorer source ${sourceLabel(source)}`);
      if (verbose) {
        line(`  block ${item.block} | gas used ${item.gasUsed} | runtime code hash ${item.runtimeCodeHash}`);
        line(`  ${EXPLORER}/address/${item.address}`);
        if (source !== "source verified" && source !== "source not verified") line(`  source detail: ${source}`);
      }
    }
    line();
  }

  section("LENDING ORACLE READINESS");
  if (ready) line(`Oracle freshness: ${good("READY")} | all configured prices are within max age`);
  else line(`Oracle freshness: ${warning("WARNING")} | Lending readiness only; deployment remains verified`);
  for (const state of oracleStates) {
    const status = state.state.toUpperCase();
    const detail = state.state === "missing"
      ? "price not initialized"
      : `${formatWad(state.priceWad)} | age ${state.ageSeconds}s / max ${state.maxAge}s`;
    line(`  ${state.name}: ${state.state === "fresh" ? good(status) : warning(status)} | ${detail}`);
  }

  if (verbose) {
    line();
    section("INITIALIZATION RECEIPTS");
    for (const { entry, receipt } of initReceipts) {
      line(`${entry.function} | ${entry.hash} | block ${receipt.blockNumber} | ${receipt.status}`);
    }
    line();
    section("READ-ONLY VERIFICATION CHECKS");
    for (const check of checks) line(`PASS ${check.label}${check.detail ? ` | ${check.detail}` : ""}`);
  }

  line();
  line("On-chain bytecode, deployment receipts, dependencies, roles, and reserve settings were checked through Robinhood RPC.");
  line("Explorer source status is independent; bytecode presence does not imply verified source.");
  line("READ-ONLY: no transaction was signed or broadcast; no price, token, or credential state was changed.");
  console.log(lines.join("\n"));
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
  pass("Foundry artifact", "chain 46630 | 10 creates | 5 init calls | all 15 artifact receipts successful");
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
  pass("Robinhood RPC", `chain ${chainId} | head ${head} | 10 deployment receipts and runtime bytecodes verified present`);
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

  const [votingPeriod, quorum, executionWindow, minimumRemainingValidity, nextProposalId] = await Promise.all([
    read(client, governanceAddress, robinhoodGovernanceAbi, "votingPeriod"),
    read(client, governanceAddress, robinhoodGovernanceAbi, "quorum"),
    read(client, governanceAddress, robinhoodGovernanceAbi, "executionWindow"),
    read(client, governanceAddress, robinhoodGovernanceAbi, "minimumRemainingValidity"),
    read(client, governanceAddress, robinhoodGovernanceAbi, "nextProposalId"),
  ]);
  const proposalOne = nextProposalId > 1n
    ? await read(client, governanceAddress, robinhoodGovernanceAbi, "getProposal", [1n])
    : undefined;
  const proposalOneState = proposalOne
    ? await read(client, governanceAddress, robinhoodGovernanceAbi, "proposalState", [1n])
    : undefined;
  assertAddress(governance.entry.arguments?.[0], registryAddress, "Governance constructor registry");
  assertAddress(governance.entry.arguments?.[1], ADMIN, "Governance constructor admin");
  const governanceReadback = validateGovernanceReadback({
    constructorArguments: governance.entry.arguments,
    votingPeriod,
    quorum,
    executionWindow,
    minimumRemainingValidity,
    nextProposalId,
    proposalOne,
    proposalOneState,
  });
  pass("Governance parameters and Proposal #1", governanceReadback);

  const reserveAssets = await read(client, poolAddress, lendingPoolV2Abi, "getReserveAssets");
  assert.equal(reserveAssets.length, 2, "Expected exactly two configured lending reserves");
  assert.ok(reserveAssets.some((asset) => sameAddress(asset, loanAddress)), "rUSD2 missing from reserve list");
  assert.ok(reserveAssets.some((asset) => sameAddress(asset, collateralAddress)), "rCOL2 missing from reserve list");
  const [loanReserve, collateralReserve, loanBounds, collateralBounds] = await Promise.all([
    read(client, poolAddress, lendingPoolV2Abi, "getReserveConfig", [loanAddress]),
    read(client, poolAddress, lendingPoolV2Abi, "getReserveConfig", [collateralAddress]),
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
  assert.deepEqual(loanBounds.slice(0, 2), [950000000000000000n, 1050000000000000000n], "Loan oracle bounds mismatch");
  assert.deepEqual(collateralBounds.slice(0, 2), [500000000000000000n, 4000000000000000000n], "Collateral oracle bounds mismatch");

  const block = await client.getBlock({ blockNumber: head });
  const oracleStates = [
    { name: "rUSD2", address: loanAddress, bounds: loanBounds, reserve: loanReserve },
    { name: "rCOL2", address: collateralAddress, bounds: collateralBounds, reserve: collateralReserve },
  ].map(({ name, address, bounds, reserve }) => {
    const [minimum, maximum, priceWad, updatedAt] = bounds;
    if (priceWad === 0n) {
      assert.equal(updatedAt, 0n, `${name} unset oracle price has a nonzero timestamp`);
      return { name, state: "missing", priceWad, updatedAt, ageSeconds: undefined, maxAge: BigInt(reserve.maxOracleAge) };
    }

    assert.ok(priceWad >= minimum && priceWad <= maximum, `${name} oracle price is outside its configured bounds`);
    assert.ok(updatedAt > 0n, `${name} oracle price has no update timestamp`);
    assert.ok(updatedAt <= block.timestamp, `${name} oracle timestamp is in the future`);
    return {
      name,
      address,
      state: block.timestamp - updatedAt > BigInt(reserve.maxOracleAge) ? "stale" : "fresh",
      priceWad,
      updatedAt,
      ageSeconds: block.timestamp - updatedAt,
      maxAge: BigInt(reserve.maxOracleAge),
    };
  });

  const populatedOracleStates = oracleStates.filter((state) => state.state !== "missing");
  const priceReadbacks = await Promise.all(populatedOracleStates.map((state) =>
    read(client, oracleAddress, controlledTestOracleAbi, "getPrice", [state.address]),
  ));
  populatedOracleStates.forEach((state, index) => {
    assert.deepEqual(priceReadbacks[index], [state.priceWad, state.updatedAt], `${state.name} oracle getter mismatch`);
  });
  pass("Oracle and reserves", "two approved reserve configs and price bounds confirmed; current oracle state follows");

  const participants = [
    { label: "Wallet A", address: ADMIN },
    { label: "Wallet B", address: ISSUER },
  ];
  const participantCredentials = await Promise.all(participants.flatMap(({ label, address }) => [3n, 4n].map(async (policyId) => {
    const record = await read(client, registryAddress, credentialRegistryAbi, "getCredential", [address, policyId]);
    const issuerAuthorized = record.version > 0n && await read(client, registryAddress, accessControlAbi, "hasRole", [issuerRole, record.issuer]);
    return {
      label,
      policyId,
      active: record.version > 0n && !record.revoked && record.expiresAt > block.timestamp && issuerAuthorized,
    };
  })));
  const activeCredential = (label, policyId) => participantCredentials.find((item) => item.label === label && item.policyId === policyId)?.active === true;
  const loanLiquidity = await read(client, poolAddress, lendingPoolV2Abi, "availableLiquidity", [loanAddress]);
  const daoReady = activeCredential("Wallet A", 4n) && activeCredential("Wallet B", 4n);
  const policy3Ready = activeCredential("Wallet A", 3n) && activeCredential("Wallet B", 3n);
  const oracleReady = oracleStates.every((state) => state.state === "fresh");
  const lendingReady = policy3Ready && oracleReady && loanLiquidity > 0n;
  const ownerActions = [];
  if (nextProposalId === 1n) ownerActions.push("start the public DAO demo by creating a proposal from Wallet A; two eligible wallets must vote later");
  if (!policy3Ready) ownerActions.push("issuer must issue policy-3 credentials and deliver each matching private witness");
  if (!oracleReady) ownerActions.push("admin must simulate and authorize refresh of each stale synthetic oracle price");
  if (loanLiquidity === 0n) ownerActions.push("supplier must supply rUSD2 liquidity before borrowing");
  const lendingBlockers = [];
  if (!policy3Ready) lendingBlockers.push("active policy-3 credentials and matching private witnesses");
  if (!oracleReady) lendingBlockers.push("fresh bounded synthetic oracle prices");
  if (loanLiquidity === 0n) lendingBlockers.push("nonzero rUSD2 pool liquidity");
  const demoReadiness = {
    daoReady,
    lendingReady,
    ownerActions,
    lendingBlockers,
    quorum: quorum.toString(),
    votingPeriod: votingPeriod.toString(),
    nextProposalId: nextProposalId.toString(),
  };

  const verification = await Promise.all(verified.map(async (record) => [record.name, await sourceVerification(record.address)]));
  const verificationByName = new Map(verification);
  const initReceipts = [];
  for (const { entry, receipt } of calls) {
    const [rpcReceipt, rpcTransaction] = await Promise.all([
      client.getTransactionReceipt({ hash: entry.hash }),
      client.getTransaction({ hash: entry.hash }),
    ]);
    assert.equal(rpcReceipt.status, "success", `Initialization transaction reverted: ${entry.hash}`);
    assertAddress(rpcTransaction.from, ADMIN, `Initialization sender for ${entry.hash}`);
    assert.equal(rpcTransaction.chainId, CHAIN_ID, `Initialization chain ID mismatch for ${entry.hash}`);
    assertAddress(rpcTransaction.to, entry.transaction.to, `Initialization target for ${entry.hash}`);
    initReceipts.push({ entry, receipt: rpcReceipt });
  }
  const report = {
    chainId,
    head,
    verified,
    verificationByName,
    calls,
    initReceipts,
    oracleStates,
    demoReadiness,
    deploymentReceiptCount: txRecords.length,
    governance: {
      proposalOneExecuted: proposalOne?.executed === true && Number(proposalOneState) === 6,
      proposalOneState: proposalOneState === undefined ? "NOT FOUND" : `STATE ${proposalOneState}`,
      minimumRemainingValidity: minimumRemainingValidity.toString(),
    },
  };

  if (presentation) {
    const playback = await runPresentation(report, {
      tty: Boolean(process.stdout.isTTY) && !plain && process.env.TERM !== "dumb",
      color: supportsColor,
      colorDepth: presentationColorDepth(),
      columns: process.stdout.columns || 100,
    });
    if (playback.interrupted) process.exitCode = 130;
  } else {
    renderReport(report);
  }
}

main().catch((error) => {
  const message = safePresentationError(error instanceof Error ? error.message : String(error));
  if (presentation) {
    const frame = renderPresentationFailure(message, {
      columns: process.stdout.columns || 100,
      color: supportsColor,
      colorDepth: presentationColorDepth(),
    });
    console.error(frame);
  } else {
    console.error(cleanAscii(`Robinhood deployment readback failed: ${message}`));
  }
  process.exitCode = 1;
});
