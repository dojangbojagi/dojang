#!/usr/bin/env bun
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import {
  createPublicClient, decodeEventLog, defineChain, encodeFunctionData, getAddress,
  http, isAddress, keccak256, maxUint256, parseAbi, toBytes, zeroAddress,
} from "viem";
import {
  controlledTestOracleAbi, controlledTokenAbi, eligibilityVerifierAdapterAbi,
  eligibilityVerifierProofAbi, lendingPoolV2Abi,
} from "../src/lib/contracts/abis.ts";
import { generateEligibilityProofFromArtifact, initializeEligibilityProverSrs } from "../src/lib/zk/eligibility-prover.ts";
import { parseDemoCredentialWitness } from "../src/lib/credential/witness.ts";
import { ROBINHOOD_MAINNET_CHAIN_ID, robinhoodMainnetDemoContracts as contracts } from "../src/lib/config/robinhood-mainnet-demo.ts";
import {
  assertActiveCredential, assertParticipantAddress, assertPositiveBaseUnits,
  assertPrivateWitnessFile, assertWitnessForParticipant, gasLimitWithHeadroom,
  LENDING_USER_ALIASES, parseParticipantLabel,
  repaymentAllowanceRequired, requireActionAuthorization, transactionConfirmationPhrase,
} from "./robinhood-mainnet-lending-user-core.mjs";

const CHAIN_ID = ROBINHOOD_MAINNET_CHAIN_ID;
const EXPLORER = "https://robinhoodchain.blockscout.com";
const CIRCUIT_PATH = new URL("../public/circuits/private_eligibility.json", import.meta.url);
const POLICY_ID = 3n;
const POLICY_VERSION = 1n;
const THRESHOLD = 1_000n;
const ZERO_PROOF_INPUTS = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
const credentialAbi = parseAbi([
  "function ISSUER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)",
  "function getCredential(address,uint256) view returns ((address wallet,bytes32 commitment,address issuer,uint64 issuedAt,uint64 expiresAt,uint64 version,bool revoked))",
]);
const poolGuardAbi = parseAbi([
  "function PAUSER_ROLE() view returns (bytes32)", "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function RISK_ADMIN_ROLE() view returns (bytes32)", "function hasRole(bytes32,address) view returns (bool)",
  "function paused() view returns (bool)", "function demoOnly() view returns (bool)",
  "function isDemoParticipant(address) view returns (bool)", "function credentialRegistry() view returns (address)",
  "function eligibilityVerifier() view returns (address)", "function priceOracle() view returns (address)",
  "function demoLoanAsset() view returns (address)", "function demoCollateralAsset() view returns (address)",
]);

function addressFromEnv(name) {
  const value = process.env[name]?.trim();
  assert.ok(value && isAddress(value), `${name} is missing or invalid.`);
  return getAddress(value);
}

function roles() {
  const a = addressFromEnv("RH_MAINNET_DEMO_PARTICIPANT_A_ADDRESS");
  const b = addressFromEnv("RH_MAINNET_DEMO_PARTICIPANT_B_ADDRESS");
  assert.notEqual(a.toLowerCase(), b.toLowerCase(), "Mainnet participants must be two distinct wallets.");
  return { A: a, B: b };
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--execute") options.execute = true;
    else if (arg.startsWith("--authorize-mainnet-lending-user-write=")) options.authorization = arg.split("=", 2)[1];
    else if (arg === "--account-alias") options.accountAlias = argv[++index];
    else if (arg.startsWith("--account-alias=")) options.accountAlias = arg.split("=", 2)[1];
    else positional.push(arg);
  }
  return { positional, options };
}

function srsCacheStatus() {
  const directory = process.env.CRS_PATH?.trim() || path.join(os.homedir(), ".bb-crs");
  const files = {
    "bn254_g1_compressed.dat": 2 ** 17 * 32,
    "bn254_g1.dat": 2 ** 17 * 64,
    "bn254_g2.dat": 128,
    "grumpkin_g1_v2.flat.dat": 2 ** 16 * 64,
  };
  const present = {};
  for (const [name, minimum] of Object.entries(files)) {
    try { present[name] = fs.statSync(path.join(directory, name)).size; }
    catch { present[name] = 0; }
  }
  const g1Ready = present["bn254_g1.dat"] >= files["bn254_g1.dat"] ||
    (present["bn254_g1_compressed.dat"] >= files["bn254_g1_compressed.dat"] && present["bn254_g1_compressed.dat"] % 32 === 0);
  const ready = g1Ready && present["bn254_g2.dat"] === 128 && present["grumpkin_g1_v2.flat.dat"] >= files["grumpkin_g1_v2.flat.dat"];
  return { directory, present, ready };
}

function rpc() {
  const url = process.env.RH_MAINNET_RPC_URL?.trim();
  assert.ok(url, "RH_MAINNET_RPC_URL is required; no RPC fallback is permitted.");
  const chain = defineChain({
    id: CHAIN_ID,
    name: "Robinhood Chain Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [url] } },
  });
  return { url, client: createPublicClient({ chain, transport: http(url, { timeout: 15_000, retryCount: 2 }) }) };
}

