#!/usr/bin/env bun
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { createPublicClient, defineChain, getAddress, http, isAddress } from "viem";

const ROOT = process.cwd();
const CONTRACTS = `${ROOT}/contracts`;
const CHAIN_ID = 46_630;
const AUTHORIZATION = "phase2-l2-blockfix-deploy";
const CONFIRMATION = "DEPLOY Robinhood Testnet DAO Phase 2 L2 block fix";
const RPC_URL = process.env.RH_TESTNET_RPC_URL?.trim();
const DEPLOYER = process.env.RH_TESTNET_PHASE2_DEPLOYER_ADDRESS?.trim();
const DEPLOYMENT_SCRIPT = "script/DeployRobinhoodDaoPhase2L2BlockFix.s.sol:DeployRobinhoodDaoPhase2L2BlockFix";
const ROLE_ENV = [
  "RH_TESTNET_PHASE2_DEPLOYER_ADDRESS",
  "RH_TESTNET_PHASE2_ADMIN_ADDRESS",
  "RH_TESTNET_PHASE2_MEMBERSHIP_ISSUER_ADDRESS",
  "RH_TESTNET_PHASE2_REPUTATION_ISSUER_ADDRESS",
  "RH_TESTNET_PHASE2_PAUSE_AUTHORITY_ADDRESS",
  "RH_TESTNET_CREDENTIAL_REGISTRY_ADDRESS",
  "RH_TESTNET_VERIFIER_ADAPTER_ADDRESS",
  "RH_TESTNET_LENDING_V2_POOL_ADDRESS",
  "RH_TESTNET_PHASE2_COMMIT_PERIOD",
  "RH_TESTNET_PHASE2_REVEAL_PERIOD",
  "RH_TESTNET_PHASE2_EXECUTION_WINDOW",
  "RH_TESTNET_PHASE2_QUORUM",
  "RH_TESTNET_PHASE2_MINIMUM_REPUTATION",
];
const CHILD_ENV = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "XDG_CONFIG_HOME"].flatMap((name) => process.env[name] ? [[name, process.env[name]]] : []),
);
for (const name of ROLE_ENV) if (process.env[name] !== undefined) CHILD_ENV[name] = process.env[name];
if (RPC_URL) CHILD_ENV.RH_TESTNET_RPC_URL = RPC_URL;

function fail(message) {
  console.error(message);
  process.exit(2);
}

function parseArgs(args) {
  const parsed = { simulateOnly: false, execute: false, authorization: undefined, accountAlias: undefined };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      console.log(`Read-only simulation: bun run robinhood:dao2:l2fix:simulate\nGuarded deployment requires:\n  --execute --authorize-public-testnet-write=${AUTHORIZATION} --account-alias <Foundry keystore alias>\n\nThe guarded path simulates first, checks chain 46630 and the deployer alias, then requires the typed confirmation:\n  ${CONFIRMATION}`);
      process.exit(0);
    } else if (arg === "--simulate") parsed.simulateOnly = true;
    else if (arg === "--execute") parsed.execute = true;
    else if (arg.startsWith("--authorize-public-testnet-write=")) parsed.authorization = arg.split("=")[1];
    else if (arg === "--account-alias") parsed.accountAlias = args[++i];
    else if (arg.startsWith("--account-alias=")) parsed.accountAlias = arg.split("=")[1];
    else fail(`Unknown option: ${arg}`);
  }
  return parsed;
}

function redact(text) {
  return RPC_URL ? text.replaceAll(RPC_URL, "[RPC URL redacted]") : text;
}

