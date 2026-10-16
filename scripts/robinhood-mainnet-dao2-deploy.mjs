#!/usr/bin/env bun
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createPublicClient, defineChain, getAddress, http, isAddress, isAddressEqual, parseAbi } from "viem";
import { robinhoodMainnetDemoContracts, ROBINHOOD_MAINNET_CHAIN_ID } from "../src/lib/config/robinhood-mainnet-demo.ts";

const ROOT = process.cwd();
const CONTRACTS = path.join(ROOT, "contracts");
const RPC_URL = process.env.RH_MAINNET_RPC_URL?.trim();
const DEPLOYER = process.env.RH_MAINNET_DEPLOYER_ADDRESS?.trim();
const ACCOUNT_ALIAS = process.env.RH_MAINNET_ACCOUNT?.trim();
const SCRIPT = "script/DeployRobinhoodMainnetDaoPhase2.s.sol:DeployRobinhoodMainnetDaoPhase2";
const ARTIFACT = path.join(CONTRACTS, "broadcast/DeployRobinhoodMainnetDaoPhase2.s.sol/4663/run-latest.json");
const BASE_ARTIFACT = path.join(CONTRACTS, "broadcast/DeployRobinhoodMainnetDemoStack.s.sol/4663/run-latest.json");
const AUTHORIZATION = "robinhood-mainnet-dao2-deployment";
const CONFIRMATION = "DEPLOY GYEVO DAO Phase 2 on Robinhood Mainnet chain 4663";
const OUTPUT_ENV = [
  "RH_MAINNET_PHASE2_REPUTATION_REGISTRY_ADDRESS",
  "RH_MAINNET_PHASE2_GOVERNANCE_ADDRESS",
  "NEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_REPUTATION_REGISTRY_CONTRACT",
  "NEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_GOVERNANCE_CONTRACT",
];
const INPUT_ENV = [
  "RH_MAINNET_DEPLOYER_ADDRESS", "RH_MAINNET_ADMIN_ADDRESS", "RH_MAINNET_ISSUER_ADDRESS",
  "RH_MAINNET_RISK_ADMIN_ADDRESS", "RH_MAINNET_PAUSE_AUTHORITY_ADDRESS",
  "RH_MAINNET_CREDENTIAL_REGISTRY_ADDRESS", "RH_MAINNET_VERIFIER_ADAPTER_ADDRESS",
  "RH_MAINNET_DEMO_LENDING_POOL_ADDRESS", "RH_MAINNET_PHASE2_COMMIT_PERIOD",
  "RH_MAINNET_PHASE2_REVEAL_PERIOD", "RH_MAINNET_PHASE2_EXECUTION_WINDOW",
  "RH_MAINNET_PHASE2_QUORUM", "RH_MAINNET_PHASE2_MINIMUM_REPUTATION",
];
const CHILD_ENV = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "XDG_CONFIG_HOME"].flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []),
);
for (const key of [...INPUT_ENV, "RH_MAINNET_RPC_URL", "RH_MAINNET_ACCOUNT", ...OUTPUT_ENV]) {
  if (process.env[key] !== undefined) CHILD_ENV[key] = process.env[key];
}

const markerAbi = parseAbi(["function demoOnly() view returns (bool)"]);
const tokenMarkerAbi = parseAbi(["function controlledDemoAssetMarker() view returns (bytes4)", "function demoOnly() view returns (bool)"]);
const tokenStateAbi = parseAbi(["function totalSupply() view returns (uint256)"]);
const credentialAbi = parseAbi([
  "function ISSUER_ROLE() view returns (bytes32)", "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)", "function demoOnly() view returns (bool)",
]);
const lendingAbi = parseAbi([
  "function credentialRegistry() view returns (address)", "function eligibilityVerifier() view returns (address)",
  "function priceOracle() view returns (address)", "function demoLoanAsset() view returns (address)",
  "function demoCollateralAsset() view returns (address)", "function demoOnly() view returns (bool)",
  "function paused() view returns (bool)", "function isDemoParticipant(address) view returns (bool)",
  "function RISK_ADMIN_ROLE() view returns (bytes32)", "function PAUSER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)",
]);
const verifierAbi = parseAbi(["function honkVerifier() view returns (address)"]);
const oracleAbi = parseAbi(["function getPriceBounds(address) view returns (uint128,uint128,uint128,uint64)"]);
const arbSysAbi = parseAbi(["function arbBlockNumber() view returns (uint256)"]);

