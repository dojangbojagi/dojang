#!/usr/bin/env bun
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createPublicClient, defineChain, getAddress, http, keccak256, parseAbi } from "viem";

const ROOT = process.cwd();
const CHAIN_ID = 46_630;
const RPC_FALLBACK = "https://rpc.testnet.chain.robinhood.com";
const EXPLORER = "https://explorer.testnet.chain.robinhood.com";
const DEFAULT_ARTIFACT = "contracts/broadcast/DeployRobinhoodDaoPhase2.s.sol/46630/run-latest.json";
const A = getAddress("0x3cdb91a29b73daB9219D9A287543800B417b6dbB");
const B = getAddress("0xBE390374Ac7304A792c50EA37AB301b659a56Df7");
const DEFAULT_ADMIN_ROLE = `0x${"0".repeat(64)}`;
const repAbi = parseAbi([
  "function lendingPool() view returns (address)",
  "function paused() view returns (bool)",
  "function REPUTATION_ISSUER_ROLE() view returns (bytes32)",
  "function PAUSER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)",
  "function isActiveClaim(address) view returns (bool)",
]);
const govAbi = parseAbi([
  "function credentialRegistry() view returns (address)",
  "function reputationRegistry() view returns (address)",
  "function eligibilityVerifier() view returns (address)",
  "function paused() view returns (bool)",
  "function commitPeriod() view returns (uint64)",
  "function revealPeriod() view returns (uint64)",
  "function executionWindow() view returns (uint64)",
  "function quorum() view returns (uint256)",
  "function minimumReputation() view returns (uint256)",
  "function nextProposalId() view returns (uint256)",
  "function PAUSER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)",
  "function isActiveMember(address) view returns (bool)",
]);
const registryAbi = parseAbi([
  "function ISSUER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)",
  "function getCredential(address,uint256) view returns ((address wallet,bytes32 commitment,address issuer,uint64 issuedAt,uint64 expiresAt,uint64 version,bool revoked) credential)",
]);

const args = process.argv.slice(2);
let artifactRelativePath = DEFAULT_ARTIFACT;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--presentation" || arg === "--plain") continue;
  if (arg === "--artifact") {
    artifactRelativePath = args[++index];
    assert.ok(artifactRelativePath, "--artifact requires a Foundry broadcast artifact path.");
    continue;
  }
  assert.ok(false, `Unknown option: ${arg}`);
}
const ARTIFACT = path.resolve(ROOT, artifactRelativePath);
const artifactPathFromRoot = path.relative(ROOT, ARTIFACT);
assert.ok(
  artifactPathFromRoot.startsWith(`contracts${path.sep}broadcast${path.sep}`) && artifactPathFromRoot.endsWith(`${path.sep}run-latest.json`),
  "Deployment evidence must be a run-latest.json file inside contracts/broadcast.",
);
assert.ok(!(args.includes("--presentation") && args.includes("--plain")), "Choose --presentation or --plain.");
const presentation = args.includes("--presentation");
const plain = args.includes("--plain");
const tty = Boolean(process.stdout.isTTY) && process.env.TERM !== "dumb";
const color = !plain && tty && process.env.NO_COLOR === undefined;
const columns = Math.max(72, process.stdout.columns || Number(process.env.COLUMNS) || 110);
const width = Math.min(104, columns - 2);
const inner = width - 4;
const palette = {
  burgundy: [198, 56, 96, 168, 91],
  rose: [225, 138, 164, 217, 97],
  white: [244, 237, 239, 255, 97],
  muted: [185, 163, 169, 181, 90],
  green: [122, 211, 159, 114, 92],
};

function paint(text, tone = "white") {
  if (!color) return text;
  const [r, g, b, ansi256, ansi16] = palette[tone];
  const code = process.env.COLORTERM === "truecolor" || process.env.COLORTERM === "24bit"
    ? `38;2;${r};${g};${b}`
    : (process.env.TERM ?? "").includes("256color") ? `38;5;${ansi256}` : String(ansi16);
  return `\u001b[${code}m${text}\u001b[0m`;
}

