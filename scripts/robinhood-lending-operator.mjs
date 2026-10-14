#!/usr/bin/env bun
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  isAddress,
  maxUint256,
  parseAbi,
  parseEventLogs,
  parseUnits,
  toHex,
} from "viem";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import {
  controlledTestOracleAbi,
  controlledTokenAbi,
  credentialIssuerRoleAbi,
  credentialRegistryAbi,
  lendingPoolV2Abi,
} from "../src/lib/contracts/abis.ts";
import { parseDemoCredentialWitness } from "../src/lib/credential/witness.ts";
import { computeEligibilityCommitment } from "../src/lib/zk/commitment.ts";

const CHAIN_ID = 46_630;
const EXPLORER = "https://explorer.testnet.chain.robinhood.com";
const DEPLOYMENT_ARTIFACT = path.resolve("contracts/broadcast/DeployRobinhoodProtocolStack.s.sol/46630/run-latest.json");
const CIRCUIT_ARTIFACT = path.resolve("public/circuits/private_eligibility.json");
const CRS_PATH = path.resolve("circuits/cache/bb-crs");
const PARTICIPANTS = {
  A: getAddress("0x4C488dfa668A7643C4046a1952734eF875Af0d62"),
  B: getAddress("0xBE390374Ac7304A792c50EA37AB301b659a56Df7"),
};
const WRITE_LABELS = {
  approve: "lending-token-approval",
  supply: "lending-supply",
  "deposit-collateral": "lending-collateral-deposit",
  "enable-collateral": "lending-collateral-enable",
  borrow: "lending-borrow",
  repay: "lending-repay",
  "withdraw-collateral": "lending-collateral-withdraw",
  "withdraw-supply": "lending-supply-withdraw",
};
const TRANSIENT_RETRIES = 6;
const eligibilityVerifierAbi = parseAbi([
  "function verifyProof(bytes proof,uint256[9] publicInputs) view returns (bool)",
]);
const tokenApprovalAbi = parseAbi([
  "event Approval(address indexed owner,address indexed spender,uint256 value)",
]);

function usage() {
  console.log(`Robinhood Lending V2 operator · chain ${CHAIN_ID}

Read-only status:
  bun run robinhood:lending status --wallet A|B
  bun run robinhood:lending prove --wallet A|B --witness-file <private-file>

Each action simulates by default. A write requires --execute, the exact authorization label,
an encrypted Foundry alias that resolves to the selected wallet, and an interactive TTY.
Private witness files are read locally and their contents are never printed.

  bun run robinhood:lending approve --wallet A --asset rUSD2 --amount 100
  bun run robinhood:lending supply --wallet A --amount 100 --witness-file <private-file>
  bun run robinhood:lending approve --wallet B --asset rCOL2 --amount 10
  bun run robinhood:lending deposit-collateral --wallet B --amount 10
  bun run robinhood:lending enable-collateral --wallet B --witness-file <private-file>
  bun run robinhood:lending borrow --wallet B --amount 5 --witness-file <private-file>
  bun run robinhood:lending approve --wallet B --asset rUSD2 --amount 10
  bun run robinhood:lending repay --wallet B --amount all
  bun run robinhood:lending withdraw-collateral --wallet B --amount 10
  bun run robinhood:lending withdraw-supply --wallet A --amount 100

Write form:
  append --execute --authorize-public-testnet-write=<exact-label> --account-alias <Foundry-alias>
No command deploys contracts or supports Mainnet.`);
}

function parseArgs(argv) {
  const command = argv.shift() ?? "help";
  const options = {};
  while (argv.length) {
    const arg = argv.shift();
    if (arg === "--execute") options.execute = true;
    else if (arg === "--wallet" || arg === "--asset" || arg === "--amount" || arg === "--witness-file" || arg === "--account-alias") {
      options[arg.slice(2)] = argv.shift();
    } else if (arg.startsWith("--authorize-public-testnet-write=")) {
      options.authorization = arg.slice(arg.indexOf("=") + 1);
    } else throw new Error(`Unknown argument ${arg}.`);
  }
  return { command, options };
}