function usage() {
  console.log(`Read-only readiness and exact-chain simulation:\n  bun run robinhood:mainnet:dao2:deploy --preflight\n\nBroadcast is disabled unless ALL are supplied from an interactive terminal:\n  bun run robinhood:mainnet:dao2:deploy --execute --authorize-mainnet-dao2-deployment=${AUTHORIZATION} --account-alias <encrypted Foundry alias>\n\nThe encrypted account is checked against RH_MAINNET_DEPLOYER_ADDRESS. The command simulates first, then requires this typed confirmation:\n  ${CONFIRMATION}\n\nThis command deploys only the two Mainnet Phase 2 contracts and refuses to overwrite a prior deployment artifact or configured output address.`);
}

function parseArgs(args) {
  const out = { preflight: false, execute: false, authorization: undefined, alias: undefined };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--help" || value === "-h") { usage(); process.exit(0); }
    if (value === "--preflight") out.preflight = true;
    else if (value === "--execute") out.execute = true;
    else if (value.startsWith("--authorize-mainnet-dao2-deployment=")) out.authorization = value.split("=")[1];
    else if (value === "--account-alias") out.alias = args[++index];
    else if (value.startsWith("--account-alias=")) out.alias = value.split("=")[1];
    else throw new Error(`Unknown option: ${value}`);
  }
  return out;
}

function requireAddress(name) {
  const value = process.env[name]?.trim();
  assert.ok(value && isAddress(value), `${name} is missing or invalid.`);
  return getAddress(value);
}