const glyphs = [
  ["  ####  ", " ##     ", "##  ### ", "##    ##", " ###### "],
  ["##    ##", " ##  ## ", "  ####  ", "   ##   ", "   ##   "],
  ["########", "##      ", "######  ", "##      ", "########"],
  ["##    ##", "##    ##", " ##  ## ", " ##  ## ", "  ####  "],
  ["  ####  ", " ##  ## ", "##    ##", " ##  ## ", "  ####  "],
];
const logo = Array.from({ length: 5 }, (_, row) => glyphs.map((glyph) => glyph[row]).join("  "));

function wrap(text, limit = inner) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const rows = [];
  let row = "";
  for (const word of words) {
    if (word.length > limit) {
      if (row) rows.push(row);
      row = "";
      for (let i = 0; i < word.length; i += limit) rows.push(word.slice(i, i + limit));
    } else if (!row) row = word;
    else if (row.length + word.length + 1 <= limit) row += ` ${word}`;
    else { rows.push(row); row = word; }
  }
  if (row) rows.push(row);
  return rows.length ? rows : [""];
}

function border(char = "-") { return `+${char.repeat(width - 2)}+`; }
function boxLine(text = "", tone = "white") {
  return wrap(text).map((row) => `| ${paint(row.padEnd(inner), tone)} |`).join("\n");
}
function card(title, rows, tone = "white") {
  return [paint(border(), "burgundy"), boxLine(title, "rose"), ...rows.flatMap(([text, rowTone = tone]) => boxLine(text, rowTone)), paint(border(), "burgundy")].join("\n");
}
function header() {
  const pad = (text) => {
    const p = Math.max(0, Math.floor((inner - text.length) / 2));
    return `| ${" ".repeat(p)}${paint(text, "white")}${" ".repeat(Math.max(0, inner - p - text.length))} |`;
  };
  const logoPad = (text) => {
    const p = Math.max(0, Math.floor((inner - text.length) / 2));
    return `| ${" ".repeat(p)}${paint(text, "rose")}${" ".repeat(Math.max(0, inner - p - text.length))} |`;
  };
  return [paint(border("="), "burgundy"), pad("G Y E V O"), ...logo.map(logoPad), pad("DAO PHASE 2  /  DEPLOYMENT EVIDENCE"), logoPad("ROBINHOOD TESTNET  |  CHAIN 46630"), pad("LIVE READ-ONLY VERIFICATION  |  NO TRANSACTIONS"), paint(border("="), "burgundy")].join("\n");
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function stage(label, task) {
  if (!presentation || !tty) {
    process.stdout.write(`${paint("CHECK", "rose")} ${label}\n`);
    return task();
  }
  const frames = ["◐", "◓", "◑", "◒"];
  let frame = 0;
  process.stdout.write(`  ${paint(frames[0], "burgundy")} ${label}`);
  const timer = setInterval(() => {
    frame = (frame + 1) % frames.length;
    process.stdout.write(`\r  ${paint(frames[frame], "burgundy")} ${label}`);
  }, 110);
  try {
    const result = await task();
    clearInterval(timer);
    process.stdout.write(`\r  ${paint("✓", "green")} ${label}\n`);
    return result;
  } catch (error) {
    clearInterval(timer);
    process.stdout.write(`\r  ${paint("✕", "burgundy")} ${label}\n`);
    throw error;
  }
}

function readArtifact() {
  assert.ok(fs.existsSync(ARTIFACT), `Deployment artifact is missing: ${ARTIFACT}`);
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  assert.equal(Number(artifact.chain), CHAIN_ID, "Foundry artifact is not for chain 46630.");
  assert.equal(artifact.transactions?.length, 2, "Expected exactly two Phase 2 contract creations.");
  assert.equal(artifact.receipts?.length, 2, "Expected one artifact receipt per deployment transaction.");
  const byName = {};
  for (const name of ["RobinhoodLendingReputation", "RobinhoodGovernancePhase2"]) {
    const tx = artifact.transactions.find((item) => item.transactionType === "CREATE" && item.contractName === name);
    assert.ok(tx, `Foundry artifact does not include ${name}.`);
    const receipt = artifact.receipts.find((item) => item.transactionHash?.toLowerCase() === tx.hash?.toLowerCase());
    assert.ok(receipt && receipt.status === "0x1", `${name} artifact receipt is not successful.`);
    byName[name] = { tx, receipt, address: getAddress(receipt.contractAddress ?? tx.contractAddress) };
  }
  return { artifact, byName };
}

function runFoundryTests() {
  return new Promise((resolve, reject) => {
    const child = spawn("bun", ["run", "contracts:test"], { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      const summary = output.match(/Ran (\d+) test suites? in [^\n]*?:\s*(\d+) tests? passed,\s*(\d+) failed,\s*(\d+) skipped\s*\((\d+) total tests?\)/i);
      if (code !== 0) return reject(new Error(`Foundry test command exited ${code}. ${output.trim().split("\n").slice(-4).join(" ").slice(0, 220)}`));
      if (!summary) return reject(new Error("Foundry exited successfully but did not report a parseable test summary."));
      resolve({ suites: Number(summary[1]), passed: Number(summary[2]), failed: Number(summary[3]), skipped: Number(summary[4]), total: Number(summary[5]) });
    });
  });
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  assert.ok(value, `Missing required configuration ${name}.`);
  return getAddress(value);
}
function same(left, right) { return String(left).toLowerCase() === String(right).toLowerCase(); }
function equalAddress(left, right, label) { assert.ok(same(left, right), `${label} does not match configured or deployed value.`); }

async function verifyLive(deployment) {
  const rpcUrl = process.env.RH_TESTNET_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL || RPC_FALLBACK;
  const chain = defineChain({
    id: CHAIN_ID,
    name: "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 2, timeout: 15_000 }) });
  const chainId = await client.getChainId();
  assert.equal(chainId, CHAIN_ID, `RPC returned chain ${chainId}; expected 46630.`);
  const head = await client.getBlockNumber();
  const configured = {
    reputation: requiredEnv("RH_TESTNET_PHASE2_REPUTATION_REGISTRY_ADDRESS"),
    governance: requiredEnv("RH_TESTNET_PHASE2_GOVERNANCE_ADDRESS"),
    publicReputation: requiredEnv("NEXT_PUBLIC_ROBINHOOD_PHASE2_REPUTATION_REGISTRY_CONTRACT"),
    publicGovernance: requiredEnv("NEXT_PUBLIC_ROBINHOOD_PHASE2_GOVERNANCE_CONTRACT"),
    pool: requiredEnv("RH_TESTNET_LENDING_V2_POOL_ADDRESS"),
    registry: requiredEnv("RH_TESTNET_CREDENTIAL_REGISTRY_ADDRESS"),
    verifier: requiredEnv("RH_TESTNET_VERIFIER_ADAPTER_ADDRESS"),
    deployer: requiredEnv("RH_TESTNET_PHASE2_DEPLOYER_ADDRESS"),
    admin: requiredEnv("RH_TESTNET_PHASE2_ADMIN_ADDRESS"),
    membershipIssuer: requiredEnv("RH_TESTNET_PHASE2_MEMBERSHIP_ISSUER_ADDRESS"),
    reputationIssuer: requiredEnv("RH_TESTNET_PHASE2_REPUTATION_ISSUER_ADDRESS"),
    pauseAuthority: requiredEnv("RH_TESTNET_PHASE2_PAUSE_AUTHORITY_ADDRESS"),
  };
  const rep = deployment.byName.RobinhoodLendingReputation;
  const gov = deployment.byName.RobinhoodGovernancePhase2;
  equalAddress(configured.reputation, rep.address, "Configured reputation address");
  equalAddress(configured.publicReputation, rep.address, "Frontend reputation address");
  equalAddress(configured.governance, gov.address, "Configured governance address");
  equalAddress(configured.publicGovernance, gov.address, "Frontend governance address");
  equalAddress(rep.tx.transaction.from, configured.deployer, "Reputation deployment sender");
  equalAddress(gov.tx.transaction.from, configured.deployer, "Governance deployment sender");

  const receipts = [];
  for (const item of [rep, gov]) {
    const [receipt, tx, code] = await Promise.all([
      client.getTransactionReceipt({ hash: item.tx.hash }),
      client.getTransaction({ hash: item.tx.hash }),
      client.getBytecode({ address: item.address }),
    ]);
    assert.equal(receipt.status, "success", `${item.tx.contractName} live receipt failed.`);
    assert.equal(receipt.transactionHash.toLowerCase(), item.tx.hash.toLowerCase(), "Receipt transaction hash mismatch.");
    equalAddress(receipt.contractAddress, item.address, `${item.tx.contractName} receipt address`);
    equalAddress(tx.from, configured.deployer, `${item.tx.contractName} transaction sender`);
    assert.equal(tx.chainId, CHAIN_ID, `${item.tx.contractName} transaction chain mismatch.`);
    assert.ok(code && code !== "0x", `${item.tx.contractName} has no live runtime bytecode.`);
    receipts.push({ name: item.tx.contractName, address: item.address, hash: item.tx.hash, block: receipt.blockNumber.toString(), codeHash: keccak256(code) });
  }

  const [repPaused, lendingPool, repIssuerRole, repPauseRole] = await Promise.all([
    client.readContract({ address: rep.address, abi: repAbi, functionName: "paused" }),
    client.readContract({ address: rep.address, abi: repAbi, functionName: "lendingPool" }),
    client.readContract({ address: rep.address, abi: repAbi, functionName: "REPUTATION_ISSUER_ROLE" }),
    client.readContract({ address: rep.address, abi: repAbi, functionName: "PAUSER_ROLE" }),
  ]);
  const [govPaused, govRegistry, govRep, govVerifier, govPauseRole, commit, reveal, execution, quorum, threshold, nextProposal] = await Promise.all([
    client.readContract({ address: gov.address, abi: govAbi, functionName: "paused" }),
    client.readContract({ address: gov.address, abi: govAbi, functionName: "credentialRegistry" }),
    client.readContract({ address: gov.address, abi: govAbi, functionName: "reputationRegistry" }),
    client.readContract({ address: gov.address, abi: govAbi, functionName: "eligibilityVerifier" }),
    client.readContract({ address: gov.address, abi: govAbi, functionName: "PAUSER_ROLE" }),
    client.readContract({ address: gov.address, abi: govAbi, functionName: "commitPeriod" }),
    client.readContract({ address: gov.address, abi: govAbi, functionName: "revealPeriod" }),
    client.readContract({ address: gov.address, abi: govAbi, functionName: "executionWindow" }),
    client.readContract({ address: gov.address, abi: govAbi, functionName: "quorum" }),
    client.readContract({ address: gov.address, abi: govAbi, functionName: "minimumReputation" }),
    client.readContract({ address: gov.address, abi: govAbi, functionName: "nextProposalId" }),
  ]);
  equalAddress(lendingPool, configured.pool, "Reputation -> Lending V2 dependency");
  equalAddress(govRegistry, configured.registry, "Governance -> credential registry dependency");
  equalAddress(govRep, rep.address, "Governance -> reputation dependency");
  equalAddress(govVerifier, configured.verifier, "Governance -> verifier dependency");
  assert.equal(repPaused, true, "Reputation contract is not paused.");
  assert.equal(govPaused, true, "Governance contract is not paused.");

  const configuredParams = [
    BigInt(process.env.RH_TESTNET_PHASE2_COMMIT_PERIOD ?? "0"),
    BigInt(process.env.RH_TESTNET_PHASE2_REVEAL_PERIOD ?? "0"),
    BigInt(process.env.RH_TESTNET_PHASE2_EXECUTION_WINDOW ?? "0"),
    BigInt(process.env.RH_TESTNET_PHASE2_QUORUM ?? "0"),
    BigInt(process.env.RH_TESTNET_PHASE2_MINIMUM_REPUTATION ?? "0"),
  ];
  assert.deepEqual([commit, reveal, execution, quorum, threshold], configuredParams, "On-chain parameters differ from configured DAO Phase 2 values.");
  const repArgs = rep.tx.arguments;
  const govArgs = gov.tx.arguments;
  assert.equal(repArgs.length, 4, "Reputation constructor args missing.");
  assert.equal(govArgs.length, 10, "Governance constructor args missing.");
  [configured.pool, configured.admin, configured.reputationIssuer, configured.pauseAuthority].forEach((v, i) => equalAddress(repArgs[i], v, `Reputation constructor argument ${i}`));
  [configured.registry, rep.address, configured.verifier, configured.admin, configured.pauseAuthority].forEach((v, i) => equalAddress(govArgs[i], v, `Governance constructor argument ${i}`));
  assert.deepEqual(govArgs.slice(5).map(String), configuredParams.map(String), "Governance constructor parameters differ from .env.");

  const registryRole = await client.readContract({ address: configured.registry, abi: registryAbi, functionName: "ISSUER_ROLE" });
  const [repAdminOk, repIssuerOk, repPauseOk, govAdminOk, govPauseOk, memberIssuerOk] = await Promise.all([
    client.readContract({ address: rep.address, abi: repAbi, functionName: "hasRole", args: [DEFAULT_ADMIN_ROLE, configured.admin] }),
    client.readContract({ address: rep.address, abi: repAbi, functionName: "hasRole", args: [repIssuerRole, configured.reputationIssuer] }),
    client.readContract({ address: rep.address, abi: repAbi, functionName: "hasRole", args: [repPauseRole, configured.pauseAuthority] }),
    client.readContract({ address: gov.address, abi: govAbi, functionName: "hasRole", args: [DEFAULT_ADMIN_ROLE, configured.admin] }),
    client.readContract({ address: gov.address, abi: govAbi, functionName: "hasRole", args: [govPauseRole, configured.pauseAuthority] }),
    client.readContract({ address: configured.registry, abi: registryAbi, functionName: "hasRole", args: [registryRole, configured.membershipIssuer] }),
  ]);
  assert.ok(repAdminOk && repIssuerOk && repPauseOk && govAdminOk && govPauseOk && memberIssuerOk, "One or more live role assignments are missing.");

  const wallets = await Promise.all([A, B].map(async (wallet) => {
    const [credential, claim, activeClaim, member] = await Promise.all([
      client.readContract({ address: configured.registry, abi: registryAbi, functionName: "getCredential", args: [wallet, 5n] }),
      client.readContract({ address: rep.address, abi: parseAbi(["function getClaim(address) view returns ((address wallet,bytes32 commitment,address issuer,uint64 issuedAt,uint64 expiresAt,uint64 credentialVersion,uint64 modelVersion,uint256 observedFromBlock,uint256 observedToBlock,bytes32 evidenceHash,bool revoked) claim)"]), functionName: "getClaim", args: [wallet] }),
      client.readContract({ address: rep.address, abi: repAbi, functionName: "isActiveClaim", args: [wallet] }),
      client.readContract({ address: gov.address, abi: govAbi, functionName: "isActiveMember", args: [wallet] }),
    ]);
    return { wallet, credentialVersion: credential.version, claimVersion: claim.credentialVersion, activeClaim, member };
  }));
  for (const address of [configured.pool, configured.registry, configured.verifier]) {
    const code = await client.getBytecode({ address });
    assert.ok(code && code !== "0x", `Dependency has no runtime bytecode: ${address}`);
  }
  return { chainId, head: head.toString(), receipts, states: { repPaused, govPaused, commit, reveal, execution, quorum, threshold, nextProposal }, roles: { repAdminOk, repIssuerOk, repPauseOk, govAdminOk, govPauseOk, memberIssuerOk }, wallets };
}

function sceneData(tests, live) {
  const p = live.receipts[0];
  const g = live.receipts[1];
  const walletRows = live.wallets.map((w, i) => [`Wallet ${i ? "B" : "A"} · Policy 5 version ${w.credentialVersion} · claim ${w.activeClaim ? "ACTIVE" : "not issued"} · membership ${w.member ? "REGISTERED" : "not registered"}`, w.activeClaim ? "green" : "muted"]);
  return [
    { title: "01  /  LOCAL SOLIDITY TESTS", rows: [[`Foundry: ${tests.passed}/${tests.total} passed · ${tests.failed} failed · ${tests.skipped} skipped (${tests.suites} suites)`, "green"], ["Execution source: this command's local contracts:test run; not chain evidence.", "muted"]] },
    { title: "02  /  LIVE ROBINHOOD TESTNET", rows: [[`RPC chain ${live.chainId} · head ${live.head}`, "green"], ["Evidence mode: live RPC receipts and contract reads · no replay fallback", "muted"], [`Confirmed deployments: ${live.receipts.length}/2 · runtime bytecode present: ${live.receipts.length}/2`, "green"]] },
    { title: "03  /  REPUTATION REGISTRY", rows: [[p.address, "white"], [`Receipt ${p.hash}`, "rose"], [`Block ${p.block} · runtime code ${p.codeHash.slice(0, 18)}…`, "muted"], ["Dependency: confirmed Lending V2 pool", "green"]] },
    { title: "04  /  GOVERNANCE", rows: [[g.address, "white"], [`Receipt ${g.hash}`, "rose"], [`Block ${g.block} · runtime code ${g.codeHash.slice(0, 18)}…`, "muted"], ["Dependencies: credential registry · reputation registry · eligibility verifier", "green"]] },
    { title: "05  /  POLICY 5 · LIVE STATE", rows: [[`Reputation registry: ${live.states.repPaused ? "PAUSED" : "ACTIVE"} · Governance: ${live.states.govPaused ? "PAUSED" : "ACTIVE"}`, live.states.repPaused && live.states.govPaused ? "rose" : "burgundy"], [`Minimum reputation ${live.states.threshold} · quorum ${live.states.quorum}`, "white"], [`Commit ${live.states.commit}s · reveal ${live.states.reveal}s · execution ${live.states.execution}s`, "white"], [`Next proposal ID ${live.states.nextProposal}`, "muted"]] },
    { title: "06  /  CURRENT VOTER PROVISIONING", rows: [...walletRows, ["Policy 5 proof-backed membership is separate from reputation eligibility.", "muted"]] },
    { title: "G Y E V O  /  VERIFIED DEPLOYMENT EVIDENCE", rows: [["Robinhood Testnet · chain 46630", "rose"], ["Confirmed receipts and live runtime code are distinct from local Foundry tests.", "white"], ["READ ONLY · no signing · no broadcast · no state changes", "muted"]] },
  ];
}

async function play(scenes) {
  const holds = [4_300, 5_700, 6_500, 6_500, 6_700, 5_700, 6_000];
  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    process.stdout.write(`\n${card(scene.title, scene.rows)}\n`);
    await sleep(holds[i]);
  }
  return holds.reduce((sum, n) => sum + n, 0);
}

function safeError(error) {
  const rpc = process.env.RH_TESTNET_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL;
  let message = String(error?.shortMessage || error?.message || error);
  if (rpc) message = message.replaceAll(rpc, "[configured Robinhood RPC]");
  message = message.replace(/https?:\/\/[^\s)]+/gi, "[endpoint]").replace(/[\r\n]+/g, " ");
  if (/fetch failed|ECONNRESET|timed out|timeout|network is unreachable|HTTP request failed/i.test(message)) return "Robinhood RPC is unavailable or returned an HTTP error; no live verification is claimed.";
  return message.slice(0, 200);
}

async function main() {
  if (presentation && tty) process.stdout.write(`${header()}\n\n`);
  try {
    const tests = await stage("Run local Foundry contract suite", runFoundryTests);
    const deployment = await stage("Read confirmed Phase 2 Foundry receipts", async () => readArtifact());
    const live = await stage("Check Robinhood Testnet receipts, bytecode, roles and state", async () => verifyLive(deployment));
    const scenes = sceneData(tests, live);
    if (presentation && tty) await play(scenes);
    else {
      for (const scene of scenes) process.stdout.write(`${card(scene.title, scene.rows)}\n`);
    }
    process.stdout.write(`\nExplorer: ${EXPLORER}/address\n${live.receipts[1].address}\n`);
  } catch (error) {
    process.stderr.write(`${paint("VERIFICATION FAILED", "burgundy")} · ${safeError(error)}\n`);
    process.stderr.write("No offline PASS, transaction signing, or broadcast was attempted.\n");
    process.exitCode = 1;
  }
}

await main();