function errorText(error) {
  const seen = new Set();
  const parts = [];
  let current = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (typeof current === "string") parts.push(current);
    else if (typeof current === "object") {
      for (const key of ["shortMessage", "message", "details", "name"]) {
        if (typeof current[key] === "string") parts.push(current[key]);
      }
      current = current.cause;
      continue;
    }
    break;
  }
  return parts.join(" ");
}

function transient(error) {
  return /could not be found|block not found|missing trie|timeout|timed out|fetch failed|network error|ECONNRESET|ECONNREFUSED|EAI_AGAIN|temporarily unavailable|gateway|\b429\b|\b502\b|\b503\b|\b504\b|transaction.*not found/i.test(errorText(error));
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryRead(operation, retries = TRANSIENT_RETRIES) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      if (attempt >= retries || !transient(error)) throw error;
      await delay(500 * (attempt + 1));
    }
  }
}

async function retryPostState(operation) {
  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      lastError = error;
      if (attempt < 7) await delay(750 * (attempt + 1));
    }
  }
  throw lastError;
}

function deploymentAddress(artifact, name, symbol) {
  const tx = artifact.transactions.find((item) => item.transactionType === "CREATE" && item.contractName === name && (symbol === undefined || item.arguments?.[1] === symbol));
  assert.ok(tx, `Deployment artifact does not contain ${name}${symbol ? ` (${symbol})` : ""}.`);
  const receipt = artifact.receipts.find((item) => item.transactionHash.toLowerCase() === tx.hash.toLowerCase());
  assert.equal(receipt?.status, "0x1", `${name} deployment receipt was not successful.`);
  const address = receipt.contractAddress ?? tx.contractAddress;
  assert.ok(address && isAddress(address), `${name} deployment address is missing.`);
  return getAddress(address);
}

function context() {
  assert.ok(fs.existsSync(DEPLOYMENT_ARTIFACT), "Confirmed Robinhood deployment artifact is missing.");
  const artifact = JSON.parse(fs.readFileSync(DEPLOYMENT_ARTIFACT, "utf8"));
  assert.equal(Number(artifact.chain), CHAIN_ID, "Deployment artifact is not chain 46630.");
  const addresses = {
    pool: deploymentAddress(artifact, "LendingPoolV2"),
    verifier: deploymentAddress(artifact, "EligibilityVerifierAdapter"),
    registry: deploymentAddress(artifact, "RobinhoodDemoCredentialRegistry"),
    oracle: deploymentAddress(artifact, "ControlledTestOracle"),
    asset: deploymentAddress(artifact, "ControlledTestToken", "rUSD2"),
    collateral: deploymentAddress(artifact, "ControlledTestToken", "rCOL2"),
  };
  const configured = {
    pool: process.env.RH_TESTNET_LENDING_V2_POOL_ADDRESS || process.env.NEXT_PUBLIC_ROBINHOOD_LENDING_V2_POOL_CONTRACT,
    registry: process.env.RH_TESTNET_CREDENTIAL_REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_ROBINHOOD_CREDENTIAL_REGISTRY_CONTRACT,
    oracle: process.env.RH_TESTNET_LENDING_V2_ORACLE_ADDRESS || process.env.NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ORACLE_CONTRACT,
    asset: process.env.RH_TESTNET_LENDING_V2_ASSET_ADDRESS || process.env.NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ASSET_CONTRACT,
    collateral: process.env.RH_TESTNET_LENDING_V2_COLLATERAL_ADDRESS || process.env.NEXT_PUBLIC_ROBINHOOD_LENDING_V2_COLLATERAL_CONTRACT,
  };
  for (const [key, value] of Object.entries(configured)) {
    assert.ok(value && isAddress(value), `Missing configured ${key} contract address.`);
    assert.equal(value.toLowerCase(), addresses[key].toLowerCase(), `${key} address does not match the successful deployment receipt.`);
  }
  const rpcUrl = process.env.RH_TESTNET_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL;
  assert.ok(rpcUrl, "Set the public Robinhood Testnet RPC URL in the local environment.");
  const chain = defineChain({ id: CHAIN_ID, name: "Robinhood Chain Testnet", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } });
  return {
    addresses,
    rpcUrl,
    client: createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 1, timeout: 30_000 }) }),
  };
}

