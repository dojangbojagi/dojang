#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, decodeAbiParameters, defineChain, http, isAddress, keccak256 } from "viem";
import { parseAllowedEnv } from "./validate-robinhood-mainnet-demo-config.mjs";

const ROOT = process.cwd();
const CONTRACTS = path.join(ROOT, "contracts");
const CHAIN_ID = 4_663;
const EXPLORER = "https://robinhoodchain.blockscout.com";
const VERIFY_API = `${EXPLORER}/api/`;
const DEPLOYMENT = path.join(CONTRACTS, "broadcast/DeployRobinhoodMainnetDemoStack.s.sol/4663/run-latest.json");
let rpcUrlForRedaction;

function configuredRpcUrl() {
  if (process.env.RH_MAINNET_RPC_URL) return process.env.RH_MAINNET_RPC_URL;
  if (process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL) return process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL;
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return undefined;
  const values = parseAllowedEnv(fs.readFileSync(envPath, "utf8"));
  return values.RH_MAINNET_RPC_URL;
}

const definitions = {
  ZKTranscriptLib: ["ZKTranscriptLib", "out-mainnet/EligibilityHonkVerifier.sol/ZKTranscriptLib.json", "src/generated/EligibilityHonkVerifier.sol:ZKTranscriptLib"],
  RelationsLib: ["RelationsLib", "out-mainnet/EligibilityHonkVerifier.sol/RelationsLib.json", "src/generated/EligibilityHonkVerifier.sol:RelationsLib"],
  HonkVerifier: ["HonkVerifier", "out-mainnet/EligibilityHonkVerifier.sol/HonkVerifier.json", "src/generated/EligibilityHonkVerifier.sol:HonkVerifier"],
  EligibilityVerifierAdapter: ["EligibilityVerifierAdapter", "out-mainnet/EligibilityVerifierAdapter.sol/EligibilityVerifierAdapter.json", "src/EligibilityVerifierAdapter.sol:EligibilityVerifierAdapter"],
  RobinhoodMainnetDemoCredentialRegistry: ["RobinhoodMainnetDemoCredentialRegistry", "out-mainnet/robinhood-mainnet/RobinhoodMainnetDemoCredentialRegistry.sol/RobinhoodMainnetDemoCredentialRegistry.json", "src/robinhood-mainnet/RobinhoodMainnetDemoCredentialRegistry.sol:RobinhoodMainnetDemoCredentialRegistry"],
  RobinhoodMainnetDemoOracle: ["RobinhoodMainnetDemoOracle", "out-mainnet/robinhood-mainnet/RobinhoodMainnetDemoOracle.sol/RobinhoodMainnetDemoOracle.json", "src/robinhood-mainnet/RobinhoodMainnetDemoOracle.sol:RobinhoodMainnetDemoOracle"],
  RobinhoodMainnetDemoToken: ["RobinhoodMainnetDemoToken", "out-mainnet/robinhood-mainnet/RobinhoodMainnetDemoToken.sol/RobinhoodMainnetDemoToken.json", "src/robinhood-mainnet/RobinhoodMainnetDemoToken.sol:RobinhoodMainnetDemoToken"],
  RobinhoodMainnetDemoLendingPool: ["RobinhoodMainnetDemoLendingPool", "out-mainnet/robinhood-mainnet/RobinhoodMainnetDemoLendingPool.sol/RobinhoodMainnetDemoLendingPool.json", "src/robinhood-mainnet/RobinhoodMainnetDemoLendingPool.sol:RobinhoodMainnetDemoLendingPool"],
  RobinhoodMainnetDemoGovernancePhase1: ["RobinhoodMainnetDemoGovernancePhase1", "out-mainnet/robinhood-mainnet/RobinhoodMainnetDemoGovernancePhase1.sol/RobinhoodMainnetDemoGovernancePhase1.json", "src/robinhood-mainnet/RobinhoodMainnetDemoGovernancePhase1.sol:RobinhoodMainnetDemoGovernancePhase1"],
};