function tuple(value, name, index) {
  const field = Array.isArray(value) ? value[index] : value?.[name];
  assert.notEqual(field, undefined, `RPC read omitted ${name}.`);
  return field;
}

function isFreshPrice(value, now, maxAge) {
  const price = BigInt(tuple(value, "priceWad", 2));
  const updatedAt = BigInt(tuple(value, "updatedAt", 3));
  return price > 0n && updatedAt > 0n && updatedAt <= BigInt(now) && BigInt(now) - updatedAt <= BigInt(maxAge);
}

function formatUnits(value, decimals) {
  const base = 10n ** BigInt(decimals);
  const n = BigInt(value);
  return `${n / base}.${(n % base).toString().padStart(Number(decimals), "0")}`.replace(/\.?0+$/, "");
}

async function context() {
  const { url, client } = rpc();
  assert.equal(await client.getChainId(), CHAIN_ID, "RH_MAINNET_RPC_URL is not chain 4663.");
  const participants = roles();
  const bytecodeTargets = [
    contracts.lendingPool, contracts.loanToken, contracts.collateralToken,
    contracts.credentialRegistry, contracts.oracle, contracts.verifierAdapter, contracts.honkVerifier,
  ];
  for (const target of bytecodeTargets) {
    const code = target ? await client.getBytecode({ address: target }) : undefined;
    assert.ok(code && code !== "0x", `Expected Mainnet contract has no runtime bytecode: ${target ?? "unconfigured"}.`);
  }
  const [poolDemo, registry, verifier, oracle, loan, collateral, adapterVerifier, loanDemo, collateralDemo, loanMarker, collateralMarker, loanDecimals, collateralDecimals, paused] = await Promise.all([
    client.readContract({ address: contracts.lendingPool, abi: poolGuardAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.lendingPool, abi: poolGuardAbi, functionName: "credentialRegistry" }),
    client.readContract({ address: contracts.lendingPool, abi: poolGuardAbi, functionName: "eligibilityVerifier" }),
    client.readContract({ address: contracts.lendingPool, abi: poolGuardAbi, functionName: "priceOracle" }),
    client.readContract({ address: contracts.lendingPool, abi: poolGuardAbi, functionName: "demoLoanAsset" }),
    client.readContract({ address: contracts.lendingPool, abi: poolGuardAbi, functionName: "demoCollateralAsset" }),
    client.readContract({ address: contracts.verifierAdapter, abi: eligibilityVerifierAdapterAbi, functionName: "honkVerifier" }),
    client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.collateralToken, abi: controlledTokenAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "controlledDemoAssetMarker" }),
    client.readContract({ address: contracts.collateralToken, abi: controlledTokenAbi, functionName: "controlledDemoAssetMarker" }),
    client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "decimals" }),
    client.readContract({ address: contracts.collateralToken, abi: controlledTokenAbi, functionName: "decimals" }),
    client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "paused" }),
  ]);
  assert.equal(poolDemo, true, "Mainnet pool is not marked demo-only.");
  assert.equal(getAddress(registry).toLowerCase(), contracts.credentialRegistry.toLowerCase(), "Pool credential-registry dependency differs from Mainnet registry.");
  assert.equal(getAddress(verifier).toLowerCase(), contracts.verifierAdapter.toLowerCase(), "Pool verifier dependency differs from Mainnet registry.");
  assert.equal(getAddress(oracle).toLowerCase(), contracts.oracle.toLowerCase(), "Pool oracle dependency differs from Mainnet registry.");
  assert.equal(getAddress(loan).toLowerCase(), contracts.loanToken.toLowerCase(), "Pool loan-token dependency differs from Mainnet registry.");
  assert.equal(getAddress(collateral).toLowerCase(), contracts.collateralToken.toLowerCase(), "Pool collateral-token dependency differs from Mainnet registry.");
  assert.equal(getAddress(adapterVerifier).toLowerCase(), contracts.honkVerifier.toLowerCase(), "Verifier adapter points to an unexpected HonkVerifier.");
  const expectedMarker = keccak256(toBytes("ROBINHOOD_MAINNET_CONTROLLED_DEMO_ASSET_V1")).slice(0, 10);
  assert.equal(loanDemo && collateralDemo, true, "Both Mainnet tokens must be marked demo-only.");
  assert.equal(String(loanMarker).toLowerCase(), expectedMarker, "dUSD controlled-demo asset marker mismatch.");
  assert.equal(String(collateralMarker).toLowerCase(), expectedMarker, "dCOL controlled-demo asset marker mismatch.");
  return { url, client, participants, paused, loanDecimals, collateralDecimals };
}