async function read(client, address, abi, functionName, args = []) {
  return retryRead(() => client.readContract({ address, abi, functionName, args }));
}

function walletFrom(value) {
  const wallet = PARTICIPANTS[value?.toUpperCase()] ?? (isAddress(value ?? "") ? getAddress(value) : undefined);
  assert.ok(wallet && Object.values(PARTICIPANTS).some((item) => item.toLowerCase() === wallet.toLowerCase()), "Select participant A or B by name or exact address.");
  return wallet;
}

function tokenFor(ctx, symbol) {
  if (symbol === "rUSD2") return { address: ctx.addresses.asset, decimals: 6 };
  if (symbol === "rCOL2") return { address: ctx.addresses.collateral, decimals: 18 };
  throw new Error("Asset must be rUSD2 or rCOL2.");
}

async function activeWitness(ctx, wallet, file) {
  assert.ok(file, "This action needs --witness-file pointing to the participant's private policy-3 file.");
  const resolved = path.resolve(file);
  const stats = fs.statSync(resolved);
  assert.equal(stats.mode & 0o077, 0, "Witness file permissions must be 0600 or stricter.");
  assert.ok(stats.size > 0 && stats.size <= 16_384, "Witness file size is invalid.");
  // Read private material into process memory only. Never print or pass these fields to a child process.
  const witness = parseDemoCredentialWitness(JSON.parse(fs.readFileSync(resolved, "utf8")));
  assert.equal(witness.format, "robinhood-demo-credential-v1", "Expected the Robinhood project test credential witness.");
  assert.equal(witness.policyId, 3, "The witness is not for Lending policy 3.");
  assert.equal(witness.wallet.toLowerCase(), wallet.toLowerCase(), "The witness belongs to a different participant.");
  const record = await read(ctx.client, ctx.addresses.registry, credentialRegistryAbi, "getCredential", [wallet, 3n]);
  assert.equal(record.wallet.toLowerCase(), wallet.toLowerCase(), "No matching policy-3 credential is on chain.");
  assert.equal(record.version, 1n, "Unexpected policy-3 credential version.");
  assert.equal(record.revoked, false, "Policy-3 credential is revoked.");
  assert.equal(record.commitment.toLowerCase(), witness.commitment.toLowerCase(), "Witness commitment does not match the active record.");
  assert.equal(record.expiresAt, BigInt(witness.expiresAt), "Witness expiry does not match the active record.");
  const issuerRole = await read(ctx.client, ctx.addresses.registry, credentialIssuerRoleAbi, "ISSUER_ROLE");
  assert.equal(await read(ctx.client, ctx.addresses.registry, credentialIssuerRoleAbi, "hasRole", [issuerRole, record.issuer]), true, "Credential issuer is no longer authorized.");
  const now = (await retryRead(() => ctx.client.getBlock({ blockTag: "latest" }))).timestamp;
  assert.ok(record.expiresAt > now, "Policy-3 credential has expired.");
  const expectedCommitment = await computeEligibilityCommitment({
    subject: wallet,
    privateValue: witness.privateValue,
    salt: witness.salt,
    policyId: 3n,
    policyVersion: 1n,
    threshold: 1_000n,
    credentialVersion: record.version,
    expiresAt: record.expiresAt,
    chainId: BigInt(CHAIN_ID),
    vault: ctx.addresses.pool,
  });
  assert.equal(expectedCommitment.toLowerCase(), record.commitment.toLowerCase(), "Private witness does not reproduce the on-chain commitment.");
  return { witness, record };
}