function same(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }
function strip0x(value) { return String(value).replace(/^0x/i, ""); }
function getArtifact(name) { return JSON.parse(fs.readFileSync(path.join(CONTRACTS, definitions[name][1]), "utf8")); }
function makeInitcode(bytecode, refs, libraries = {}) {
  let value = strip0x(bytecode);
  for (const [source, libraryMap] of Object.entries(refs ?? {})) {
    for (const [name, locations] of Object.entries(libraryMap)) {
      const address = libraries[name];
      if (!address) throw new Error(`Missing linked library address for ${source}:${name}`);
      for (const location of locations) {
        const start = location.start * 2;
        const length = location.length * 2;
        value = `${value.slice(0, start)}${strip0x(address).toLowerCase().padStart(length, "0")}${value.slice(start + length)}`;
      }
    }
  }
  if (value.includes("__$")) throw new Error("Unresolved Solidity library placeholder.");
  return value.toLowerCase();
}
function maskImmutables(value, refs = {}) {
  let normalized = value;
  for (const slots of Object.values(refs)) for (const slot of slots) {
    normalized = `${normalized.slice(0, slot.start * 2)}${"0".repeat(slot.length * 2)}${normalized.slice((slot.start + slot.length) * 2)}`;
  }
  return normalized;
}
function successfulReceipt(run, entry) {
  const receipt = run.receipts.find((item) => same(item.transactionHash, entry.hash));
  if (!receipt || !["0x1", "1", 1].includes(receipt.status)) throw new Error(`Missing successful artifact receipt for ${entry.hash}`);
  if (!isAddress(receipt.contractAddress ?? entry.contractAddress ?? "")) throw new Error(`No contract address for ${entry.hash}`);
  return { ...receipt, contractAddress: receipt.contractAddress ?? entry.contractAddress };
}
function decodeConstructor(artifact, input, linkedBytecode) {
  const initcode = strip0x(input).toLowerCase();
  if (!initcode.startsWith(linkedBytecode)) throw new Error("Creation input does not match compiled artifact bytecode.");
  const inputs = artifact.abi.find((item) => item.type === "constructor")?.inputs ?? [];
  const encoded = `0x${initcode.slice(linkedBytecode.length)}`;
  const args = inputs.length ? decodeAbiParameters(inputs, encoded) : [];
  return { encoded, args };
}
function verifyCommand(name, address, constructorArgs, linkedLibraries) {
  const [,, source] = definitions[name];
  const compiler = getArtifact(name).metadata.compiler.version.split("+")[0];
  const args = [
    "forge verify-contract", address, source,
    "--profile robinhood_mainnet", `--chain-id ${CHAIN_ID}`,
    `--compiler-version ${compiler}`, "--evm-version cancun", "--num-of-optimizations 200",
    "--verifier blockscout", `--verifier-url '${VERIFY_API}'`,
  ];
  if (constructorArgs && constructorArgs !== "0x") args.push(`--constructor-args ${constructorArgs}`);
  for (const [library, address_] of Object.entries(linkedLibraries ?? {})) {
    args.push(`--libraries '${definitions[library][2]}:${address_}'`);
  }
  return `cd contracts && ${args.join(" ")}`;
}