async function positionState(ctx, wallet) {
  const [loanSymbol, collateralSymbol, loanBalance, collateralBalance, loanAllowance, collateralAllowance,
    loanPosition, collateralPosition, debt, loanSupply, collateralLiquidity, participant] = await Promise.all([
    ctx.client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "symbol" }),
    ctx.client.readContract({ address: contracts.collateralToken, abi: controlledTokenAbi, functionName: "symbol" }),
    ctx.client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "balanceOf", args: [wallet] }),
    ctx.client.readContract({ address: contracts.collateralToken, abi: controlledTokenAbi, functionName: "balanceOf", args: [wallet] }),
    ctx.client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "allowance", args: [wallet, contracts.lendingPool] }),
    ctx.client.readContract({ address: contracts.collateralToken, abi: controlledTokenAbi, functionName: "allowance", args: [wallet, contracts.lendingPool] }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getPosition", args: [wallet, contracts.loanToken] }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getPosition", args: [wallet, contracts.collateralToken] }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [wallet, contracts.loanToken] }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "availableLiquidity", args: [contracts.loanToken] }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "availableLiquidity", args: [contracts.collateralToken] }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "isDemoParticipant", args: [wallet] }),
  ]);
  return { loanSymbol, collateralSymbol, loanBalance, collateralBalance, loanAllowance, collateralAllowance,
    loanPosition, collateralPosition, debt, loanSupply, collateralLiquidity, participant };
}

async function printStatus(ctx, label, wallet) {
  const [state, now, loanPrice, collateralPrice, credential, issuerRole, loanConfig, collateralConfig] = await Promise.all([
    positionState(ctx, wallet), ctx.client.getBlock({ blockTag: "latest" }),
    ctx.client.readContract({ address: contracts.oracle, abi: controlledTestOracleAbi, functionName: "getPriceBounds", args: [contracts.loanToken] }),
    ctx.client.readContract({ address: contracts.oracle, abi: controlledTestOracleAbi, functionName: "getPriceBounds", args: [contracts.collateralToken] }),
    ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "getCredential", args: [wallet, POLICY_ID] }),
    ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "ISSUER_ROLE" }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getReserveConfig", args: [contracts.loanToken] }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getReserveConfig", args: [contracts.collateralToken] }),
  ]);
  const active = credential.wallet.toLowerCase() === wallet.toLowerCase() && !credential.revoked && credential.issuedAt <= now.timestamp && credential.expiresAt > now.timestamp;
  const trustedIssuer = active && await ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "hasRole", args: [issuerRole, credential.issuer] });
  const loanFresh = isFreshPrice(loanPrice, now.timestamp, tuple(loanConfig, "maxOracleAge", 4));
  const collateralFresh = isFreshPrice(collateralPrice, now.timestamp, tuple(collateralConfig, "maxOracleAge", 4));
  const accountData = loanFresh && collateralFresh
    ? await ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getAccountData", args: [wallet] })
    : undefined;
  console.log(`Wallet ${label}: ${wallet}`);
  console.log(`  allowlisted=${state.participant} · Policy 3=${active && trustedIssuer ? `ACTIVE v${credential.version}` : active ? "issuer no longer authorized" : "not active"} · pool=${ctx.paused ? "PAUSED" : "ACTIVE"}`);
  console.log(`  ${state.loanSymbol}: wallet=${formatUnits(state.loanBalance, ctx.loanDecimals)} · supply=${formatUnits(state.loanPosition[0], ctx.loanDecimals)} · debt=${formatUnits(state.debt, ctx.loanDecimals)} · allowance=${state.loanAllowance}`);
  console.log(`  ${state.collateralSymbol}: wallet=${formatUnits(state.collateralBalance, ctx.collateralDecimals)} · collateral=${formatUnits(state.collateralPosition[1], ctx.collateralDecimals)} · enabled=${state.collateralPosition[3]} · allowance=${state.collateralAllowance}`);
  console.log(`  account health factor WAD=${accountData?.healthFactorWad ?? "unavailable until both prices are fresh"} · loan liquidity=${state.loanSupply} · collateral reserve liquidity=${state.collateralLiquidity}`);
  console.log(`  synthetic oracle prices: dUSD=${tuple(loanPrice, "priceWad", 2)} WAD (${loanFresh ? "FRESH" : "UNSEEDED/STALE"}) · dCOL=${tuple(collateralPrice, "priceWad", 2)} WAD (${collateralFresh ? "FRESH" : "UNSEEDED/STALE"})`);
}

function readPrivateWitness(file, participant) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  assertPrivateWitnessFile({ isFile: stat.isFile(), isSymbolicLink: stat.isSymbolicLink(), mode: stat.mode, size: stat.size });
  const witness = parseDemoCredentialWitness(JSON.parse(fs.readFileSync(absolute, "utf8")));
  return assertWitnessForParticipant(witness, participant);
}