async function generateProof(ctx, wallet, file) {
  const { witness, record } = await activeWitness(ctx, wallet, file);
  const circuit = JSON.parse(fs.readFileSync(CIRCUIT_ARTIFACT, "utf8"));
  assert.ok(fs.existsSync(CRS_PATH), "Local Barretenberg CRS cache is missing; run the existing ZK setup before the demo.");
  const publicInputs = [
    BigInt(wallet), BigInt(record.commitment), 3n, 1n, 1_000n,
    record.version, record.expiresAt, BigInt(CHAIN_ID), BigInt(ctx.addresses.pool),
  ];
  const inputs = {
    subject: publicInputs[0].toString(), commitment: publicInputs[1].toString(), policy_id: "3",
    policy_version: "1", threshold: "1000", credential_version: record.version.toString(),
    expires_at: record.expiresAt.toString(), chain_id: String(CHAIN_ID), vault_address: publicInputs[8].toString(),
    private_value: BigInt(witness.privateValue).toString(), salt: BigInt(witness.salt).toString(),
  };
  const api = await Barretenberg.new({ threads: 1, crsPath: CRS_PATH });
  try {
    const noir = new Noir(circuit);
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    const result = await noir.execute(inputs);
    const proof = await backend.generateProof(result.witness, { verifierTarget: "evm" });
    assert.equal(proof.publicInputs.length, publicInputs.length, "Proof public input count does not match the V2 verifier.");
    assert.ok(proof.publicInputs.every((value, index) => BigInt(value) === publicInputs[index]), "Generated proof is bound to a different wallet, policy, credential, chain, or pool.");
    assert.equal(await backend.verifyProof(proof, { verifierTarget: "evm" }), true, "Local Barretenberg verification failed.");
    const adapter = await read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "eligibilityVerifier");
    assert.equal(adapter.toLowerCase(), ctx.addresses.verifier.toLowerCase(), "LendingPoolV2 does not point to its deployed verifier adapter.");
    const proofHex = toHex(proof.proof);
    assert.equal(await read(ctx.client, adapter, eligibilityVerifierAbi, "verifyProof", [proofHex, publicInputs]), true, "The deployed Robinhood verifier rejected the generated proof.");
    return { proof: proofHex, publicInputs, proofBytes: proof.proof.length };
  } finally {
    await api.destroy();
  }
}

async function status(ctx, wallet) {
  const [paused, assets, loan, collateral, positionLoan, positionCollateral, account] = await Promise.all([
    read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "paused"),
    read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getReserveAssets"),
    read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getReserveData", [ctx.addresses.asset]),
    read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getReserveData", [ctx.addresses.collateral]),
    read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getPosition", [wallet, ctx.addresses.asset]),
    read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getPosition", [wallet, ctx.addresses.collateral]),
    read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getAccountData", [wallet]),
  ]);
  const now = (await retryRead(() => ctx.client.getBlock({ blockTag: "latest" }))).timestamp;
  const [loanPrice, collateralPrice, walletLoan, walletCollateral, allowanceLoan, allowanceCollateral, balance] = await Promise.all([
    read(ctx.client, ctx.addresses.oracle, controlledTestOracleAbi, "getPriceBounds", [ctx.addresses.asset]),
    read(ctx.client, ctx.addresses.oracle, controlledTestOracleAbi, "getPriceBounds", [ctx.addresses.collateral]),
    read(ctx.client, ctx.addresses.asset, controlledTokenAbi, "balanceOf", [wallet]),
    read(ctx.client, ctx.addresses.collateral, controlledTokenAbi, "balanceOf", [wallet]),
    read(ctx.client, ctx.addresses.asset, controlledTokenAbi, "allowance", [wallet, ctx.addresses.pool]),
    read(ctx.client, ctx.addresses.collateral, controlledTokenAbi, "allowance", [wallet, ctx.addresses.pool]),
    ctx.client.getBalance({ address: wallet }),
  ]);
  const reserveView = (name, address, result, price) => {
    // viem returns this single struct output directly, with its ABI component names.
    const data = result;
    const config = data.config;
    const age = now - BigInt(price[3]);
    const maxAge = BigInt(config.maxOracleAge ?? config[4]);
    return {
      asset: name, address, availableLiquidity: formatUnits(data.availableLiquidity ?? data[5], Number(data.decimals ?? data[0])),
      totalDebt: formatUnits(data.totalDebtAssets ?? data[4], Number(data.decimals ?? data[0])),
      oraclePriceWad: price[2].toString(), oracleAgeSeconds: age.toString(), oracleFresh: age >= 0n && age <= maxAge,
      maxOracleAgeSeconds: maxAge.toString(), supplyEnabled: Boolean(config.supplyEnabled ?? config[15]),
      borrowEnabled: Boolean(config.borrowEnabled ?? config[16]), collateralEnabled: Boolean(config.collateralEnabled ?? config[17]),
    };
  };
  const maxBorrowable = await read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getMaxBorrowable", [wallet, ctx.addresses.asset]);
  console.log(JSON.stringify({
    chainId: CHAIN_ID, wallet, pool: ctx.addresses.pool, riskPaused: paused,
    reservesConfigured: assets.map((asset) => asset.toLowerCase()),
    rUSD2: reserveView("rUSD2", ctx.addresses.asset, loan, loanPrice),
    rCOL2: reserveView("rCOL2", ctx.addresses.collateral, collateral, collateralPrice),
    walletBalances: { rUSD2: formatUnits(walletLoan, 6), rCOL2: formatUnits(walletCollateral, 18), nativeETH: formatUnits(balance, 18) },
    allowances: { rUSD2: formatUnits(allowanceLoan, 6), rCOL2: formatUnits(allowanceCollateral, 18) },
    position: {
      rUSD2: { supplied: formatUnits(positionLoan[0], 6), debt: formatUnits(positionLoan[2], 6) },
      rCOL2: { collateral: formatUnits(positionCollateral[1], 18), enabled: positionCollateral[3] },
      maxBorrowableRUSD2: formatUnits(maxBorrowable, 6),
      healthFactorWad: account.healthFactorWad.toString(),
    },
  }, null, 2));
}