function rpcClient() {
  assert.ok(RPC_URL, "RH_MAINNET_RPC_URL is required; no implicit Testnet or public-RPC fallback is allowed for deployment.");
  const chain = defineChain({
    id: ROBINHOOD_MAINNET_CHAIN_ID,
    name: "Robinhood Chain Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  });
  return createPublicClient({ chain, transport: http(RPC_URL, { timeout: 15_000, retryCount: 1 }) });
}

function verifyRecordedBaseDeployment() {
  assert.ok(fs.existsSync(BASE_ARTIFACT), "The confirmed Robinhood Mainnet base deployment artifact is missing.");
  const artifact = JSON.parse(fs.readFileSync(BASE_ARTIFACT, "utf8"));
  assert.equal(Number(artifact.chain), ROBINHOOD_MAINNET_CHAIN_ID, "The base deployment artifact is not chain 4663.");
  const creates = artifact.transactions?.filter((item) => item.transactionType === "CREATE") ?? [];
  assert.equal(creates.length, 10, "Expected ten recorded base contract creation transactions.");
  const receipts = creates.map((transaction) => {
    const receipt = artifact.receipts?.find((entry) => entry.transactionHash?.toLowerCase() === transaction.hash?.toLowerCase());
    assert.ok(receipt && receipt.status === "0x1" && (receipt.contractAddress || transaction.contractAddress), `Missing successful recorded receipt for ${transaction.contractName ?? "generated verifier"}.`);
    return { hash: transaction.hash, address: receipt.contractAddress ?? transaction.contractAddress };
  });
  const expected = [
    robinhoodMainnetDemoContracts.zkTranscriptLib, robinhoodMainnetDemoContracts.relationsLib,
    robinhoodMainnetDemoContracts.honkVerifier, robinhoodMainnetDemoContracts.verifierAdapter,
    robinhoodMainnetDemoContracts.credentialRegistry, robinhoodMainnetDemoContracts.oracle,
    robinhoodMainnetDemoContracts.loanToken, robinhoodMainnetDemoContracts.collateralToken,
    robinhoodMainnetDemoContracts.lendingPool, robinhoodMainnetDemoContracts.governance,
  ].map((address) => address.toLowerCase()).sort();
  assert.deepEqual(receipts.map(({ address }) => address.toLowerCase()).sort(), expected, "The ten base Mainnet receipts do not match the receipt-derived application registry.");
  return receipts;
}

function assertFreshDeploymentOutputs() {
  assert.ok(!fs.existsSync(ARTIFACT), "A Phase 2 broadcast artifact already exists. Refusing redeployment; run the read-only status command.");
  for (const name of OUTPUT_ENV) {
    assert.ok(!process.env[name]?.trim(), `${name} is already configured. Refusing a duplicate deployment; run the read-only status command.`);
  }
}

function validateInputConfig() {
  for (const name of INPUT_ENV) assert.ok(process.env[name]?.trim(), `${name} is required.`);
  const deployer = requireAddress("RH_MAINNET_DEPLOYER_ADDRESS");
  const roles = [
    deployer,
    requireAddress("RH_MAINNET_ADMIN_ADDRESS"),
    requireAddress("RH_MAINNET_ISSUER_ADDRESS"),
    requireAddress("RH_MAINNET_RISK_ADMIN_ADDRESS"),
    requireAddress("RH_MAINNET_PAUSE_AUTHORITY_ADDRESS"),
  ];
  assert.equal(new Set(roles.map((address) => address.toLowerCase())).size, roles.length, "Deployment, admin, membership issuer, reputation issuer, and pause authority must be five distinct addresses.");
  const parameters = ["RH_MAINNET_PHASE2_COMMIT_PERIOD", "RH_MAINNET_PHASE2_REVEAL_PERIOD", "RH_MAINNET_PHASE2_EXECUTION_WINDOW", "RH_MAINNET_PHASE2_QUORUM", "RH_MAINNET_PHASE2_MINIMUM_REPUTATION"]
    .map((name) => BigInt(process.env[name]));
  assert.ok(parameters[0] > 0n && parameters[0] <= 30n * 86_400n, "Commit period must be between 1 second and 30 days.");
  assert.ok(parameters[1] > 0n && parameters[1] <= 30n * 86_400n, "Reveal period must be between 1 second and 30 days.");
  assert.ok(parameters[2] > 0n && parameters[2] <= 30n * 86_400n, "Execution window must be between 1 second and 30 days.");
  assert.ok(parameters[3] > 0n, "Quorum must be positive.");
  assert.ok(parameters[4] <= 100n, "Minimum reputation must be at most 100.");
  assert.equal(requireAddress("RH_MAINNET_CREDENTIAL_REGISTRY_ADDRESS").toLowerCase(), robinhoodMainnetDemoContracts.credentialRegistry.toLowerCase(), "Configured credential registry is not the recorded Mainnet registry.");
  assert.equal(requireAddress("RH_MAINNET_VERIFIER_ADAPTER_ADDRESS").toLowerCase(), robinhoodMainnetDemoContracts.verifierAdapter.toLowerCase(), "Configured verifier adapter is not the recorded Mainnet verifier.");
  assert.equal(requireAddress("RH_MAINNET_DEMO_LENDING_POOL_ADDRESS").toLowerCase(), robinhoodMainnetDemoContracts.lendingPool.toLowerCase(), "Configured Lending pool is not the recorded Mainnet demo pool.");
  return { deployer, roles };
}

async function checkLiveDependencies(client, baseReceipts) {
  const chainId = await client.getChainId();
  assert.equal(chainId, ROBINHOOD_MAINNET_CHAIN_ID, `Configured RPC returned chain ${chainId}; expected 4663.`);
  const receiptChecks = await Promise.all(baseReceipts.map(async ({ hash, address }) => {
    const receipt = await client.getTransactionReceipt({ hash });
    assert.equal(receipt.status, "success", `A Mainnet dependency receipt failed: ${hash}`);
    assert.ok(receipt.contractAddress && isAddressEqual(receipt.contractAddress, address), `A Mainnet dependency address differs from the confirmed base artifact: ${hash}`);
    return receipt;
  }));
  const addresses = [
    robinhoodMainnetDemoContracts.credentialRegistry,
    robinhoodMainnetDemoContracts.verifierAdapter,
    robinhoodMainnetDemoContracts.honkVerifier,
    robinhoodMainnetDemoContracts.lendingPool,
    robinhoodMainnetDemoContracts.oracle,
    robinhoodMainnetDemoContracts.loanToken,
    robinhoodMainnetDemoContracts.collateralToken,
  ];
  const code = await Promise.all(addresses.map((address) => client.getBytecode({ address })));
  assert.ok(code.every((value) => value && value !== "0x"), "A required Mainnet dependency has no live runtime bytecode.");
  const [registryDemo, verifierL1, poolRegistry, poolVerifier, poolOracle, loanAsset, collateralAsset, poolDemo, poolPaused, oracleDemo, loanDemo, collateralDemo, loanMarker, collateralMarker, role, adminRole, l2Block, oracleLoan, oracleCollateral, loanSupply, collateralSupply] = await Promise.all([
    client.readContract({ address: robinhoodMainnetDemoContracts.credentialRegistry, abi: markerAbi, functionName: "demoOnly" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.verifierAdapter, abi: verifierAbi, functionName: "honkVerifier" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: lendingAbi, functionName: "credentialRegistry" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: lendingAbi, functionName: "eligibilityVerifier" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: lendingAbi, functionName: "priceOracle" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: lendingAbi, functionName: "demoLoanAsset" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: lendingAbi, functionName: "demoCollateralAsset" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: markerAbi, functionName: "demoOnly" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: lendingAbi, functionName: "paused" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.oracle, abi: markerAbi, functionName: "demoOnly" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.loanToken, abi: tokenMarkerAbi, functionName: "demoOnly" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.collateralToken, abi: tokenMarkerAbi, functionName: "demoOnly" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.loanToken, abi: tokenMarkerAbi, functionName: "controlledDemoAssetMarker" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.collateralToken, abi: tokenMarkerAbi, functionName: "controlledDemoAssetMarker" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.credentialRegistry, abi: credentialAbi, functionName: "ISSUER_ROLE" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.credentialRegistry, abi: credentialAbi, functionName: "DEFAULT_ADMIN_ROLE" }),
    client.readContract({ address: "0x0000000000000000000000000000000000000064", abi: arbSysAbi, functionName: "arbBlockNumber" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [robinhoodMainnetDemoContracts.loanToken] }),
    client.readContract({ address: robinhoodMainnetDemoContracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [robinhoodMainnetDemoContracts.collateralToken] }),
    client.readContract({ address: robinhoodMainnetDemoContracts.loanToken, abi: tokenStateAbi, functionName: "totalSupply" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.collateralToken, abi: tokenStateAbi, functionName: "totalSupply" }),
  ]);
  assert.ok(registryDemo && poolDemo && oracleDemo && loanDemo && collateralDemo, "Mainnet dependencies are not all explicitly demo-only.");
  const expectedMarker = await client.readContract({ address: robinhoodMainnetDemoContracts.loanToken, abi: parseAbi(["function CONTROLLED_DEMO_ASSET_MARKER() view returns (bytes4)"]), functionName: "CONTROLLED_DEMO_ASSET_MARKER" });
  assert.equal(loanMarker, expectedMarker, "Loan asset marker does not match the controlled-demo token marker.");
  assert.equal(collateralMarker, expectedMarker, "Collateral asset marker does not match the controlled-demo token marker.");
  assert.ok(isAddressEqual(verifierL1, robinhoodMainnetDemoContracts.honkVerifier), "Mainnet verifier adapter does not reference the receipt-derived Honk verifier.");
  assert.ok(isAddressEqual(poolRegistry, robinhoodMainnetDemoContracts.credentialRegistry), "Mainnet Lending registry dependency mismatch.");
  assert.ok(isAddressEqual(poolVerifier, robinhoodMainnetDemoContracts.verifierAdapter), "Mainnet Lending verifier dependency mismatch.");
  assert.ok(isAddressEqual(poolOracle, robinhoodMainnetDemoContracts.oracle), "Mainnet Lending oracle dependency mismatch.");
  assert.ok(isAddressEqual(loanAsset, robinhoodMainnetDemoContracts.loanToken) && isAddressEqual(collateralAsset, robinhoodMainnetDemoContracts.collateralToken), "Lending reserve tokens do not match the deployed synthetic token contracts.");
  assert.ok(poolPaused, "Mainnet demo Lending pool must remain paused during Phase 2 deployment preparation.");
  assert.ok(BigInt(l2Block) > 0n, "ArbSys did not return a live Mainnet L2 block number.");
  assert.equal(oracleLoan[2], 0n, "Mainnet loan-token oracle price is no longer unseeded; review the current state before continuing.");
  assert.equal(oracleCollateral[2], 0n, "Mainnet collateral-token oracle price is no longer unseeded; review the current state before continuing.");
  assert.equal(loanSupply, 0n, "Mainnet synthetic loan-token supply is no longer zero; review current state before continuing.");
  assert.equal(collateralSupply, 0n, "Mainnet synthetic collateral-token supply is no longer zero; review current state before continuing.");
  const membershipIssuer = requireAddress("RH_MAINNET_ISSUER_ADDRESS");
  const admin = requireAddress("RH_MAINNET_ADMIN_ADDRESS");
  const [issuerAuthorized, adminAuthorized] = await Promise.all([
    client.readContract({ address: robinhoodMainnetDemoContracts.credentialRegistry, abi: credentialAbi, functionName: "hasRole", args: [role, membershipIssuer] }),
    client.readContract({ address: robinhoodMainnetDemoContracts.credentialRegistry, abi: credentialAbi, functionName: "hasRole", args: [adminRole, admin] }),
  ]);
  assert.ok(issuerAuthorized && adminAuthorized, "Configured Mainnet credential issuer or administrator lacks the required on-chain registry role.");
  const lendingRoles = await Promise.all([
    client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: lendingAbi, functionName: "RISK_ADMIN_ROLE" }),
    client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: lendingAbi, functionName: "PAUSER_ROLE" }),
  ]);
  const [riskAdmin, pauseAuthority] = [requireAddress("RH_MAINNET_RISK_ADMIN_ADDRESS"), requireAddress("RH_MAINNET_PAUSE_AUTHORITY_ADDRESS")];
  const authorizedRoles = await Promise.all([
    client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: lendingAbi, functionName: "hasRole", args: [lendingRoles[0], riskAdmin] }),
    client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: lendingAbi, functionName: "hasRole", args: [lendingRoles[1], pauseAuthority] }),
  ]);
  assert.ok(authorizedRoles.every(Boolean), "Configured Mainnet risk or pause authority lacks its deployed Lending role.");
  const participantAddresses = [requireAddress("RH_MAINNET_DEMO_PARTICIPANT_A_ADDRESS"), requireAddress("RH_MAINNET_DEMO_PARTICIPANT_B_ADDRESS")];
  for (const participant of participantAddresses) {
    assert.equal(await client.readContract({ address: robinhoodMainnetDemoContracts.lendingPool, abi: lendingAbi, functionName: "isDemoParticipant", args: [participant] }), true, "A configured Mainnet participant is not authorized by the deployed controlled-demo Lending pool.");
  }
  console.log(`Live Robinhood Mainnet preflight: chain ${chainId} · base receipts ${receiptChecks.length}/10 successful · ArbSys L2 block ${l2Block}`);
  console.log("Dependencies: deployed Mainnet registry, Honk verifier adapter, paused demo Lending pool, oracle, and two controlled synthetic assets match their confirmed address registry.");
  console.log("Roles: configured credential issuer, registry administrator, Lending risk administrator, and pause authority match live role reads.");
  console.log("Safety state: Lending remains paused; both synthetic token supplies and oracle prices are zero. This command makes no state changes.");
}

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, env: CHILD_ENV, stdio: "inherit" });
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed with status ${result.status ?? result.error?.message ?? "unknown"}.`);
}

function verifyKeystoreAlias(alias, deployer) {
  assert.ok(/^[A-Za-z0-9._-]+$/.test(alias), "Foundry account alias must be a non-secret alias string.");
  const result = spawnSync("cast", ["wallet", "address", "--account", alias], { cwd: ROOT, env: CHILD_ENV, encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });
  assert.equal(result.status, 0, "The encrypted Foundry keystore could not be unlocked.");
  const addresses = result.stdout.match(/0x[a-fA-F0-9]{40}/g) ?? [];
  assert.ok(addresses.some((address) => getAddress(address) === deployer), "The selected encrypted keystore alias does not match RH_MAINNET_DEPLOYER_ADDRESS.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.preflight) assert.ok(!options.execute && !options.authorization && !options.alias, "Read-only preflight rejects signer and broadcast options.");
  else {
    assert.ok(options.execute, "Deployment is disabled unless --execute is supplied.");
    assert.equal(options.authorization, AUTHORIZATION, `Explicit authorization must equal ${AUTHORIZATION}.`);
    assert.equal(process.stdin.isTTY, true, "Broadcast requires an interactive terminal for encrypted-keystore and final confirmation prompts.");
    assert.ok(options.alias || ACCOUNT_ALIAS, "Provide --account-alias or RH_MAINNET_ACCOUNT.");
  }

  const { deployer } = validateInputConfig();
  assert.equal(deployer, requireAddress("RH_MAINNET_DEPLOYER_ADDRESS"));
  if (!options.preflight) assertFreshDeploymentOutputs();
  const baseReceipts = verifyRecordedBaseDeployment();
  const client = rpcClient();
  await checkLiveDependencies(client, baseReceipts);

  console.log("Running the final no-broadcast DAO Phase 2 simulation on explicitly pinned chain 4663…");
  run("bun", ["run", "robinhood:mainnet:dao2:simulate"]);
  if (options.preflight) {
    console.log("Preflight complete. No keystore was unlocked and no transaction was signed or broadcast.");
    return;
  }

  const alias = options.alias ?? ACCOUNT_ALIAS;
  verifyKeystoreAlias(alias, deployer);
  assert.equal(await client.getChainId(), ROBINHOOD_MAINNET_CHAIN_ID, "The Mainnet RPC chain ID changed after simulation.");
  await checkLiveDependencies(client, baseReceipts);
  const reader = await import("node:readline/promises");
  const confirmation = reader.createInterface({ input: process.stdin, output: process.stdout });
  let answer;
  try { answer = await confirmation.question(`Type exactly “${CONFIRMATION}” to sign and broadcast: `); }
  finally { confirmation.close(); }
  assert.equal(answer, CONFIRMATION, "The final typed authorization did not match.");

  console.log("Broadcasting only the two paused Mainnet DAO Phase 2 contracts through the encrypted Foundry keystore…");
  run("forge", ["script", SCRIPT, "--profile", "robinhood_mainnet", "--chain-id", "4663", "--rpc-url", RPC_URL,
    "--sender", deployer, "--account", alias, "--broadcast"], CONTRACTS);
  console.log("Broadcast returned. Performing receipt, bytecode, dependency, role, parameter, and paused-state readback…");
  run("bun", ["scripts/robinhood-mainnet-dao2-status.mjs"]);
  console.log("Use the two confirmed receipt addresses to populate RH_MAINNET_PHASE2_* and NEXT_PUBLIC_ROBINHOOD_MAINNET_PHASE2_* outputs manually. This command does not edit .env or Vercel settings.");
}

main().catch((error) => {
  const message = String(error?.message ?? error).replace(RPC_URL ?? "\0", "<configured Mainnet RPC>");
  console.error(`Robinhood Mainnet DAO Phase 2 deployment stopped: ${message}`);
  process.exitCode = 1;
});