async function buildProof(ctx, wallet, witnessFile, onProgress) {
  const witness = readPrivateWitness(witnessFile, wallet);
  const [block, record, issuerRole, policyId, policyVersion, threshold] = await Promise.all([
    ctx.client.getBlock({ blockTag: "latest" }),
    ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "getCredential", args: [wallet, POLICY_ID] }),
    ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "ISSUER_ROLE" }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "POLICY_ID" }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "POLICY_VERSION" }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "ELIGIBILITY_THRESHOLD" }),
  ]);
  assert.equal(BigInt(policyId), POLICY_ID, "Deployed pool does not accept Policy 3.");
  assert.equal(BigInt(policyVersion), POLICY_VERSION, "Deployed pool policy version differs from the witness contract.");
  assert.equal(BigInt(threshold), THRESHOLD, "Deployed pool eligibility threshold differs from the expected circuit context.");
  assertActiveCredential(record, wallet, block.timestamp);
  assert.equal(record.issuer.toLowerCase() === zeroAddress.toLowerCase(), false, "Credential issuer is zero address.");
  assert.equal(record.revoked, false, "Policy 3 credential is revoked.");
  assert.equal(record.commitment.toLowerCase(), witness.commitment.toLowerCase(), "Policy 3 witness commitment does not match the active Mainnet record.");
  assert.equal(BigInt(witness.expiresAt), record.expiresAt, "Policy 3 witness expiry does not match the active Mainnet record.");
  assert.equal(await ctx.client.readContract({ address: contracts.credentialRegistry, abi: credentialAbi, functionName: "hasRole", args: [issuerRole, record.issuer] }), true, "Credential issuer is no longer trusted by the deployed registry.");
  const circuit = JSON.parse(fs.readFileSync(CIRCUIT_PATH, "utf8"));
  const proofContext = {
    subject: wallet,
    commitment: record.commitment,
    policyId: POLICY_ID,
    policyVersion: POLICY_VERSION,
    threshold: THRESHOLD,
    credentialVersion: record.version,
    expiresAt: record.expiresAt,
    chainId: BigInt(CHAIN_ID),
    vault: contracts.lendingPool,
  };
  const proof = await generateEligibilityProofFromArtifact(witness, proofContext, circuit, onProgress);
  assert.equal(proof.localVerification, "verified", "The local Barretenberg verifier rejected the generated proof.");
  const accepted = await ctx.client.readContract({ address: contracts.verifierAdapter, abi: eligibilityVerifierProofAbi, functionName: "verifyProof", args: [proof.proof, proof.publicInputs] });
  assert.equal(accepted, true, "The deployed Mainnet verifier adapter rejected this real Policy 3 proof.");
  return proof;
}

async function verifyAlias(alias, expectedAddress) {
  assert.ok(alias && /^[A-Za-z0-9._-]+$/.test(alias), "Account alias is missing or malformed.");
  assert.ok(process.stdin.isTTY, "Unlock verification requires a local interactive terminal; no keystore password is read from arguments or environment.");
  const result = spawnSync("cast", ["wallet", "address", "--account", alias], { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });
  assert.equal(result.status, 0, "Foundry could not unlock the encrypted wallet alias.");
  const derived = result.stdout.match(/0x[a-fA-F0-9]{40}/g) ?? [];
  assert.ok(derived.some((address) => getAddress(address).toLowerCase() === expectedAddress.toLowerCase()), `Encrypted wallet alias ${alias} does not resolve to the selected participant ${expectedAddress}.`);
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return await rl.question(question); } finally { rl.close(); }
}

function redactRpc(text, url) {
  return String(text).replaceAll(url, "<configured Mainnet RPC>");
}

function hasPoolEvent(ctx, receipt, eventName, predicate) {
  return receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== contracts.lendingPool.toLowerCase()) return false;
    try {
      const event = decodeEventLog({ abi: lendingPoolV2Abi, data: log.data, topics: log.topics, strict: true });
      return event.eventName === eventName && predicate(event.args);
    } catch { return false; }
  });
}

function poolEventArgs(receipt, eventName, predicate) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contracts.lendingPool.toLowerCase()) continue;
    try {
      const event = decodeEventLog({ abi: lendingPoolV2Abi, data: log.data, topics: log.topics, strict: true });
      if (event.eventName === eventName && predicate(event.args)) return event.args;
    } catch { /* Skip unrelated pool events. */ }
  }
  return undefined;
}