function parseAmount(text, decimals) {
  assert.ok(text && /^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(text), "Amount must be a positive decimal string.");
  const amount = parseUnits(text, decimals);
  assert.ok(amount > 0n, "Amount must be greater than zero.");
  return amount;
}

function eventMatches(action, receipt, ctx, wallet, asset, amount) {
  const specs = {
    supply: [lendingPoolV2Abi, "LiquiditySupplied", (a) => a.asset?.toLowerCase() === asset.toLowerCase() && a.supplier?.toLowerCase() === wallet.toLowerCase() && a.amount === amount],
    "deposit-collateral": [lendingPoolV2Abi, "CollateralDeposited", (a) => a.asset?.toLowerCase() === asset.toLowerCase() && a.user?.toLowerCase() === wallet.toLowerCase() && a.amount === amount],
    "enable-collateral": [lendingPoolV2Abi, "CollateralUseChanged", (a) => a.asset?.toLowerCase() === asset.toLowerCase() && a.user?.toLowerCase() === wallet.toLowerCase() && a.enabled === true],
    borrow: [lendingPoolV2Abi, "Borrowed", (a) => a.asset?.toLowerCase() === asset.toLowerCase() && a.borrower?.toLowerCase() === wallet.toLowerCase() && a.amount === amount],
    repay: [lendingPoolV2Abi, "Repaid", (a) => a.asset?.toLowerCase() === asset.toLowerCase() && a.borrower?.toLowerCase() === wallet.toLowerCase() && BigInt(a.amount ?? 0n) > 0n],
    "withdraw-collateral": [lendingPoolV2Abi, "CollateralWithdrawn", (a) => a.asset?.toLowerCase() === asset.toLowerCase() && a.user?.toLowerCase() === wallet.toLowerCase() && a.amount === amount],
    "withdraw-supply": [lendingPoolV2Abi, "LiquidityWithdrawn", (a) => a.asset?.toLowerCase() === asset.toLowerCase() && a.supplier?.toLowerCase() === wallet.toLowerCase() && a.amount === amount],
  };
  const spec = specs[action];
  if (action === "approve") {
    return parseEventLogs({ abi: tokenApprovalAbi, logs: receipt.logs, eventName: "Approval", strict: false })
      .some(({ args }) => args.owner?.toLowerCase() === wallet.toLowerCase() &&
        args.spender?.toLowerCase() === ctx.addresses.pool.toLowerCase() && args.value === amount);
  }
  if (!spec) return false;
  return parseEventLogs({ abi: spec[0], logs: receipt.logs, eventName: spec[1], strict: false })
    .some((event) => spec[2](event.args ?? {}));
}