function runLogged(command, args, cwd, secrets = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: CHILD_ENV, stdio: ["inherit", "pipe", "pipe"] });
    const attach = (stream, destination) => {
      let pending = "";
      const hold = Math.max(0, ...secrets.map((secret) => secret.length - 1));
      stream.on("data", (chunk) => {
        const combined = pending + chunk.toString();
        const splitAt = Math.max(0, combined.length - hold);
        destination.write(redact(combined.slice(0, splitAt)));
        pending = combined.slice(splitAt);
      });
      stream.on("end", () => destination.write(redact(pending)));
    };
    attach(child.stdout, process.stdout);
    attach(child.stderr, process.stderr);
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function runAddressCheck(alias) {
  const result = spawnSync("cast", ["wallet", "address", "--account", alias], {
    cwd: ROOT,
    env: CHILD_ENV,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  assert.equal(result.status, 0, "Could not unlock the specified encrypted Foundry keystore alias.");
  const found = result.stdout.match(/0x[a-fA-F0-9]{40}/g) ?? [];
  assert.ok(found.some((address) => getAddress(address) === getAddress(DEPLOYER)), "Keystore alias does not match the configured Phase 2 deployer address.");
}

function requireRpc() {
  assert.ok(RPC_URL, "RH_TESTNET_RPC_URL is required.");
  const chain = defineChain({
    id: CHAIN_ID,
    name: "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  });
  return createPublicClient({ chain, transport: http(RPC_URL, { timeout: 15_000, retryCount: 1 }) });
}

async function runSimulation() {
  console.log("Compiling the replacement Phase 2 contracts…");
  const buildExit = await runLogged("bun", ["run", "contracts:build"], ROOT);
  assert.equal(buildExit, 0, "Contract build failed; simulation and broadcast stopped.");
  console.log("Running the no-broadcast replacement deployment simulation…");
  const simulationExit = await runLogged("bash", [
    "scripts/forge-simulate.sh",
    DEPLOYMENT_SCRIPT,
    "--profile", "robinhood_testnet",
    "--chain-id", String(CHAIN_ID),
    "--rpc-url", RPC_URL,
  ], ROOT, [RPC_URL]);
  assert.equal(simulationExit, 0, "Replacement deployment simulation failed; no broadcast was attempted.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.simulateOnly) {
    assert.ok(!options.execute && !options.authorization && !options.accountAlias, "Simulation mode rejects signer and execution options.");
    const client = requireRpc();
    assert.equal(await client.getChainId(), CHAIN_ID, "Configured RPC is not Robinhood Testnet chain 46630.");
    await runSimulation();
    console.log("Simulation only: no signer was unlocked and no transaction was broadcast.");
    return;
  }
  assert.ok(options.execute, "Deployment is disabled unless --execute is supplied.");
  assert.equal(options.authorization, AUTHORIZATION, `Explicit authorization must equal ${AUTHORIZATION}.`);
  assert.ok(options.accountAlias && /^[A-Za-z0-9._-]+$/.test(options.accountAlias), "Provide a non-secret Foundry keystore alias.");
  assert.equal(process.stdin.isTTY, true, "Guarded deployment requires an interactive terminal for the final confirmation.");
  assert.ok(DEPLOYER && isAddress(DEPLOYER), "RH_TESTNET_PHASE2_DEPLOYER_ADDRESS is missing or invalid.");

  const client = requireRpc();
  assert.equal(await client.getChainId(), CHAIN_ID, "Configured RPC is not Robinhood Testnet chain 46630.");

  await runSimulation();

  runAddressCheck(options.accountAlias);
  console.log("Encrypted keystore alias matches the configured deployer.");
  assert.equal(await client.getChainId(), CHAIN_ID, "RPC chain ID changed before broadcast.");

  const reader = createInterface({ input: process.stdin, output: process.stdout });
  let answer;
  try { answer = await reader.question(`Type exactly “${CONFIRMATION}” to sign and broadcast: `); }
  finally { reader.close(); }
  assert.equal(answer, CONFIRMATION, "Typed deployment authorization did not match.");

  console.log("Submitting the two paused replacement contracts to Robinhood Testnet…");
  const broadcastExit = await runLogged("forge", [
    "script", DEPLOYMENT_SCRIPT,
    "--profile", "robinhood_testnet",
    "--chain-id", String(CHAIN_ID),
    "--rpc-url", RPC_URL,
    "--account", options.accountAlias,
    "--broadcast",
  ], CONTRACTS, [RPC_URL]);
  assert.equal(broadcastExit, 0, "Foundry deployment returned a failure; inspect its genuine receipt artifact before retrying.");
  console.log("Deployment command completed. Verify both receipts and paused states before updating any address configuration.");
}

main().catch((error) => {
  console.error(`DAO Phase 2 L2-fix deployment stopped: ${redact(String(error?.message ?? error))}`);
  process.exitCode = 1;
});