async function writeParticipant(ctx, action, wallet, alias, target, abi, functionName, args, proofInputs, options, expectedEvent, readback) {
  const request = { account: wallet, address: target, abi, functionName, args };
  const simulation = await ctx.client.simulateContract(request);
  const estimatedGas = await ctx.client.estimateContractGas(simulation.request);
  const gasLimit = gasLimitWithHeadroom(estimatedGas);
  const [balance, gasPrice] = await Promise.all([ctx.client.getBalance({ address: wallet }), ctx.client.getGasPrice()]);
  const gasBudget = gasLimit * gasPrice;
  console.log(`PASS read-only simulation · ${action} · chain ${CHAIN_ID} · wallet ${wallet} · estimated gas ${estimatedGas} · gas-limit buffer ${gasLimit}.`);
  console.log(`Native balance ${balance} wei · current fee estimate ${gasBudget} wei before chain-specific data fee.`);
  if (!options.execute) return console.log("Simulation only. No wallet was unlocked; no signature or Mainnet transaction was requested.");
  requireActionAuthorization(action, options.authorization);
  assert.ok(process.stdin.isTTY, "Execution requires a local interactive terminal.");
  assert.ok(balance >= gasBudget, "Participant balance is below the estimated gas requirement plus 20% gas-limit headroom.");
  await verifyAlias(alias, wallet);
  const phrase = transactionConfirmationPhrase(action, wallet);
  assert.equal(await prompt(`Type exactly “${phrase}” after reviewing the operation: `), phrase, "Transaction confirmation phrase did not match.");
  // Re-check chain just before invoking Foundry, then let cast prompt for the encrypted keystore locally.
  assert.equal(await ctx.client.getChainId(), CHAIN_ID, "Mainnet chain changed before signing.");
  const data = encodeFunctionData({ abi, functionName, args });
  const child = spawnSync("cast", ["send", "--chain", String(CHAIN_ID), "--account", alias, "--async", "--gas-limit", String(gasLimit), "--data", data, target], {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...process.env, ETH_RPC_URL: ctx.url },
  });
  if (child.stderr) process.stderr.write(redactRpc(child.stderr, ctx.url));
  assert.equal(child.status, 0, redactRpc(child.stdout || child.stderr || "Foundry transaction submission failed.", ctx.url));
  const hash = child.stdout.match(/0x[a-fA-F0-9]{64}/)?.[0];
  assert.ok(hash, "Foundry returned no transaction hash.");
  console.log(`Submitted ${hash} · waiting for canonical receipt.`);
  const receipt = await ctx.client.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success", `Transaction receipt reverted: ${hash}`);
  assert.equal(receipt.transactionHash.toLowerCase(), hash.toLowerCase(), "Receipt hash differs from submitted transaction.");
  const canonicalTx = await ctx.client.getTransaction({ hash });
  assert.equal(canonicalTx.chainId, CHAIN_ID, "Submitted participant transaction is not on Mainnet chain 4663.");
  assert.equal(canonicalTx.from.toLowerCase(), wallet.toLowerCase(), "Canonical transaction sender differs from selected participant wallet.");
  assert.equal(canonicalTx.to?.toLowerCase(), target.toLowerCase(), "Canonical transaction target differs from simulated contract.");
  assert.equal(canonicalTx.input.toLowerCase(), data.toLowerCase(), "Canonical transaction calldata differs from the simulated operation.");
  if (expectedEvent) assert.ok(hasPoolEvent(ctx, receipt, expectedEvent.name, expectedEvent.matches), `Successful receipt is missing the expected ${expectedEvent.name} event.`);
  let confirmed = false;
  let lastReadError;
  for (const delay of [0, 500, 1500, 3000]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try { confirmed = await readback(receipt); if (confirmed) break; }
    catch (error) { lastReadError = error; }
  }
  assert.ok(confirmed, `Receipt ${hash} succeeded, but post-state readback was not confirmed${lastReadError ? ` (${lastReadError.name})` : ""}.`);
  console.log(`CONFIRMED ${hash}\n${EXPLORER}/tx/${hash}`);
}

async function actionContext(ctx, label, requireUnpaused) {
  const wallet = assertParticipantAddress(label, ctx.participants[label], ctx.participants[label]);
  const [allowed, paused] = await Promise.all([
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "isDemoParticipant", args: [wallet] }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "paused" }),
  ]);
  assert.equal(allowed, true, `Wallet ${label} is not on the live Mainnet controlled-demo allowlist.`);
  if (requireUnpaused) assert.equal(paused, false, "Risk-increasing actions are blocked while the Mainnet Lending pool is paused.");
  return wallet;
}

async function requireProof(ctx, label, file) {
  const wallet = ctx.participants[label];
  const proof = await buildProof(ctx, wallet, file, (stage) => console.log(`Proof: ${stage}`));
  console.log("PASS genuine Policy 3 proof: local Barretenberg verification and live Mainnet adapter call accepted it. Proof bytes and private witness values withheld.");
  return proof;
}