async function main() {
  if (!fs.existsSync(DEPLOYMENT)) {
    throw new Error(`No Mainnet deployment artifact exists yet: ${DEPLOYMENT}. This command is read-only and does not deploy.`);
  }
  const run = JSON.parse(fs.readFileSync(DEPLOYMENT, "utf8"));
  if (Number(run.chain) !== CHAIN_ID) throw new Error(`Artifact chain is ${run.chain}; expected ${CHAIN_ID}.`);
  const rpcUrl = configuredRpcUrl();
  if (!rpcUrl) throw new Error("Set RH_MAINNET_RPC_URL to the Robinhood Mainnet read-only RPC.");
  rpcUrlForRedaction = rpcUrl;
  const chain = defineChain({
    id: CHAIN_ID, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 2, timeout: 30_000 }) });
  if (await client.getChainId() !== CHAIN_ID) throw new Error("Configured RPC is not Robinhood Mainnet chain 4663.");
  const headBlock = await client.getBlockNumber();

  const creations = run.transactions.filter((entry) => entry.transactionType === "CREATE");
  const named = (name) => {
    const matches = creations.filter((entry) => entry.contractName === name);
    if (!matches.length) throw new Error(`Deployment artifact has no CREATE entry named ${name}.`);
    return matches;
  };
  const libEntries = { ZKTranscriptLib: named("ZKTranscriptLib")[0], RelationsLib: named("RelationsLib")[0] };
  const libraryAddresses = Object.fromEntries(Object.entries(libEntries).map(([name, entry]) => {
    const receipt = successfulReceipt(run, entry);
    return [name, receipt.contractAddress];
  }));
  const honkArtifact = getArtifact("HonkVerifier");
  const honkInit = makeInitcode(honkArtifact.bytecode.object, honkArtifact.bytecode.linkReferences, libraryAddresses);
  const honkMatches = creations.filter((entry) => strip0x(entry.transaction.input).toLowerCase().startsWith(honkInit));
  if (honkMatches.length !== 1) throw new Error(`Expected one linked HonkVerifier deployment; found ${honkMatches.length}.`);

  const entries = {
    ZKTranscriptLib: libEntries.ZKTranscriptLib,
    RelationsLib: libEntries.RelationsLib,
    HonkVerifier: honkMatches[0],
    EligibilityVerifierAdapter: named("EligibilityVerifierAdapter")[0],
    RobinhoodMainnetDemoCredentialRegistry: named("RobinhoodMainnetDemoCredentialRegistry")[0],
    RobinhoodMainnetDemoOracle: named("RobinhoodMainnetDemoOracle")[0],
    RobinhoodMainnetDemoLendingPool: named("RobinhoodMainnetDemoLendingPool")[0],
    RobinhoodMainnetDemoGovernancePhase1: named("RobinhoodMainnetDemoGovernancePhase1")[0],
  };
  const tokenEntries = named("RobinhoodMainnetDemoToken");
  if (tokenEntries.length !== 2) throw new Error(`Expected exactly two controlled demo tokens; found ${tokenEntries.length}.`);
  entries.RobinhoodMainnetDemoTokenLoan = tokenEntries[0];
  entries.RobinhoodMainnetDemoTokenCollateral = tokenEntries[1];
  const deployment = {};
  const constructorArgs = {};
  const deploymentGas = {};

  for (const [name, entry] of Object.entries(entries)) {
    const coreName = name.startsWith("RobinhoodMainnetDemoToken") ? "RobinhoodMainnetDemoToken" : name;
    const artifact = getArtifact(coreName);
    const expectedInit = makeInitcode(artifact.bytecode.object, artifact.bytecode.linkReferences, coreName === "HonkVerifier" ? libraryAddresses : {});
    const receipt = successfulReceipt(run, entry);
    const address = receipt.contractAddress;
    const txReceipt = await client.getTransactionReceipt({ hash: entry.hash });
    if (txReceipt.status !== "success" || !same(txReceipt.contractAddress, address)) throw new Error(`${name} chain receipt failed or address mismatched.`);
    deploymentGas[name] = txReceipt.gasUsed.toString();
    const runtime = await client.getBytecode({ address });
    if (!runtime || runtime === "0x") throw new Error(`${name} has no deployed bytecode.`);
    const expectedRuntime = makeInitcode(artifact.deployedBytecode.object, artifact.deployedBytecode.linkReferences, coreName === "HonkVerifier" ? libraryAddresses : {});
    if (runtime.length !== expectedRuntime.length + 2) throw new Error(`${name} runtime length mismatches compiled artifact.`);
    const actualNormalized = maskImmutables(strip0x(runtime).toLowerCase(), artifact.deployedBytecode.immutableReferences);
    const expectedNormalized = maskImmutables(expectedRuntime, artifact.deployedBytecode.immutableReferences);
    if (name === "ZKTranscriptLib" || name === "RelationsLib") {
      const self = strip0x(address).toLowerCase();
      const actualSelfPrefix = `73${self}3014`;
      if (!actualNormalized.startsWith(actualSelfPrefix)) throw new Error(`${name} runtime self-address does not match receipt.`);
      const expectedSelfPrefix = `73${"0".repeat(40)}3014`;
      if (!expectedNormalized.startsWith(expectedSelfPrefix)) throw new Error(`${name} compiled runtime is missing its self-address placeholder.`);
      const normalizedActual = `${"73"}${"0".repeat(40)}3014${actualNormalized.slice(actualSelfPrefix.length)}`;
      if (keccak256(`0x${normalizedActual}`) !== keccak256(`0x${expectedNormalized}`)) throw new Error(`${name} runtime differs from compiled artifact bytecode.`);
    } else if (keccak256(`0x${actualNormalized}`) !== keccak256(`0x${expectedNormalized}`)) {
      throw new Error(`${name} deployed runtime differs from compiled artifact bytecode.`);
    }
    const decoded = decodeConstructor(artifact, entry.transaction.input, expectedInit);
    deployment[name] = address;
    constructorArgs[name] = decoded;
  }

  const registry = deployment.RobinhoodMainnetDemoCredentialRegistry;
  const oracle = deployment.RobinhoodMainnetDemoOracle;
  const pool = deployment.RobinhoodMainnetDemoLendingPool;
  const governance = deployment.RobinhoodMainnetDemoGovernancePhase1;
  const registryArgs = constructorArgs.RobinhoodMainnetDemoCredentialRegistry.args;
  const oracleArgs = constructorArgs.RobinhoodMainnetDemoOracle.args;
  const poolArgs = constructorArgs.RobinhoodMainnetDemoLendingPool.args;
  const governanceArgs = constructorArgs.RobinhoodMainnetDemoGovernancePhase1.args;
  const tokenDecoded = tokenEntries.map((entry) => {
    const artifact = getArtifact("RobinhoodMainnetDemoToken");
    const addr = successfulReceipt(run, entry).contractAddress;
    const args = decodeConstructor(artifact, entry.transaction.input, makeInitcode(artifact.bytecode.object, artifact.bytecode.linkReferences)).args;
    const linkedInit = makeInitcode(artifact.bytecode.object, artifact.bytecode.linkReferences);
    const { encoded } = decodeConstructor(artifact, entry.transaction.input, linkedInit);
    return { entry, address: addr, args, encoded };
  });
  const loanTokenRecord = tokenDecoded.find((item) => item.args[1] === "dUSD" || String(item.args[0]).includes("Lending Dollar"));
  const collateralTokenRecord = tokenDecoded.find((item) => item !== loanTokenRecord);
  if (!loanTokenRecord || !collateralTokenRecord) throw new Error("Could not identify both Mainnet demo token deployments from constructor arguments.");
  const loanToken = loanTokenRecord.address;
  const collateralToken = collateralTokenRecord.address;

  const readRole = async (contract, roleName, wallet, abi) => {
    const role = await client.readContract({ address: contract, abi, functionName: roleName });
    return client.readContract({ address: contract, abi, functionName: "hasRole", args: [role, wallet] });
  };
  const admin = registryArgs[0];
  const issuer = registryArgs[1];
  const oracleUpdater = oracleArgs[1];
  const riskAdmin = poolArgs[4];
  const pauseAuthority = poolArgs[5];
  const participants = poolArgs[8];
  const deployer = creations[0]?.transaction?.from;
  const distinctRoles = [deployer, admin, issuer, oracleUpdater, riskAdmin, pauseAuthority, loanTokenRecord.args[5], ...participants];
  if (distinctRoles.some((address) => !isAddress(address)) || new Set(distinctRoles.map((address) => String(address).toLowerCase())).size !== distinctRoles.length) {
    throw new Error("Deployment artifact constructor roles/participants are missing or not distinct.");
  }
  const tokenAdmin = loanTokenRecord.args[4];
  const minter = loanTokenRecord.args[5];
  const checks = [];
  const requireRole = async (contract, role, wallet, abi, label) => {
    if (!await readRole(contract, role, wallet, abi)) throw new Error(`${label} role readback failed.`);
    checks.push(`${label} role confirmed`);
  };
  const regAbi = getArtifact("RobinhoodMainnetDemoCredentialRegistry").abi;
  const oracleAbi = getArtifact("RobinhoodMainnetDemoOracle").abi;
  const tokenAbi = getArtifact("RobinhoodMainnetDemoToken").abi;
  const poolAbi = getArtifact("RobinhoodMainnetDemoLendingPool").abi;
  const govAbi = getArtifact("RobinhoodMainnetDemoGovernancePhase1").abi;
  await requireRole(registry, "DEFAULT_ADMIN_ROLE", admin, regAbi, "credential registry admin");
  await requireRole(registry, "ISSUER_ROLE", issuer, regAbi, "project issuer");
  await requireRole(oracle, "DEFAULT_ADMIN_ROLE", oracleArgs[0], oracleAbi, "oracle admin");
  await requireRole(oracle, "PRICE_UPDATER_ROLE", oracleUpdater, oracleAbi, "oracle updater");
  await requireRole(loanToken, "DEFAULT_ADMIN_ROLE", tokenAdmin, tokenAbi, "loan demo token admin");
  await requireRole(loanToken, "MINTER_ROLE", minter, tokenAbi, "loan demo token minter");
  await requireRole(collateralToken, "DEFAULT_ADMIN_ROLE", collateralTokenRecord.args[4], tokenAbi, "collateral demo token admin");
  await requireRole(collateralToken, "MINTER_ROLE", collateralTokenRecord.args[5], tokenAbi, "collateral demo token minter");
  await requireRole(pool, "DEFAULT_ADMIN_ROLE", admin, poolAbi, "Lending admin");
  await requireRole(pool, "RISK_ADMIN_ROLE", riskAdmin, poolAbi, "Lending risk admin");
  await requireRole(pool, "PAUSER_ROLE", pauseAuthority, poolAbi, "Lending pause authority");
  for (const wallet of participants) await requireRole(pool, "DEMO_PARTICIPANT_ROLE", wallet, poolAbi, "demo participant");
  await requireRole(governance, "PAUSER_ROLE", pauseAuthority, govAbi, "governance pause authority");
  await requireRole(governance, "DEFAULT_ADMIN_ROLE", governanceArgs[1], govAbi, "governance admin");
  const adapterAbi = getArtifact("EligibilityVerifierAdapter").abi;
  const adapterVerifier = await client.readContract({ address: deployment.EligibilityVerifierAdapter, abi: adapterAbi, functionName: "honkVerifier" });
  if (!same(adapterVerifier, deployment.HonkVerifier)) throw new Error("Verifier adapter HonkVerifier dependency mismatch.");
  checks.push("verifier adapter dependency confirmed");

  for (const [contract, abi, functionName, expected, label] of [
    [pool, poolAbi, "credentialRegistry", registry, "pool registry dependency"],
    [pool, poolAbi, "priceOracle", oracle, "pool oracle dependency"],
    [pool, poolAbi, "eligibilityVerifier", deployment.EligibilityVerifierAdapter, "pool verifier adapter dependency"],
    [pool, poolAbi, "demoLoanAsset", loanToken, "pool loan token dependency"],
    [pool, poolAbi, "demoCollateralAsset", collateralToken, "pool collateral token dependency"],
    [governance, govAbi, "credentialRegistry", registry, "governance registry dependency"],
  ]) {
    const actual = await client.readContract({ address: contract, abi, functionName });
    if (!same(actual, expected)) throw new Error(`${label} mismatch.`);
    checks.push(`${label} confirmed`);
  }
  if (await client.readContract({ address: pool, abi: poolAbi, functionName: "reserveCount" }) !== 2n) throw new Error("Lending pool must have exactly two demo reserves.");
  const reserveAssets = await client.readContract({ address: pool, abi: poolAbi, functionName: "getReserveAssets" });
  if (reserveAssets.length !== 2 || !reserveAssets.some((asset) => same(asset, loanToken)) || !reserveAssets.some((asset) => same(asset, collateralToken))) {
    throw new Error("Lending reserve addresses do not match the two controlled demo token receipts.");
  }
  if (!(await client.readContract({ address: pool, abi: poolAbi, functionName: "paused" }))) throw new Error("Lending pool is not fail-closed paused after deployment.");
  if (!(await client.readContract({ address: governance, abi: govAbi, functionName: "paused" }))) throw new Error("Governance is not paused after deployment.");
  if (await client.readContract({ address: governance, abi: govAbi, functionName: "quorum" }) !== governanceArgs[4]) throw new Error("Governance quorum differs from its constructor setting.");
  if (await client.readContract({ address: governance, abi: govAbi, functionName: "votingPeriod" }) !== governanceArgs[3]) throw new Error("Governance voting period differs from its constructor setting.");
  for (const [address, token] of [[loanToken, loanTokenRecord], [collateralToken, collateralTokenRecord]]) {
    const supply = await client.readContract({ address, abi: tokenAbi, functionName: "totalSupply" });
    const cap = await client.readContract({ address, abi: tokenAbi, functionName: "mintCap" });
    if (supply !== 0n || cap !== token.args[3]) throw new Error("Demo token initial supply or mint cap differs from constructor evidence.");
  }
  const oracleAbiForRead = oracleAbi;
  for (const token of [loanToken, collateralToken]) {
    const bounds = await client.readContract({ address: oracle, abi: oracleAbiForRead, functionName: "getPriceBounds", args: [token] });
    if (bounds[2] !== 0n || bounds[3] !== 0n) throw new Error("Oracle unexpectedly contains a seeded synthetic price.");
  }
  checks.push("two demo reserve addresses confirmed", "Lending and Governance start paused", "tokens have zero initial supply", "oracle has configured bounds but no seeded prices");

  const verifiedCount = await sourceVerificationCount(deployment);
  process.stdout.write(JSON.stringify({
    chainId: CHAIN_ID,
    headBlock: headBlock.toString(),
    deploymentArtifact: path.relative(ROOT, DEPLOYMENT),
    contracts: deployment,
    successfulReceiptCount: Object.keys(deployment).length,
    deploymentReceipts: verified.map(({ name, address, hash, block, gasUsed, runtimeCodeHash }) => ({
      name,
      address,
      transactionHash: hash,
      blockNumber: block.toString(),
      gasUsed: gasUsed.toString(),
      runtimeCodeHash,
      status: "success",
    })),
    roleAndDependencyChecks: checks,
    deploymentGas,
    blockscoutSourceVerification: verifiedCount,
    verificationCommands: renderVerificationCommands(deployment, constructorArgs, [loanTokenRecord, collateralTokenRecord], libraryAddresses),
    readOnly: true,
  }, null, 2) + "\n");

  async function sourceVerificationCount(addresses) {
    let count = 0;
    const statusByContract = {};
    for (const [name, address] of Object.entries(addresses)) {
      try {
        const response = await fetch(`${EXPLORER}/api/v2/addresses/${address}`, { signal: AbortSignal.timeout(8_000) });
        if (!response.ok) { statusByContract[name] = `unavailable HTTP ${response.status}`; continue; }
        const body = await response.json();
        if (body.is_verified === true) { count++; statusByContract[name] = "verified"; }
        else statusByContract[name] = "not verified";
      } catch (error) { statusByContract[name] = `unavailable: ${error instanceof Error ? error.message : "request failed"}`; }
    }
    return { verifiedCount: count, total: 10, statusByContract, verificationSubmissionsPerformed: false };
  }
}