async function sendWithAlias(ctx, { alias, wallet, target, calldata, authorization }) {
  assert.ok(process.stdin.isTTY, "Public transaction needs an interactive local terminal for keystore unlock and explicit confirmation.");
  assert.ok(alias && /^[A-Za-z0-9._-]+$/.test(alias), "Provide a non-secret Foundry keystore alias.");
  const check = spawnSync("cast", ["wallet", "address", "--account", alias], { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });
  assert.equal(check.status, 0, "Foundry alias could not be unlocked/resolved.");
  const addresses = check.stdout.match(/0x[a-fA-F0-9]{40}/g) ?? [];
  assert.ok(addresses.some((address) => address.toLowerCase() === wallet.toLowerCase()), "Keystore alias does not resolve to the selected credential holder.");
  const phrase = `WRITE Robinhood Testnet ${authorization}`;
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  let entered;
  try { entered = await readline.question(`Type exactly “${phrase}” to sign and submit: `); }
  finally { readline.close(); }
  assert.equal(entered, phrase, "Confirmation phrase mismatch; nothing was sent.");
  const child = spawn("cast", ["send", "--rpc-url", ctx.rpcUrl, "--chain", String(CHAIN_ID), "--account", alias, "--async", "--data", calldata, target], { stdio: ["inherit", "pipe", "inherit"] });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { output += chunk; process.stdout.write(chunk); });
  const exitCode = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  assert.equal(exitCode, 0, "Signer command failed before a transaction hash was returned.");
  const hashes = output.match(/0x[a-fA-F0-9]{64}/g) ?? [];
  assert.ok(hashes.length, "Signer returned no transaction hash; inspect local command output before retrying.");
  return hashes.at(-1);
}