async function executeCommand() {
  const command = process.argv[2] ?? "help";
  const { positional, options } = parseArgs(process.argv.slice(3));
  if (command === "help" || command === "--help") {
    console.log(`Robinhood Mainnet participant Lending operator · chain ${CHAIN_ID}\n\nLocal prover cache:\n  crs-status\n  crs-check  (downloads/caches official Aztec SRS files; no chain access)\n\nRead-only:\n  status <A|B>\n  check-wallet-alias B\n  proof <A|B> <private-policy3-witness.json>\n\nSimulated by default (base-unit amounts only):\n  approve <A|B> <loan|collateral> <amount>\n  approve-repay <A|B>\n  supply <A|B> <amount> <private-policy3-witness.json>\n  deposit-collateral <A|B> <amount>\n  enable-collateral <A|B> <private-policy3-witness.json>\n  borrow <A|B> <amount> <private-policy3-witness.json>\n  repay-all <A|B>\n  withdraw-supply <A|B> <amount>\n  withdraw-collateral <A|B> <amount>\n\nWallet A signs from MetaMask in the browser; it has no default Foundry alias. Wallet B uses its matching encrypted alias. Signed CLI writes require --execute, the exact --authorize-mainnet-lending-user-write=<action> flag, a matching alias, and typed per-transaction confirmation. No credentials, witnesses, keystore data, or private keys are emitted.`);
    return;
  }
  if (command === "crs-status") {
    const cache = srsCacheStatus();
    console.log(`Barretenberg 5.2.1 local SRS cache: ${cache.ready ? "READY" : "INCOMPLETE"} · ${cache.directory}`);
    for (const [name, size] of Object.entries(cache.present)) console.log(`  ${name}: ${size ? `${size} bytes` : "missing"}`);
    if (!cache.ready) process.exitCode = 1;
    return;
  }
  if (command === "crs-check") {
    console.log("Initializing the pinned Barretenberg 5.2.1 WASM CRS/SRS. The package uses its primary Aztec CRS host and built-in fallback, then caches locally.");
    try {
      await initializeEligibilityProverSrs((stage) => console.log(stage));
    } catch {
      console.error("CRS initialization failed: required CRS/SRS cache is incomplete and the configured HTTPS sources could not be reached.");
      process.exitCode = 1;
      return;
    }
    const cache = srsCacheStatus();
    assert.ok(cache.ready, "Barretenberg initialized, but its local CRS cache did not pass the expected file-size checks.");
    console.log(`PASS Barretenberg SRS initialization and local cache verification · ${cache.directory}. No chain access or wallet was used.`);
    return;
  }
  if (command === "check-wallet-alias") {
    const label = parseParticipantLabel(positional[0]);
    const configured = roles();
    const expected = assertParticipantAddress(label, configured[label], configured[label]);
    const alias = options.accountAlias ?? LENDING_USER_ALIASES[label];
    assert.ok(alias, `Wallet ${label} is configured for browser-wallet signing; connect MetaMask and verify the displayed address in the app instead of unlocking the legacy Foundry alias.`);
    await verifyAlias(alias, expected);
    console.log(`PASS: ${alias} resolves to Wallet ${label} ${expected}. No transaction was signed or submitted.`);
    return;
  }
  const ctx = await context();
  const label = parseParticipantLabel(positional[0]);
  const wallet = ctx.participants[label];
  if (command === "status") return printStatus(ctx, label, wallet);
  if (command === "proof") {
    assert.ok(positional[1], "Use proof <A|B> <private-policy3-witness.json>.");
    await actionContext(ctx, label, false);
    await requireProof(ctx, label, positional[1]);
    return;
  }
  const alias = options.accountAlias ?? LENDING_USER_ALIASES[label];
  if (options.execute && label === "A" && !options.accountAlias) {
    throw new Error("Wallet A is MetaMask-controlled. Submit its transaction from the connected browser wallet; the inaccessible legacy Foundry alias is never used as a fallback.");
  }
  const eventFor = (name, fields) => ({ name, matches: (args) => Object.entries(fields).every(([key, value]) => {
    const actual = args[key];
    return typeof value === "bigint" ? BigInt(actual) === value : typeof value === "boolean" ? actual === value : String(actual).toLowerCase() === String(value).toLowerCase();
  }) });
  const tokenInfo = async (type) => {
    assert.ok(type === "loan" || type === "collateral", "Token must be loan or collateral.");
    return type === "loan" ? { address: contracts.loanToken, decimals: ctx.loanDecimals } : { address: contracts.collateralToken, decimals: ctx.collateralDecimals };
  };
  if (command === "approve" || command === "approve-repay") {
    const token = command === "approve-repay" ? { address: contracts.loanToken, decimals: ctx.loanDecimals } : await tokenInfo(positional[1]);
    const amount = command === "approve-repay"
      ? await (async () => {
        const [debt, reserve] = await Promise.all([
          ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [wallet, contracts.loanToken] }),
          ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getReserveData", args: [contracts.loanToken] }),
        ]);
        assert.ok(debt > 0n, "Wallet has no Mainnet dUSD debt to repay.");
        const rate = BigInt(tuple(reserve, "currentBorrowRateBps", 7));
        return repaymentAllowanceRequired(debt, rate);
      })()
      : assertPositiveBaseUnits(positional[2]);
    const walletAddress = await actionContext(ctx, label, false);
    const balance = await ctx.client.readContract({ address: token.address, abi: controlledTokenAbi, functionName: "balanceOf", args: [walletAddress] });
    assert.ok(balance >= amount, "Approval amount exceeds the current token balance; choose the exact amount this wallet can spend.");
    const current = await ctx.client.readContract({ address: token.address, abi: controlledTokenAbi, functionName: "allowance", args: [walletAddress, contracts.lendingPool] });
    if (current >= amount) return console.log(`SKIPPED: current allowance ${current} already covers the requested spend ${amount}.`);
    const operation = command === "approve-repay" ? "approve-repay" : "approve";
    return writeParticipant(ctx, operation, walletAddress, alias, token.address, controlledTokenAbi, "approve", [contracts.lendingPool, amount], undefined, options, undefined,
      async () => (await ctx.client.readContract({ address: token.address, abi: controlledTokenAbi, functionName: "allowance", args: [walletAddress, contracts.lendingPool] })) >= amount);
  }
  if (command === "supply") {
    const amount = assertPositiveBaseUnits(positional[1]);
    assert.ok(positional[2], "Supply requires a local Policy 3 witness file.");
    const walletAddress = await actionContext(ctx, label, true);
    const proof = await requireProof(ctx, label, positional[2]);
    const before = await ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getSupplyBalance", args: [walletAddress, contracts.loanToken] });
    const balance = await ctx.client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "balanceOf", args: [walletAddress] });
    const allowance = await ctx.client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "allowance", args: [walletAddress, contracts.lendingPool] });
    assert.ok(balance >= amount, "Insufficient dUSD balance."); assert.ok(allowance >= amount, "Insufficient pool allowance; simulate and approve exact dUSD first.");
    return writeParticipant(ctx, command, walletAddress, alias, contracts.lendingPool, lendingPoolV2Abi, "supply", [contracts.loanToken, amount, proof.proof, [...proof.publicInputs]], options,
      eventFor("LiquiditySupplied", { asset: contracts.loanToken, supplier: walletAddress, amount }),
      async () => {
        const [after, balanceAfter] = await Promise.all([
          ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getSupplyBalance", args: [walletAddress, contracts.loanToken] }),
          ctx.client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "balanceOf", args: [walletAddress] }),
        ]);
        return after > before && balanceAfter === balance - amount;
      });
  }
  if (command === "deposit-collateral") {
    const amount = assertPositiveBaseUnits(positional[1]);
    const walletAddress = await actionContext(ctx, label, true);
    const [balance, allowance, before] = await Promise.all([
      ctx.client.readContract({ address: contracts.collateralToken, abi: controlledTokenAbi, functionName: "balanceOf", args: [walletAddress] }),
      ctx.client.readContract({ address: contracts.collateralToken, abi: controlledTokenAbi, functionName: "allowance", args: [walletAddress, contracts.lendingPool] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getCollateralBalance", args: [walletAddress, contracts.collateralToken] }),
    ]);
    assert.ok(balance >= amount, "Insufficient dCOL balance."); assert.ok(allowance >= amount, "Insufficient pool allowance; simulate and approve exact dCOL first.");
    return writeParticipant(ctx, command, walletAddress, alias, contracts.lendingPool, lendingPoolV2Abi, "depositCollateral", [contracts.collateralToken, amount], options,
      eventFor("CollateralDeposited", { asset: contracts.collateralToken, user: walletAddress, amount }),
      async () => {
        const [after, balanceAfter] = await Promise.all([
          ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getCollateralBalance", args: [walletAddress, contracts.collateralToken] }),
          ctx.client.readContract({ address: contracts.collateralToken, abi: controlledTokenAbi, functionName: "balanceOf", args: [walletAddress] }),
        ]);
        return after === before + amount && balanceAfter === balance - amount;
      });
  }
  if (command === "enable-collateral") {
    assert.ok(positional[1], "Use enable-collateral <A|B> <private-policy3-witness.json>.");
    const walletAddress = await actionContext(ctx, label, true);
    const proof = await requireProof(ctx, label, positional[1]);
    return writeParticipant(ctx, command, walletAddress, alias, contracts.lendingPool, lendingPoolV2Abi, "setCollateralEnabled", [contracts.collateralToken, true, proof.proof, [...proof.publicInputs]], options,
      eventFor("CollateralUseChanged", { asset: contracts.collateralToken, user: walletAddress, enabled: true }),
      async () => (await ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getPosition", args: [walletAddress, contracts.collateralToken] }))[3] === true);
  }
  if (command === "borrow") {
    const amount = assertPositiveBaseUnits(positional[1]);
    assert.ok(positional[2], "Borrow requires a local Policy 3 witness file.");
    const walletAddress = await actionContext(ctx, label, true);
    const proof = await requireProof(ctx, label, positional[2]);
    const [before, maxBorrowable, available, balanceBefore] = await Promise.all([
      ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [walletAddress, contracts.loanToken] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getMaxBorrowable", args: [walletAddress, contracts.loanToken] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "availableLiquidity", args: [contracts.loanToken] }),
      ctx.client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "balanceOf", args: [walletAddress] }),
    ]);
    assert.ok(amount <= maxBorrowable && amount <= available, "Borrow amount exceeds live health-factor capacity or available dUSD liquidity.");
    const now = await ctx.client.getBlock({ blockTag: "latest" });
    const [loanPrice, collateralPrice, loanConfig, collateralConfig] = await Promise.all([
      ctx.client.readContract({ address: contracts.oracle, abi: controlledTestOracleAbi, functionName: "getPriceBounds", args: [contracts.loanToken] }),
      ctx.client.readContract({ address: contracts.oracle, abi: controlledTestOracleAbi, functionName: "getPriceBounds", args: [contracts.collateralToken] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getReserveConfig", args: [contracts.loanToken] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getReserveConfig", args: [contracts.collateralToken] }),
    ]);
    assert.ok(isFreshPrice(loanPrice, now.timestamp, tuple(loanConfig, "maxOracleAge", 4)), "dUSD synthetic oracle price is unseeded or stale.");
    assert.ok(isFreshPrice(collateralPrice, now.timestamp, tuple(collateralConfig, "maxOracleAge", 4)), "dCOL synthetic oracle price is unseeded or stale.");
    return writeParticipant(ctx, command, walletAddress, alias, contracts.lendingPool, lendingPoolV2Abi, "borrow", [contracts.loanToken, amount, proof.proof, [...proof.publicInputs]], options,
      eventFor("Borrowed", { asset: contracts.loanToken, borrower: walletAddress, amount }),
      async () => {
        const [after, balanceAfter] = await Promise.all([
          ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [walletAddress, contracts.loanToken] }),
          ctx.client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "balanceOf", args: [walletAddress] }),
        ]);
        return after >= before + amount && balanceAfter === balanceBefore + amount;
      });
  }
  if (command === "repay-all") {
    const walletAddress = await actionContext(ctx, label, false);
    const [before, balance, allowance] = await Promise.all([
      ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [walletAddress, contracts.loanToken] }),
      ctx.client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "balanceOf", args: [walletAddress] }),
      ctx.client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "allowance", args: [walletAddress, contracts.lendingPool] }),
    ]);
    assert.ok(before > 0n, "Wallet has no dUSD debt to repay.");
    const reserve = await ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getReserveData", args: [contracts.loanToken] });
    const required = repaymentAllowanceRequired(before, BigInt(tuple(reserve, "currentBorrowRateBps", 7)));
    assert.ok(balance >= required, "Wallet does not have enough dUSD for current debt plus the 15-minute accrued-interest allowance margin.");
    assert.ok(allowance >= required, "Current dUSD allowance is below debt plus the 15-minute interest margin. Run approve-repay first.");
    return writeParticipant(ctx, command, walletAddress, alias, contracts.lendingPool, lendingPoolV2Abi, "repay", [contracts.loanToken, maxUint256], options,
      eventFor("Repaid", { asset: contracts.loanToken, borrower: walletAddress }),
      async (receipt) => {
        const event = poolEventArgs(receipt, "Repaid", (args) => args.asset.toLowerCase() === contracts.loanToken.toLowerCase() && args.borrower.toLowerCase() === walletAddress.toLowerCase());
        if (!event) return false;
        const [after, balanceAfter] = await Promise.all([
          ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [walletAddress, contracts.loanToken] }),
          ctx.client.readContract({ address: contracts.loanToken, abi: controlledTokenAbi, functionName: "balanceOf", args: [walletAddress] }),
        ]);
        return after === 0n && BigInt(event.debtBalance) === 0n && balanceAfter === balance - BigInt(event.amount);
      });
  }
  if (command === "withdraw-collateral" || command === "withdraw-supply") {
    const amount = assertPositiveBaseUnits(positional[1]);
    const walletAddress = await actionContext(ctx, label, false);
    const asset = command === "withdraw-supply" ? contracts.loanToken : contracts.collateralToken;
    const [before, walletBalanceBefore] = await Promise.all([
      ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: command === "withdraw-supply" ? "getSupplyBalance" : "getCollateralBalance", args: [walletAddress, asset] }),
      ctx.client.readContract({ address: asset, abi: controlledTokenAbi, functionName: "balanceOf", args: [walletAddress] }),
    ]);
    const fn = command === "withdraw-supply" ? "withdrawSupply" : "withdrawCollateral";
    const eventName = command === "withdraw-supply" ? "LiquidityWithdrawn" : "CollateralWithdrawn";
    const eventFields = command === "withdraw-supply" ? { asset, supplier: walletAddress, amount } : { asset, user: walletAddress, amount };
    return writeParticipant(ctx, command, walletAddress, alias, contracts.lendingPool, lendingPoolV2Abi, fn, [asset, amount], options,
      eventFor(eventName, eventFields),
      async () => {
        const [after, walletBalanceAfter] = await Promise.all([
          ctx.client.readContract({ address: contracts.lendingPool, abi: lendingPoolV2Abi, functionName: command === "withdraw-supply" ? "getSupplyBalance" : "getCollateralBalance", args: [walletAddress, asset] }),
          ctx.client.readContract({ address: asset, abi: controlledTokenAbi, functionName: "balanceOf", args: [walletAddress] }),
        ]);
        return after < before && walletBalanceAfter === walletBalanceBefore + amount;
      });
  }
  throw new Error(`Unknown participant command: ${command}`);
}

if (import.meta.main) executeCommand().catch((error) => {
  const rpcUrl = process.env.RH_MAINNET_RPC_URL?.trim();
  const message = error instanceof Error ? error.message : "Operation failed.";
  const secretSafe = rpcUrl ? message.replaceAll(rpcUrl, "<configured Mainnet RPC>") : message;
  // Errors from Noir/Barretenberg can include circuit input details; never echo proof-time exception data.
  const safeMessage = /proof|barretenberg|noir|witness/i.test(secretSafe) ? "Proof operation failed; private witness values and proof material were suppressed." : secretSafe;
  console.error(`Mainnet Lending participant operation stopped: ${safeMessage}`);
  process.exitCode = 1;
});

export { executeCommand, isFreshPrice, tuple };