function renderVerificationCommands(addresses, argsByName, tokenRecords, libraries) {
  const order = ["ZKTranscriptLib", "RelationsLib", "HonkVerifier", "EligibilityVerifierAdapter", "RobinhoodMainnetDemoCredentialRegistry", "RobinhoodMainnetDemoOracle", "RobinhoodMainnetDemoTokenLoan", "RobinhoodMainnetDemoTokenCollateral", "RobinhoodMainnetDemoLendingPool", "RobinhoodMainnetDemoGovernancePhase1"];
  return order.map((name) => {
    const token = name.startsWith("RobinhoodMainnetDemoToken")
      ? tokenRecords[name.endsWith("Loan") ? 0 : 1]
      : undefined;
    const contractName = token ? "RobinhoodMainnetDemoToken" : name;
    const contractAddress = token?.address ?? addresses[name];
    const encoded = token ? token.encoded : argsByName[name]?.encoded;
    const links = name === "HonkVerifier"
      ? ` --libraries 'src/generated/EligibilityHonkVerifier.sol:ZKTranscriptLib:${libraries.ZKTranscriptLib}' --libraries 'src/generated/EligibilityHonkVerifier.sol:RelationsLib:${libraries.RelationsLib}'`
      : "";
    const line = `cd contracts && forge verify-contract ${contractAddress} ${definitions[contractName][2]} --profile robinhood_mainnet --chain-id 4663 --compiler-version 0.8.28 --evm-version cancun --num-of-optimizations 200 --verifier blockscout --verifier-url '${VERIFY_API}'${encoded && encoded !== "0x" ? ` --constructor-args ${encoded}` : ""}${links}`;
    return { contract: name, address: contractAddress, command: line };
  });
}

main().catch((error) => {
  let message = error instanceof Error ? error.message : String(error);
  if (rpcUrlForRedaction) message = message.split(rpcUrlForRedaction).join("<configured Robinhood Mainnet RPC>");
  process.stderr.write(`Robinhood Mainnet read-only check failed: ${message}\n`);
  process.exitCode = 1;
});