async function waitForReceipt(ctx, hash) {
  const end = Date.now() + 180_000;
  let lastError;
  while (Date.now() < end) {
    try { return await ctx.client.getTransactionReceipt({ hash }); }
    catch (error) { lastError = error; await delay(1_500); }
  }
  throw new Error(`No receipt visible for ${hash} yet. Do not resend; check this exact hash with cast receipt. ${errorText(lastError)}`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "help" || command === "--help") return usage();
  if (command === "prove") {
    const ctx = context();
    const chainId = await ctx.client.getChainId();
    assert.equal(chainId, CHAIN_ID, `Configured RPC reports chain ${chainId}; refusing other networks.`);
    const wallet = walletFrom(options.wallet);
    const proof = await generateProof(ctx, wallet, options["witness-file"]);
    console.log(`PASS genuine policy-3 proof · local Barretenberg verification and deployed verifier accepted · nine bound public inputs · ${proof.proofBytes} proof bytes. Private witness fields withheld.`);
    console.log(`Read-only proof check complete · chain ${CHAIN_ID} · wallet ${wallet} · pool ${ctx.addresses.pool}. No transaction was signed or broadcast.`);
    return;
  }
  if (command === "status") {
    const ctx = context();
    const chainId = await ctx.client.getChainId();
    assert.equal(chainId, CHAIN_ID, `Configured RPC reports chain ${chainId}; refusing other networks.`);
    return status(ctx, walletFrom(options.wallet));
  }
  const action = command;
  assert.ok(Object.hasOwn(WRITE_LABELS, action), `Unsupported action ${action}.`);
  const ctx = context();
  const chainId = await ctx.client.getChainId();
  assert.equal(chainId, CHAIN_ID, `Configured RPC reports chain ${chainId}; refusing other networks.`);
  const wallet = walletFrom(options.wallet);
  const collateralActions = new Set(["deposit-collateral", "enable-collateral", "withdraw-collateral"]);
  const assetSymbol = action === "approve" ? options.asset : collateralActions.has(action) ? "rCOL2" : "rUSD2";
  const token = tokenFor(ctx, assetSymbol);
  const asset = token.address;
  let amount = action === "enable-collateral" ? 0n : action === "repay" && options.amount === "all" ? maxUint256 : parseAmount(options.amount, token.decimals);
  const proofNeeded = ["supply", "enable-collateral", "borrow"].includes(action);
  let proof;
  if (proofNeeded) {
    proof = await generateProof(ctx, wallet, options["witness-file"]);
    console.log(`PASS genuine policy-3 proof · local verification and deployed verifier accepted · nine bound public inputs · ${proof.proofBytes} proof bytes. Private witness fields withheld.`);
  }

  const [balance, allowance, position, debt, reserveConfig] = await Promise.all([
    read(ctx.client, asset, controlledTokenAbi, "balanceOf", [wallet]),
    read(ctx.client, asset, controlledTokenAbi, "allowance", [wallet, ctx.addresses.pool]),
    read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getPosition", [wallet, asset]),
    read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getDebtBalance", [wallet, ctx.addresses.asset]),
    read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getReserveConfig", [asset]),
  ]);
  if (action === "approve") {
    // Token approval itself is the action being simulated.
  } else if (action === "supply" || action === "deposit-collateral") {
    assert.ok(balance >= amount, `Insufficient ${assetSymbol} balance.`);
    assert.ok(allowance >= amount, `Allowance is short. Simulate/authorize approve --wallet ${options.wallet} --asset ${assetSymbol} --amount ${formatUnits(amount, token.decimals)} first.`);
  } else if (action === "enable-collateral") {
    assert.ok(position[1] > 0n, "Deposit collateral before enabling it.");
  } else if (action === "borrow") {
    assert.ok(Boolean(reserveConfig.borrowEnabled ?? reserveConfig[16]), "The selected reserve is not borrow-enabled.");
    const [maxBorrowable, oracleBounds, oracleReserve] = await Promise.all([
      read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getMaxBorrowable", [wallet, asset]),
      read(ctx.client, ctx.addresses.oracle, controlledTestOracleAbi, "getPriceBounds", [asset]),
      read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getReserveConfig", [asset]),
    ]);
    const now = (await retryRead(() => ctx.client.getBlock({ blockTag: "latest" }))).timestamp;
    const maxAge = BigInt(oracleReserve.maxOracleAge ?? oracleReserve[4]);
    assert.ok(oracleBounds[3] <= now && now - oracleBounds[3] <= maxAge, "Oracle price is not fresh; refresh it and retry this simulation.");
    assert.ok(amount <= maxBorrowable, `Borrow amount exceeds current limit ${formatUnits(maxBorrowable, token.decimals)} ${assetSymbol}.`);
  } else if (action === "repay") {
    assert.ok(debt > 0n, "Wallet has no debt to repay.");
    const needed = amount === maxUint256 ? debt + debt / 20n + 1n : amount;
    assert.ok(balance >= (amount === maxUint256 ? debt : amount), "Insufficient token balance to repay.");
    assert.ok(allowance >= needed, `Approve at least ${formatUnits(needed, token.decimals)} ${assetSymbol} to cover actual debt and accrued interest headroom.`);
  }
  if (["supply", "enable-collateral", "borrow"].includes(action)) {
    assert.equal(Boolean(await read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "paused")), false, "Lending V2 risk actions are paused.");
  }

  const argsByAction = {
    approve: () => [ctx.addresses.pool, amount],
    supply: () => [asset, amount, proof.proof, proof.publicInputs],
    "deposit-collateral": () => [asset, amount],
    "enable-collateral": () => [asset, true, proof.proof, proof.publicInputs],
    borrow: () => [asset, amount, proof.proof, proof.publicInputs],
    repay: () => [asset, amount],
    "withdraw-collateral": () => [asset, amount],
    "withdraw-supply": () => [asset, amount],
  };
  const functionByAction = {
    approve: "approve", supply: "supply", "deposit-collateral": "depositCollateral",
    "enable-collateral": "setCollateralEnabled", borrow: "borrow", repay: "repay",
    "withdraw-collateral": "withdrawCollateral", "withdraw-supply": "withdrawSupply",
  };
  const target = action === "approve" ? asset : ctx.addresses.pool;
  const abi = action === "approve" ? controlledTokenAbi : lendingPoolV2Abi;
  const functionName = functionByAction[action];
  const args = argsByAction[action]();
  const simulation = await ctx.client.simulateContract({ account: wallet, address: target, abi, functionName, args });
  const [gas, gasPrice, nativeBalance] = await Promise.all([
    ctx.client.estimateContractGas({ account: wallet, address: target, abi, functionName, args }),
    retryRead(() => ctx.client.getGasPrice()),
    ctx.client.getBalance({ address: wallet }),
  ]);
  const estimatedCost = gas * gasPrice;
  assert.ok(nativeBalance >= estimatedCost + estimatedCost / 5n, "Insufficient native test ETH for estimated gas plus 20% headroom.");
  console.log(`PASS simulation · ${action} · chain ${CHAIN_ID} · signer ${wallet} · target ${target} · estimated ${gas} gas · cost ${formatUnits(estimatedCost, 18)} ETH`);
  if (!options.execute) {
    console.log(`Simulation only. Separate owner authorization required: --execute --authorize-public-testnet-write=${WRITE_LABELS[action]} --account-alias <encrypted-keystore-alias>.`);
    return;
  }
  assert.equal(options.authorization, WRITE_LABELS[action], `Authorization must exactly equal ${WRITE_LABELS[action]}.`);
  const calldata = encodeFunctionData({ abi, functionName, args });
  const hash = await sendWithAlias(ctx, { alias: options["account-alias"], wallet, target, calldata, authorization: WRITE_LABELS[action] });
  console.log(`Submitted ${hash}; no write retry will be attempted for this hash.`);
  const receipt = await waitForReceipt(ctx, hash);
  assert.equal(receipt.status, "success", `Transaction reverted on-chain: ${hash}`);
  assert.equal(receipt.from.toLowerCase(), wallet.toLowerCase(), "Receipt sender does not match the approved participant.");
  assert.equal(receipt.to.toLowerCase(), target.toLowerCase(), "Receipt target does not match the simulated contract.");
  assert.equal(await ctx.client.getChainId(), CHAIN_ID, "RPC chain changed while confirming the transaction.");
  if (!eventMatches(action, receipt, ctx, wallet, asset, amount === maxUint256 ? undefined : amount)) {
    console.error(`RECEIPT SUCCESS · expected action event is not yet verified. Do not resend. Check ${EXPLORER}/tx/${hash}`);
    return;
  }
  try {
    const result = await retryPostState(async () => {
      const afterBalance = await read(ctx.client, asset, controlledTokenAbi, "balanceOf", [wallet]);
      const afterAllowance = await read(ctx.client, asset, controlledTokenAbi, "allowance", [wallet, ctx.addresses.pool]);
      const afterPosition = await read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getPosition", [wallet, asset]);
      const afterDebt = await read(ctx.client, ctx.addresses.pool, lendingPoolV2Abi, "getDebtBalance", [wallet, ctx.addresses.asset]);
      if (action === "approve") assert.ok(afterAllowance >= amount, "Approval receipt is confirmed but allowance readback is pending.");
      if (action === "supply") assert.ok(afterPosition[0] > position[0] && afterBalance === balance - amount, "Supply position/balance readback is pending.");
      if (action === "deposit-collateral") assert.ok(afterPosition[1] === position[1] + amount && afterBalance === balance - amount, "Collateral position/balance readback is pending.");
      if (action === "enable-collateral") assert.equal(afterPosition[3], true, "Collateral enable readback is pending.");
      if (action === "borrow") assert.ok(afterDebt > debt && afterBalance === balance + amount, "Borrow debt/balance readback is pending.");
      if (action === "repay") assert.ok(afterDebt < debt && (amount !== maxUint256 || afterDebt === 0n), "Repayment debt readback is pending.");
      if (action === "withdraw-collateral") assert.ok(afterPosition[1] < position[1] && afterBalance === balance + amount, "Collateral withdrawal readback is pending.");
      if (action === "withdraw-supply") assert.ok(afterPosition[0] < position[0] && afterBalance === balance + amount, "Supply withdrawal readback is pending.");
      return { allowance: afterAllowance.toString(), position: afterPosition.map(String), debt: afterDebt.toString() };
    });
    console.log(`CONFIRMED receipt and post-state · ${hash} · block ${receipt.blockNumber} · ${JSON.stringify(result)}`);
  } catch (error) {
    console.error(`RECEIPT SUCCESS · post-state is not yet verified after RPC retries. Do not resubmit ${hash}. ${errorText(error)}`);
  }
  console.log(`Explorer: ${EXPLORER}/tx/${hash}`);
}

main().catch((error) => {
  // Keep errors generic; never serialize witness objects or circuit inputs.
  console.error(`Robinhood Lending operator stopped before any further write: ${errorText(error)}`);
  process.exitCode = 1;
});
