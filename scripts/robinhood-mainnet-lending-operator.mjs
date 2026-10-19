#!/usr/bin/env bun
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import {
  decodeEventLog, encodeFunctionData, getAddress,
  isAddress, keccak256, parseAbi, zeroAddress,
} from "viem";
import { computeEligibilityCommitment, generateFieldSalt } from "../src/lib/zk/commitment.ts";
import { parseDemoCredentialWitness } from "../src/lib/credential/witness.ts";
import { robinhoodMainnetDemoContracts as contracts, ROBINHOOD_MAINNET_CHAIN_ID as CHAIN_ID } from "../src/lib/config/robinhood-mainnet-demo.ts";
import { appendConfirmedMainnetCheckpoint } from "./mainnet-checkpoint.mjs";
import { createVerifiedMainnetClient, formatMainnetRpcError, getMainnetRpcCandidates, requestMainnetRpcReadBatch } from "./robinhood-mainnet-rpc.mjs";
import { spawnMainnetCast } from "./robinhood-mainnet-cast.mjs";

const ROOT = process.cwd();
const ARTIFACT = path.join(ROOT, "contracts/broadcast/DeployRobinhoodMainnetDemoStack.s.sol/4663/run-latest.json");
const EXPLORER = "https://robinhoodchain.blockscout.com";
const POLICY_ID = 3n;
const POLICY_VERSION = 1n;
const THRESHOLD = 1_000n;
const MAX_LOG_BLOCKS_PER_QUERY = 1_000n;
const ROBINHOOD_PRIMARY_LOG_BLOCKS_PER_QUERY = 20_000n;
const ROLE_LOG_BATCH_SIZE = 2;
const ROLE_LOG_BATCH_INTERVAL_MS = 350;
const EXPECTED_MARKER = keccak256(new TextEncoder().encode("ROBINHOOD_MAINNET_CONTROLLED_DEMO_ASSET_V1")).slice(0, 10);
const AUTH = {
  price: "oracle-price",
  mint: "token-mint",
  "issue-lending": "credential-policy-3",
  "unpause-pool": "unpause-lending",
  "participant-revoke": "participant-revoke",
  "participant-grant": "participant-grant",
};
const poolAbi = parseAbi([
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)", "function RISK_ADMIN_ROLE() view returns (bytes32)",
  "function PAUSER_ROLE() view returns (bytes32)", "function DEMO_PARTICIPANT_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)", "function paused() view returns (bool)",
  "function grantRole(bytes32,address)", "function revokeRole(bytes32,address)",
  "function demoOnly() view returns (bool)", "function isDemoParticipant(address) view returns (bool)",
  "function credentialRegistry() view returns (address)", "function eligibilityVerifier() view returns (address)",
  "function priceOracle() view returns (address)", "function demoLoanAsset() view returns (address)",
  "function demoCollateralAsset() view returns (address)", "function getReserveAssets() view returns (address[])",
  "function getReserveConfig(address) view returns ((uint256 supplyCap,uint256 borrowCap,uint256 collateralCap,uint256 minBorrowAmount,uint64 maxOracleAge,uint16 maxLtvBps,uint16 liquidationThresholdBps,uint16 liquidationBonusBps,uint16 closeFactorBps,uint16 reserveFactorBps,uint16 optimalUtilizationBps,uint16 baseBorrowRateBps,uint16 slope1Bps,uint16 slope2Bps,bool active,bool supplyEnabled,bool borrowEnabled,bool collateralEnabled))",
  "function pauseRisk()", "function unpauseRisk()",
]);
const tokenAbi = parseAbi([
  "function totalSupply() view returns (uint256)", "function mintCap() view returns (uint256)",
  "function decimals() view returns (uint8)", "function symbol() view returns (string)",
  "function demoOnly() view returns (bool)", "function controlledDemoAssetMarker() view returns (bytes4)",
  "function MINTER_ROLE() view returns (bytes32)", "function hasRole(bytes32,address) view returns (bool)",
  "function balanceOf(address) view returns (uint256)", "function mint(address,uint256)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);
const oracleAbi = parseAbi([
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)", "function PRICE_UPDATER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)", "function demoOnly() view returns (bool)",
  "function getPriceBounds(address) view returns (uint128 minimumPriceWad,uint128 maximumPriceWad,uint128 priceWad,uint64 updatedAt)",
  "function setPrice(address,uint128)",
]);
const registryAbi = parseAbi([
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)", "function ISSUER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)", "function demoOnly() view returns (bool)",
  "function getCredential(address,uint256) view returns ((address wallet,bytes32 commitment,address issuer,uint64 issuedAt,uint64 expiresAt,uint64 version,bool revoked))",
  "function recordCredential(address,uint256,bytes32,uint64,uint64) returns (uint64)",
]);
const adapterAbi = parseAbi(["function honkVerifier() view returns (address)"]);
const governanceAbi = parseAbi([
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)", "function PAUSER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)", "function paused() view returns (bool)",
  "function demoOnly() view returns (bool)", "function credentialRegistry() view returns (address)",
]);
const accessControlEventsAbi = parseAbi([
  "event RoleGranted(bytes32 indexed role,address indexed account,address indexed sender)",
  "event RoleRevoked(bytes32 indexed role,address indexed account,address indexed sender)",
]);
const accessControlRoleEventTopics = [
  keccak256(new TextEncoder().encode("RoleGranted(bytes32,address,address)")),
  keccak256(new TextEncoder().encode("RoleRevoked(bytes32,address,address)")),
];
const eventsAbi = parseAbi(["event Transfer(address indexed from,address indexed to,uint256 value)"]);

export function buildDemoParticipantRoleLogFilter(role, fromBlock, toBlock) {
  const start = BigInt(fromBlock), end = BigInt(toBlock);
  assert.ok(start >= 0n && end >= start, "Demo participant log range must be non-negative and ordered.");
  assert.match(role, /^0x[0-9a-fA-F]{64}$/, "Demo participant role must be a bytes32 value.");
  return {
    address: contracts.lendingPool,
    fromBlock: `0x${start.toString(16)}`,
    toBlock: `0x${end.toString(16)}`,
    topics: [accessControlRoleEventTopics, role],
  };
}

export function decodeDemoParticipantRoleLog(log) {
  const decoded = decodeEventLog({ abi: accessControlEventsAbi, data: log.data, topics: log.topics });
  assert.ok(decoded.eventName === "RoleGranted" || decoded.eventName === "RoleRevoked", "Unexpected participant role history event.");
  return {
    eventName: decoded.eventName,
    args: { account: getAddress(decoded.args.account).toLowerCase() },
    blockNumber: BigInt(log.blockNumber),
    logIndex: BigInt(log.logIndex ?? 0),
  };
}

export function isSplittableRangeError(error) {
  const seen = new Set();
  const messages = [];
  let current = error;
  while (current && typeof current === "object" && !seen.has(current) && messages.length < 12) {
    seen.add(current);
    messages.push(current.shortMessage, current.message, current.details);
    current = current.cause ?? current.error;
  }
  return /block range|too many results|result limit|response size|query returned|exceeds.*limit|maximum.*blocks/i.test(messages.filter(Boolean).join(" | "));
}

export function getMainnetLogBlockLimit(rpcUrl) {
  const host = new URL(rpcUrl).hostname;
  return host === "rpc.mainnet.chain.robinhood.com" ? ROBINHOOD_PRIMARY_LOG_BLOCKS_PER_QUERY : MAX_LOG_BLOCKS_PER_QUERY;
}

export function* getBoundedLogRanges(fromBlock, toBlock, maxBlocks = MAX_LOG_BLOCKS_PER_QUERY) {
  const start = BigInt(fromBlock);
  const end = BigInt(toBlock);
  const limit = BigInt(maxBlocks);
  assert.ok(start >= 0n && end >= start, "Historical log range must be non-negative and ordered.");
  assert.ok(limit > 0n && limit <= ROBINHOOD_PRIMARY_LOG_BLOCKS_PER_QUERY, "Historical log query size must remain within the reviewed 20000-block bound.");
  for (let from = start; from <= end; from += limit) {
    const to = from + limit - 1n > end ? end : from + limit - 1n;
    yield [from, to];
  }
}

export function buildParticipantRoleLogBatch(role, ranges, firstQueryIndex = 0) {
  assert.ok(Array.isArray(ranges) && ranges.length > 0 && ranges.length <= ROLE_LOG_BATCH_SIZE,
    `Participant role log batches must contain 1–${ROLE_LOG_BATCH_SIZE} ranges.`);
  return ranges.map(([fromBlock, toBlock], index) => ({
    jsonrpc: "2.0",
    id: `participant-role-${firstQueryIndex + index}`,
    method: "eth_getLogs",
    params: [buildDemoParticipantRoleLogFilter(role, fromBlock, toBlock)],
  }));
}

export function assertPriceWithinBounds(price, minimum, maximum) {
  const value = BigInt(price), low = BigInt(minimum), high = BigInt(maximum);
  assert.ok(value > 0n && low > 0n && high >= low && value >= low && value <= high, "Price must be a positive WAD value inside the on-chain synthetic bounds.");
}

export function assertDistinctParticipants(values) {
  const normalized = values.map((value) => getAddress(value).toLowerCase());
  assert.equal(new Set(normalized).size, normalized.length, "The Mainnet demo participant addresses must be distinct.");
}

export function assertExactDemoParticipants(actual, expected) {
  const normalize = (items) => [...items].map((value) => getAddress(value).toLowerCase()).sort();
  assert.deepEqual(normalize(actual), normalize(expected), "The pool's current DEMO_PARTICIPANT_ROLE holders differ from the two configured participants.");
}

export function classifyDemoParticipantMigration(actual, { previousParticipantA, participantA, participantB }) {
  const normalize = (items) => [...items].map((value) => getAddress(value).toLowerCase()).sort();
  const current = normalize(actual);
  const target = normalize([participantA, participantB]);
  if (!previousParticipantA) {
    assert.deepEqual(current, target, "The pool's current DEMO_PARTICIPANT_ROLE holders differ from the two configured participants.");
    return "complete";
  }
  const previous = getAddress(previousParticipantA).toLowerCase();
  assert.notEqual(previous, getAddress(participantA).toLowerCase(), "Previous and replacement Wallet A must differ.");
  assert.notEqual(previous, getAddress(participantB).toLowerCase(), "Previous Wallet A must differ from Wallet B.");
  const legacy = normalize([previousParticipantA, participantB]);
  const revoked = normalize([participantB]);
  if (JSON.stringify(current) === JSON.stringify(legacy)) return "awaiting-revocation";
  if (JSON.stringify(current) === JSON.stringify(revoked)) return "awaiting-grant";
  if (JSON.stringify(current) === JSON.stringify(target)) return "complete";
  throw new Error("The live participant-role history is outside the explicitly allowed Wallet A migration states.");
}

export function credentialIsActive(record, now) {
  return record.wallet !== zeroAddress && !record.revoked && record.issuedAt <= BigInt(now) && record.expiresAt > BigInt(now);
}

function tupleValue(value, name, index) {
  const result = Array.isArray(value) ? value[index] : value?.[name];
  assert.notEqual(result, undefined, `RPC tuple is missing ${name} at index ${index}.`);
  return result;
}

export function normalizePriceBounds(value) {
  return {
    minimumPriceWad: BigInt(tupleValue(value, "minimumPriceWad", 0)),
    maximumPriceWad: BigInt(tupleValue(value, "maximumPriceWad", 1)),
    priceWad: BigInt(tupleValue(value, "priceWad", 2)),
    updatedAt: BigInt(tupleValue(value, "updatedAt", 3)),
  };
}

const reserveConfigFields = [
  "supplyCap", "borrowCap", "collateralCap", "minBorrowAmount", "maxOracleAge", "maxLtvBps",
  "liquidationThresholdBps", "liquidationBonusBps", "closeFactorBps", "reserveFactorBps",
  "optimalUtilizationBps", "baseBorrowRateBps", "slope1Bps", "slope2Bps", "active",
  "supplyEnabled", "borrowEnabled", "collateralEnabled",
];

export function normalizeReserveConfig(value) {
  return Object.fromEntries(reserveConfigFields.map((name, index) => {
    const field = tupleValue(value, name, index);
    if (index < 14) return [name, BigInt(field)];
    assert.equal(typeof field, "boolean", `RPC tuple field ${name} is not a boolean.`);
    return [name, field];
  }));
}

export function assertSafeDemoReserveConfig(config, label) {
  assert.ok(config.active && config.maxOracleAge > 0n, `${label} reserve must be active with a positive oracle freshness limit.`);
  assert.ok(config.maxLtvBps > 0n && config.maxLtvBps < config.liquidationThresholdBps && config.liquidationThresholdBps <= 10_000n,
    `${label} reserve LTV must remain below a valid liquidation threshold.`);
  assert.ok(config.liquidationBonusBps < 10_000n && config.closeFactorBps > 0n && config.closeFactorBps <= 10_000n,
    `${label} reserve liquidation parameters exceed safe basis-point bounds.`);
  assert.ok(config.reserveFactorBps <= 10_000n && config.optimalUtilizationBps <= 10_000n,
    `${label} reserve factor or utilization exceeds 100%.`);
  if (label === "loan") {
    assert.ok(config.supplyEnabled && config.borrowEnabled && config.supplyCap > 0n && config.borrowCap > 0n,
      "Loan reserve must have positive supply/borrow caps and enabled supply and borrowing.");
  } else {
    assert.ok(config.collateralEnabled && config.collateralCap > 0n, "Collateral reserve must be enabled with a positive collateral cap.");
  }
  return config;
}

export function assertFreshSyntheticPrice({ price, updatedAt, now, maxAge }) {
  const value = BigInt(price), updated = BigInt(updatedAt), timestamp = BigInt(now), ageLimit = BigInt(maxAge);
  assert.ok(value > 0n && updated > 0n, "Synthetic oracle price is not seeded.");
  assert.ok(updated <= timestamp, "Synthetic oracle update timestamp is in the future.");
  assert.ok(ageLimit > 0n && timestamp - updated <= ageLimit, "Synthetic oracle price is stale for this reserve.");
}

export function syntheticPriceIsFresh({ price, updatedAt, now, maxAge }) {
  const value = BigInt(price), updated = BigInt(updatedAt), timestamp = BigInt(now), ageLimit = BigInt(maxAge);
  return value > 0n && updated > 0n && updated <= timestamp && ageLimit > 0n && timestamp - updated <= ageLimit;
}

export function shouldSkipOraclePriceWrite({ currentPrice, updatedAt, requestedPrice, now, maxAge }) {
  return BigInt(currentPrice) === BigInt(requestedPrice) &&
    syntheticPriceIsFresh({ price: currentPrice, updatedAt, now, maxAge });
}

export function assertMainnetActivationPrerequisites({ paused, credentialA, credentialB, now, loanPrice, collateralPrice, loanMaxAge, collateralMaxAge, loanBalanceA, loanBalanceB, collateralBalanceA, collateralBalanceB }) {
  assert.equal(paused, true, "Lending is already active; refusing a duplicate unpause request.");
  assert.ok(credentialIsActive(credentialA, now) && credentialIsActive(credentialB, now), "Both allowlisted participants need active project Policy 3 credentials before Lending activation.");
  assertFreshSyntheticPrice({ ...loanPrice, now, maxAge: loanMaxAge });
  assertFreshSyntheticPrice({ ...collateralPrice, now, maxAge: collateralMaxAge });
  for (const [label, balance] of [["Wallet A loan token", loanBalanceA], ["Wallet B loan token", loanBalanceB], ["Wallet A collateral token", collateralBalanceA], ["Wallet B collateral token", collateralBalanceB]]) {
    assert.ok(BigInt(balance) > 0n, `${label} must have its explicitly approved synthetic token allocation before activation.`);
  }
}

export function assertWriteAuthorization(options, expected) {
  assert.equal(options.authorization, expected, `Execution requires --authorize-mainnet-lending-write=${expected}.`);
}

export function assertNoPendingSignerTransaction(latestNonce, pendingNonce) {
  const latest = BigInt(latestNonce), pending = BigInt(pendingNonce);
  assert.equal(pending, latest,
    `Signer has an unresolved pending Mainnet transaction (latest nonce ${latest}, pending nonce ${pending}); inspect its hash and on-chain state before another submission.`);
}

export function assertCanonicalOperatorWrite({ hash, actor, target, data, receipt, transaction }) {
  assert.equal(receipt.status, "success", `Mainnet transaction receipt failed: ${hash}`);
  assert.equal(normalizedHash(receipt.transactionHash), hash.toLowerCase(), "Canonical receipt hash differs from the submitted transaction.");
  assert.equal(normalizedHash(transaction.hash), hash.toLowerCase(), "Canonical transaction hash differs from the submitted transaction.");
  assert.equal(transaction.chainId, CHAIN_ID, `Transaction is not on Robinhood Mainnet chain ${CHAIN_ID}.`);
  assert.equal(getAddress(transaction.from).toLowerCase(), getAddress(actor).toLowerCase(), "Canonical transaction sender differs from the authorized role address.");
  assert.equal(getAddress(transaction.to).toLowerCase(), getAddress(target).toLowerCase(), "Canonical transaction target differs from the simulated contract.");
  assert.equal(normalizedHash(transaction.input), data.toLowerCase(), "Canonical transaction calldata differs from the simulated operation.");
}

function envAddress(name) {
  const value = process.env[name]?.trim();
  assert.ok(value && isAddress(value), `${name} is missing or invalid.`);
  return getAddress(value);
}

async function rpc(requiredCapabilities = ["read", "simulation", "logs", "receipt"]) {
  return createVerifiedMainnetClient({
    primaryUrl: process.env.RH_MAINNET_RPC_URL,
    fallbackUrl: process.env.RH_MAINNET_RPC_FALLBACK_URL,
    fallbackApiKey: process.env.RH_MAINNET_RPC_FALLBACK_API_KEY || process.env.BLOCKVECTRA_API_KEY,
    requiredCapabilities,
  });
}

function roles() {
  const participantA = envAddress("RH_MAINNET_DEMO_PARTICIPANT_A_ADDRESS");
  const participantB = envAddress("RH_MAINNET_DEMO_PARTICIPANT_B_ADDRESS");
  const result = {
    deployer: envAddress("RH_MAINNET_DEPLOYER_ADDRESS"), admin: envAddress("RH_MAINNET_ADMIN_ADDRESS"),
    issuer: envAddress("RH_MAINNET_ISSUER_ADDRESS"), oracleUpdater: envAddress("RH_MAINNET_ORACLE_UPDATER_ADDRESS"),
    riskAdmin: envAddress("RH_MAINNET_RISK_ADMIN_ADDRESS"), pauseAuthority: envAddress("RH_MAINNET_PAUSE_AUTHORITY_ADDRESS"),
    minter: envAddress("RH_MAINNET_DEMO_MINTER_ADDRESS"), participantA, participantB,
  };
  assertDistinctParticipants(Object.values(result));
  const previousText = process.env.RH_MAINNET_DEMO_PREVIOUS_PARTICIPANT_A_ADDRESS?.trim();
  if (previousText) {
    assert.ok(isAddress(previousText), "RH_MAINNET_DEMO_PREVIOUS_PARTICIPANT_A_ADDRESS is invalid.");
    result.previousParticipantA = getAddress(previousText);
    assertDistinctParticipants([...Object.values(result).filter(Boolean)]);
  } else {
    result.previousParticipantA = undefined;
  }
  return result;
}

function normalizedHash(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function artifactReceiptFrom(file, name, address, chainId = CHAIN_ID) {
  assert.equal(BigInt(file.chain), BigInt(chainId), `Mainnet deployment artifact is not chain ${chainId}.`);
  const expectedAddress = getAddress(address);
  const candidates = (file.transactions ?? []).filter((tx) => {
    const create = /^(CREATE|CREATE2)$/i.test(String(tx.transactionType ?? ""));
    return create && normalizedHash(tx.contractAddress) === expectedAddress.toLowerCase();
  });
  assert.equal(candidates.length, 1, `${name} must have exactly one CREATE transaction for configured address ${expectedAddress}; found ${candidates.length}.`);
  const tx = candidates[0];
  const hash = tx.hash ?? tx.transactionHash ?? tx.transaction?.hash;
  assert.match(hash ?? "", /^0x[0-9a-fA-F]{64}$/, `${name} CREATE transaction has no valid transaction hash.`);
  const receipt = (file.receipts ?? []).find((item) => normalizedHash(item.transactionHash ?? item.hash) === hash.toLowerCase());
  assert.ok(receipt, `${name} has no receipt matching CREATE transaction ${hash}.`);
  assert.ok(["0x1", "1", 1, 1n].includes(receipt.status), `${name} artifact receipt ${hash} did not succeed.`);
  assert.equal(normalizedHash(receipt.contractAddress), expectedAddress.toLowerCase(), `${name} receipt address does not match configured address.`);
  assert.equal(normalizedHash(tx.contractAddress), expectedAddress.toLowerCase(), `${name} CREATE address does not match configured address.`);
  assert.ok(/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(String(receipt.blockNumber ?? "")), `${name} receipt has no valid block number.`);
  const artifactSender = tx.from ?? tx.transaction?.from ?? receipt.from ?? null;
  const nestedChainId = tx.transaction?.chainId;
  if (nestedChainId !== undefined && nestedChainId !== null) {
    assert.equal(BigInt(nestedChainId), BigInt(chainId), `${name} recorded transaction is not bound to chain ${chainId}.`);
  }
  return {
    name,
    hash,
    block: BigInt(receipt.blockNumber),
    address: expectedAddress,
    artifactSender: artifactSender ? getAddress(artifactSender) : null,
    artifactInput: tx.transaction?.input ?? tx.input ?? null,
  };
}

function artifactReceipt(name, address) {
  assert.ok(fs.existsSync(ARTIFACT), "Missing Mainnet deployment artifact: contracts/broadcast/DeployRobinhoodMainnetDemoStack.s.sol/4663/run-latest.json");
  const file = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  return artifactReceiptFrom(file, name, address);
}

export function assertCanonicalDeploymentEvidence({ item, receipt, transaction, block, deployer }) {
  const expectedDeployer = getAddress(deployer);
  assert.equal(receipt.status, "success", `${item.name} canonical Mainnet receipt is not successful: ${item.hash}`);
  assert.equal(normalizedHash(receipt.transactionHash), item.hash.toLowerCase(), `${item.name} canonical receipt hash differs from deployment artifact.`);
  assert.equal(normalizedHash(receipt.contractAddress), item.address.toLowerCase(), `${item.name} canonical receipt address differs from configured registry.`);
  assert.equal(receipt.blockNumber, item.block, `${item.name} canonical receipt block differs from deployment artifact.`);
  assert.equal(normalizedHash(transaction.hash), item.hash.toLowerCase(), `${item.name} canonical transaction hash differs from deployment artifact.`);
  assert.equal(transaction.chainId, CHAIN_ID, `${item.name} canonical transaction is not on chain ${CHAIN_ID}.`);
  assert.equal(transaction.to, null, `${item.name} recorded transaction is not a contract creation.`);
  assert.equal(getAddress(transaction.from), expectedDeployer, `${item.name} canonical RPC sender does not match configured Mainnet deployer.`);
  if (item.artifactSender) {
    assert.equal(item.artifactSender, expectedDeployer, `${item.name} artifact sender does not match configured Mainnet deployer.`);
  }
  if (item.artifactInput) {
    assert.equal(normalizedHash(transaction.input), normalizedHash(item.artifactInput), `${item.name} canonical transaction input differs from deployment artifact.`);
  }
  assert.ok(receipt.blockHash && normalizedHash(block.hash) === normalizedHash(receipt.blockHash), `${item.name} receipt block is not canonical at its recorded height.`);
  assert.equal(BigInt(block.number), item.block, `${item.name} receipt block hash resolves to a different block height.`);
  assert.equal(normalizedHash(transaction.blockHash), normalizedHash(receipt.blockHash), `${item.name} transaction and receipt blocks differ.`);
}

async function confirmedCode(client, item, deployer) {
  const [receipt, transaction] = await Promise.all([
    client.getTransactionReceipt({ hash: item.hash }),
    client.getTransaction({ hash: item.hash }),
  ]);
  // Mainnet RPC providers may prune old block-number lookups while retaining receipts
  // and block-by-hash evidence. Resolve the receipt's own hash and verify its height.
  const block = await client.getBlock({ blockHash: receipt.blockHash });
  assertCanonicalDeploymentEvidence({ item, receipt, transaction, block, deployer });
  const code = await client.getBytecode({ address: item.address });
  assert.ok(code && code !== "0x", `Runtime bytecode is absent at ${item.address}.`);
}

async function getContext(requiredCapabilities) {
  const { selected, client } = await rpc(requiredCapabilities);
  assert.equal(await client.getChainId(), CHAIN_ID, "Configured RPC is not Robinhood Mainnet chain 4663.");
  const configuredRoles = roles();
  const entries = {
    registry: artifactReceipt("RobinhoodMainnetDemoCredentialRegistry", contracts.credentialRegistry),
    oracle: artifactReceipt("RobinhoodMainnetDemoOracle", contracts.oracle),
    loan: artifactReceipt("RobinhoodMainnetDemoToken", contracts.loanToken),
    collateral: artifactReceipt("RobinhoodMainnetDemoToken", contracts.collateralToken),
    pool: artifactReceipt("RobinhoodMainnetDemoLendingPool", contracts.lendingPool),
    adapter: artifactReceipt("EligibilityVerifierAdapter", contracts.verifierAdapter),
    verifier: artifactReceipt("HonkVerifier", contracts.honkVerifier),
    transcript: artifactReceipt("ZKTranscriptLib", contracts.zkTranscriptLib),
    relations: artifactReceipt("RelationsLib", contracts.relationsLib),
    governance: artifactReceipt("RobinhoodMainnetDemoGovernancePhase1", contracts.governance),
  };
  await Promise.all(Object.values(entries).map((item) => confirmedCode(client, item, configuredRoles.deployer)));
  const [poolRegistry, verifier, oracle, loan, collateral, poolDemo, registryDemo, oracleDemo, loanDemo, collDemo, loanMarker, collMarker, honk] = await Promise.all([
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "credentialRegistry" }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "eligibilityVerifier" }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "priceOracle" }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "demoLoanAsset" }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "demoCollateralAsset" }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "demoOnly" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "controlledDemoAssetMarker" }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "controlledDemoAssetMarker" }),
    client.readContract({ address: contracts.verifierAdapter, abi: adapterAbi, functionName: "honkVerifier" }),
  ]);
  assert.equal(poolRegistry.toLowerCase(), contracts.credentialRegistry.toLowerCase(), "Pool credential registry dependency mismatch.");
  assert.equal(verifier.toLowerCase(), contracts.verifierAdapter.toLowerCase(), "Pool verifier dependency mismatch.");
  assert.equal(oracle.toLowerCase(), contracts.oracle.toLowerCase(), "Pool oracle dependency mismatch.");
  assert.equal(loan.toLowerCase(), contracts.loanToken.toLowerCase(), "Pool loan token dependency mismatch.");
  assert.equal(collateral.toLowerCase(), contracts.collateralToken.toLowerCase(), "Pool collateral token dependency mismatch.");
  assert.equal(honk.toLowerCase(), contracts.honkVerifier.toLowerCase(), "Verifier adapter Honk dependency mismatch.");
  const [governanceRegistry, governanceDemo] = await Promise.all([
    client.readContract({ address: contracts.governance, abi: governanceAbi, functionName: "credentialRegistry" }),
    client.readContract({ address: contracts.governance, abi: governanceAbi, functionName: "demoOnly" }),
  ]);
  assert.equal(governanceRegistry.toLowerCase(), contracts.credentialRegistry.toLowerCase(), "Governance credential registry dependency mismatch.");
  assert.ok(poolDemo && registryDemo && oracleDemo && loanDemo && collDemo, "One or more Mainnet components lack demoOnly marker.");
  assert.ok(governanceDemo, "Mainnet governance lacks its demoOnly marker.");
  assert.equal(loanMarker.toLowerCase(), EXPECTED_MARKER.toLowerCase(), "Loan token demo marker mismatch.");
  assert.equal(collMarker.toLowerCase(), EXPECTED_MARKER.toLowerCase(), "Collateral token demo marker mismatch.");
  return { client, url: selected.url, rpcLabel: selected.label, rpcCapabilities: selected.capabilities, roles: configuredRoles, entries };
}

async function hasRole(client, target, abi, roleFunction, account) {
  const role = await client.readContract({ address: target, abi, functionName: roleFunction });
  return client.readContract({ address: target, abi, functionName: "hasRole", args: [role, account] });
}

async function readDemoParticipantHolders(ctx) {
  const role = await ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "DEMO_PARTICIPANT_ROLE" });
  const head = await ctx.client.getBlockNumber();
  const events = [];
  let queryCount = 0;
  async function readEventRange(fromBlock, toBlock) {
    queryCount += 1;
    assert.ok(queryCount <= 8192, "Demo participant role history exceeded its bounded 8192-query budget.");
    try {
      const logs = await ctx.client.request({
        method: "eth_getLogs",
        params: [buildDemoParticipantRoleLogFilter(role, fromBlock, toBlock)],
      });
      assert.ok(Array.isArray(logs), "Mainnet RPC returned a malformed participant role log result.");
      return logs.map(decodeDemoParticipantRoleLog);
    } catch (error) {
      if (!isSplittableRangeError(error) || fromBlock >= toBlock) throw error;
      const middle = fromBlock + (toBlock - fromBlock) / 2n;
      return [...await readEventRange(fromBlock, middle), ...await readEventRange(middle + 1n, toBlock)];
    }
  }
  const maxLogBlocks = getMainnetLogBlockLimit(ctx.url);
  const ranges = [...getBoundedLogRanges(ctx.entries.pool.block, head, maxLogBlocks)];
  const endpoint = ctx.rpcLabel === "fallback"
    ? getMainnetRpcCandidates().find((candidate) => candidate.label === ctx.rpcLabel && candidate.url === ctx.url)
    : undefined;
  const canBatchRoleLogs = endpoint && new URL(endpoint.url).hostname.toLowerCase() === "api.blockvectra.com";
  if (canBatchRoleLogs) {
    let nextRequestAt = 0;
    let offset = 0;
    let batchSize = ROLE_LOG_BATCH_SIZE;
    let rateLimitRetries = 0;
    while (offset < ranges.length) {
      const batchRanges = ranges.slice(offset, offset + batchSize);
      const delay = Math.max(0, nextRequestAt - Date.now());
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const requests = buildParticipantRoleLogBatch(role, batchRanges, offset);
      let responses;
      try {
        responses = await requestMainnetRpcReadBatch(endpoint, requests, { retryDelayMs: ROLE_LOG_BATCH_INTERVAL_MS });
      } catch (error) {
        if ((error?.httpStatus !== 429 && error?.rpcCode !== -32005) || rateLimitRetries >= 3) throw error;
        rateLimitRetries += 1;
        if (batchSize > 1) batchSize = 1;
        else nextRequestAt = Date.now() + ROLE_LOG_BATCH_INTERVAL_MS * (2 ** rateLimitRetries);
        console.log(`Mainnet RPC rate limit · reducing role-log batch to ${batchSize} and retrying within a bounded backoff.`);
        continue;
      }
      queryCount += batchRanges.length;
      assert.ok(queryCount <= 8192, "Demo participant role history exceeded its bounded 8192-query budget.");
      nextRequestAt = Date.now() + ROLE_LOG_BATCH_INTERVAL_MS;
      for (let index = 0; index < responses.length; index += 1) {
        const response = responses[index];
        const [from, to] = batchRanges[index];
        if (response.error) {
          const error = Object.assign(new Error(String(response.error.message ?? "Mainnet role log query failed.")), { code: response.error.code });
          if (!isSplittableRangeError(error) || from >= to) throw error;
          events.push(...await readEventRange(from, to));
          continue;
        }
        assert.ok(Array.isArray(response.result), "Mainnet RPC returned a malformed participant role log batch result.");
        events.push(...response.result.map(decodeDemoParticipantRoleLog));
      }
      if (queryCount % 1_000 < batchRanges.length || offset + batchRanges.length === ranges.length) {
        console.log(`Participant role history · ${queryCount.toLocaleString()} / ${ranges.length.toLocaleString()} bounded RPC queries.`);
      }
      offset += batchRanges.length;
      rateLimitRetries = 0;
    }
  } else {
    for (const [from, to] of ranges) {
      events.push(...await readEventRange(from, to));
    }
  }
  events.sort((a, b) => a.blockNumber === b.blockNumber
    ? Number(a.logIndex ?? 0n) - Number(b.logIndex ?? 0n)
    : a.blockNumber < b.blockNumber ? -1 : 1);
  const holders = new Set();
  for (const event of events) {
    const account = event.args.account.toLowerCase();
    if (event.eventName === "RoleGranted") holders.add(account);
    else holders.delete(account);
  }
  return { holders: [...holders], head, queryCount };
}

async function showStatus(ctx) {
  const { client, roles: r } = ctx;
  const participantHistory = ctx.rpcCapabilities.logs ? await readDemoParticipantHolders(ctx) : undefined;
  const migrationState = participantHistory
    ? classifyDemoParticipantMigration(participantHistory.holders, r)
    : "history-unavailable";
  const [paused, governancePaused, assets, loanSupply, loanCap, loanDecimals, loanSymbol, collSupply, collCap, collDecimals, collSymbol,
    loanPoolBalance, collateralPoolBalance, loanBounds, collBounds, loanConfig, collConfig, adminPool, riskAdmin, pauser, participantA, participantB,
    registryAdmin, issuer, oracleAdmin, updater, minterLoan, minterColl, governanceAdmin, governancePauser,
    credentialA, credentialB, now] = await Promise.all([
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "paused" }),
    client.readContract({ address: contracts.governance, abi: governanceAbi, functionName: "paused" }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "getReserveAssets" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "totalSupply" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "mintCap" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "decimals" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "symbol" }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "totalSupply" }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "mintCap" }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "decimals" }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "symbol" }),
    client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "balanceOf", args: [contracts.lendingPool] }),
    client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "balanceOf", args: [contracts.lendingPool] }),
    client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [contracts.loanToken] }),
    client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [contracts.collateralToken] }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "getReserveConfig", args: [contracts.loanToken] }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "getReserveConfig", args: [contracts.collateralToken] }),
    hasRole(client, contracts.lendingPool, poolAbi, "DEFAULT_ADMIN_ROLE", r.admin),
    hasRole(client, contracts.lendingPool, poolAbi, "RISK_ADMIN_ROLE", r.riskAdmin),
    hasRole(client, contracts.lendingPool, poolAbi, "PAUSER_ROLE", r.pauseAuthority),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [r.participantA] }),
    client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [r.participantB] }),
    hasRole(client, contracts.credentialRegistry, registryAbi, "DEFAULT_ADMIN_ROLE", r.admin),
    hasRole(client, contracts.credentialRegistry, registryAbi, "ISSUER_ROLE", r.issuer),
    hasRole(client, contracts.oracle, oracleAbi, "DEFAULT_ADMIN_ROLE", r.admin),
    hasRole(client, contracts.oracle, oracleAbi, "PRICE_UPDATER_ROLE", r.oracleUpdater),
    hasRole(client, contracts.loanToken, tokenAbi, "MINTER_ROLE", r.minter),
    hasRole(client, contracts.collateralToken, tokenAbi, "MINTER_ROLE", r.minter),
    hasRole(client, contracts.governance, governanceAbi, "DEFAULT_ADMIN_ROLE", r.admin),
    hasRole(client, contracts.governance, governanceAbi, "PAUSER_ROLE", r.pauseAuthority),
    client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [r.participantA, POLICY_ID] }),
    client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [r.participantB, POLICY_ID] }),
    client.getBlock({ blockTag: "latest" }),
  ]);
  const loanPriceState = normalizePriceBounds(loanBounds);
  const collateralPriceState = normalizePriceBounds(collBounds);
  const loanReserveState = normalizeReserveConfig(loanConfig);
  const collateralReserveState = normalizeReserveConfig(collConfig);
  assertSafeDemoReserveConfig(loanReserveState, "loan");
  assertSafeDemoReserveConfig(collateralReserveState, "collateral");
  assert.equal(assets.length, 2, "Pool must contain exactly the two controlled demo reserves.");
  assert.ok(assets.some((asset) => asset.toLowerCase() === contracts.loanToken.toLowerCase()) && assets.some((asset) => asset.toLowerCase() === contracts.collateralToken.toLowerCase()), "Pool reserves do not match the receipt-derived Mainnet synthetic token pair.");
  const roleRows = [adminPool, riskAdmin, pauser, registryAdmin, issuer, oracleAdmin, updater, minterLoan, minterColl, governanceAdmin, governancePauser];
  assert.ok(roleRows.every(Boolean), "One or more configured operator addresses do not hold their expected on-chain role.");
  const previousParticipant = r.previousParticipantA
    ? await client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [r.previousParticipantA] })
    : false;
  if (participantHistory) {
    assert.equal(participantA, migrationState === "complete", "Replacement Wallet A live role read differs from canonical role history.");
  } else {
    assert.equal(participantA, true, "Configured Wallet A is not currently allowlisted.");
  }
  assert.equal(participantB, true, "Wallet B must retain its on-chain DEMO_PARTICIPANT_ROLE throughout migration.");
  if (participantHistory) {
    assert.equal(previousParticipant, migrationState === "awaiting-revocation", "Previous Wallet A live role read differs from canonical role history.");
  }
  for (const [label, token, supply, cap, decimals, symbol] of [
    ["Loan", contracts.loanToken, loanSupply, loanCap, loanDecimals, loanSymbol],
    ["Collateral", contracts.collateralToken, collSupply, collCap, collDecimals, collSymbol],
  ]) {
    assert.ok(supply <= cap, `${label} token supply exceeds its immutable mint cap.`);
    console.log(`${label} ${symbol} · ${decimals} decimals · supply ${supply}/${cap} base units`);
  }
  console.log(`Robinhood Mainnet ${CHAIN_ID} · RPC ${ctx.rpcLabel} · capabilities ${Object.entries(ctx.rpcCapabilities).filter(([, ok]) => ok).map(([name]) => name).join("/")} · live block ${now.number} · pool ${contracts.lendingPool} · ${paused ? "PAUSED" : "ACTIVE"} · Phase 1 Governance ${governancePaused ? "PAUSED" : "ACTIVE"}`);
  console.log(`Receipts and bytecode: 10/10 live-checked · dependencies and demo markers verified · no Testnet address fallback.`);
  console.log(`Participants: A ${r.participantA} ${participantA ? "ALLOWLISTED" : "PENDING ROLE CHANGE"} · B ${r.participantB} ${participantB ? "ALLOWLISTED" : "BLOCKED"}`);
  if (r.previousParticipantA) console.log(`Wallet A migration: ${migrationState} · prior address ${r.previousParticipantA} ${previousParticipant ? "still allowlisted" : "revoked"}.`);
  if (participantHistory) {
    console.log(`Complete participant-role history: migration state ${migrationState} through block ${participantHistory.head} · ${participantHistory.queryCount} bounded queries.`);
  } else {
    console.log("PARTIAL STATUS: current Wallet A/Wallet B role reads are live; complete participant-holder history is unavailable because this RPC does not expose eth_getLogs without an API key. No assertion is made that no third participant is allowlisted.");
  }
  console.log(`Roles: admin/pool=${adminPool} risk-admin=${riskAdmin} pause-authority=${pauser} issuer=${issuer} oracle-updater=${updater} minter=${minterLoan && minterColl} governance-admin=${governanceAdmin} governance-pauser=${governancePauser}`);
  const freshness = (price, updatedAt, maxAge) => {
    const value = BigInt(price), updated = BigInt(updatedAt), timestamp = BigInt(now.timestamp), ageLimit = BigInt(maxAge);
    if (value === 0n || updated === 0n) return "UNSEEDED";
    if (updated > timestamp) return "INVALID FUTURE TIMESTAMP";
    const age = timestamp - updated;
    return age > ageLimit ? `STALE (${age}s; max ${ageLimit}s)` : `FRESH (${age}s old)`;
  };
  console.log(`Oracle loan bounds ${loanPriceState.minimumPriceWad}..${loanPriceState.maximumPriceWad} WAD · ${loanPriceState.priceWad === 0n ? "UNSEEDED" : `price ${loanPriceState.priceWad} WAD · ${freshness(loanPriceState.priceWad, loanPriceState.updatedAt, loanReserveState.maxOracleAge)}`}`);
  console.log(`Oracle collateral bounds ${collateralPriceState.minimumPriceWad}..${collateralPriceState.maximumPriceWad} WAD · ${collateralPriceState.priceWad === 0n ? "UNSEEDED" : `price ${collateralPriceState.priceWad} WAD · ${freshness(collateralPriceState.priceWad, collateralPriceState.updatedAt, collateralReserveState.maxOracleAge)}`}`);
  console.log(`Actual pool token balances: loan ${loanPoolBalance} · collateral ${collateralPoolBalance} base units.`);
  console.log(`Loan reserve: active=${loanReserveState.active} supply=${loanReserveState.supplyEnabled} borrow=${loanReserveState.borrowEnabled} caps=${loanReserveState.supplyCap}/${loanReserveState.borrowCap} · collateral reserve: active=${collateralReserveState.active} accepted=${collateralReserveState.collateralEnabled} cap=${collateralReserveState.collateralCap}`);
  for (const [label, config] of [["loan", loanReserveState], ["collateral", collateralReserveState]]) {
    console.log(`${label} risk limits: maxLTV=${config.maxLtvBps}bps · liquidation=${config.liquidationThresholdBps}bps + ${config.liquidationBonusBps}bps bonus · close=${config.closeFactorBps}bps · reserve=${config.reserveFactorBps}bps · maxOracleAge=${config.maxOracleAge}s · minBorrow=${config.minBorrowAmount} base units`);
  }
  for (const [label, credential] of [["A", credentialA], ["B", credentialB]]) {
    const current = credentialIsActive(credential, now.timestamp);
    console.log(`Policy 3 ${label}: ${current ? `credential active · version ${credential.version} · expires ${credential.expiresAt}` : "no active project credential"}`);
  }
  if (paused) console.log("Risk-increasing Lending is paused. This command did not request an oracle write, mint, credential, or unpause.");
}

function participantAddress(value, r) {
  assert.ok(value && isAddress(value), "Provide a valid participant wallet address.");
  const address = getAddress(value);
  assert.ok([r.participantA, r.participantB].some((wallet) => wallet.toLowerCase() === address.toLowerCase()), "Recipient is not one of the two configured Mainnet demo participants.");
  return address;
}

async function getCompleteMintHistory(ctx, token, recipient, fromBlock) {
  let queries = 0;
  async function scan(from, to) {
    queries += 1;
    assert.ok(queries <= 4096, "Mint audit exceeded its bounded 4096-query limit.");
    try {
      return await ctx.client.getLogs({ address: token, event: eventsAbi[0], args: { from: zeroAddress, to: recipient }, fromBlock: from, toBlock: to });
    } catch (error) {
      if (!isSplittableRangeError(error) || from >= to) throw error;
      const middle = from + (to - from) / 2n;
      return [...await scan(from, middle), ...await scan(middle + 1n, to)];
    }
  }
  const head = await ctx.client.getBlockNumber();
  const logs = [];
  const maxLogBlocks = getMainnetLogBlockLimit(ctx.url);
  for (const [from, to] of getBoundedLogRanges(fromBlock, head, maxLogBlocks)) logs.push(...await scan(from, to));
  return { count: logs.length, head, queries };
}

function writePrivate(file, value) {
  const absolute = path.resolve(file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true, mode: 0o700 });
  const fd = fs.openSync(absolute, "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); } finally { fs.closeSync(fd); }
  return absolute;
}

function secureRead(file) {
  const absolute = path.resolve(file);
  const stat = fs.lstatSync(absolute);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), "Witness must be a regular file, not a symlink.");
  assert.equal(stat.mode & 0o077, 0, "Witness file must be private (mode 0600 or stricter).");
  assert.ok(stat.size <= 16_384, "Witness file exceeds the supported size limit.");
  return parseDemoCredentialWitness(JSON.parse(fs.readFileSync(absolute, "utf8")));
}

async function hiddenPrompt(label) {
  assert.ok(process.stdin.isTTY && process.stdin.setRawMode, "Private value input requires a local interactive terminal.");
  process.stdout.write(label);
  return new Promise((resolve, reject) => {
    let value = "";
    const input = process.stdin;
    const finish = (error) => {
      input.setRawMode(false);
      input.pause();
      input.off("data", onData);
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const onData = (buffer) => {
      for (const byte of buffer) {
        if (byte === 3) return finish(new Error("Input cancelled."));
        if (byte === 13 || byte === 10) return finish();
        if (byte === 8 || byte === 127) value = value.slice(0, -1);
        else if (byte >= 48 && byte <= 57 && value.length < 20) value += String.fromCharCode(byte);
      }
    };
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function prepareCredential(ctx, walletText, daysText, output) {
  const wallet = participantAddress(walletText, ctx.roles);
  const days = Number(daysText);
  assert.ok(Number.isInteger(days) && days >= 1 && days <= 90, "Expiry must be 1–90 days.");
  assert.ok(output, "Provide a private witness output path.");
  const participant = await ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [wallet] });
  assert.ok(participant, "Wallet is not an on-chain Mainnet demo participant.");
  const [current, block] = await Promise.all([
    ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [wallet, POLICY_ID] }),
    ctx.client.getBlock({ blockTag: "latest" }),
  ]);
  assert.ok(current.wallet === zeroAddress || current.revoked || current.expiresAt <= block.timestamp, "An active Policy 3 credential already exists; refusing accidental replacement.");
  const privateValue = await hiddenPrompt("Enter the project test eligibility value (input hidden): ");
  assert.ok(/^(0|[1-9][0-9]*)$/.test(privateValue) && BigInt(privateValue) >= THRESHOLD && BigInt(privateValue) <= (1n << 64n) - 1n, "Value must meet Policy 3 and fit uint64.");
  const version = current.wallet === zeroAddress ? 1n : current.version + 1n;
  const expiresAt = block.timestamp + BigInt(days * 86_400);
  const salt = generateFieldSalt();
  const commitment = await computeEligibilityCommitment({ subject: wallet, privateValue, salt, policyId: POLICY_ID, policyVersion: POLICY_VERSION,
    threshold: THRESHOLD, credentialVersion: version, expiresAt, chainId: BigInt(CHAIN_ID), vault: contracts.lendingPool });
  const file = writePrivate(output, { format: "robinhood-demo-credential-v1", wallet, policyId: Number(POLICY_ID), commitment,
    privateValue, salt, expiresAt: Number(expiresAt) });
  console.log(`Prepared private Mainnet Policy 3 witness for ${wallet} · version ${version} · expiry ${expiresAt}.`);
  console.log(`Witness saved mode 0600: ${file}. Private value, salt, and witness content were not printed.`);
  console.log(`Next read-only command: bun run robinhood:mainnet:lending:operator issue-lending ${JSON.stringify(file)}`);
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return await rl.question(question); } finally { rl.close(); }
}

function parseCastRpcResult(stdout, method) {
  const text = String(stdout ?? "").trim();
  assert.ok(text.length > 0, `cast returned an empty result for ${method}.`);
  try { return JSON.parse(text); }
  catch { return text; }
}

function castRpcRead(rpcUrl, method, params = [], rpcLabel = "primary") {
  const args = ["rpc", method, ...params.map((value) => typeof value === "string" ? value : JSON.stringify(value)),
    "--rpc-url", rpcUrl, "--rpc-timeout", "12"];
  const result = spawnMainnetCast(args, rpcUrl, {
    rpcLabel,
    spawnImpl: spawnSync,
    stdio: ["ignore", "pipe", "pipe"],
    spawnOptions: { timeout: 15_000 },
  });
  if (result.error) {
    throw new Error(`Read-only cast RPC ${method} could not start (${result.error.code ?? result.error.name ?? "spawn error"}).`);
  }
  if (result.status !== 0) {
    // Do not forward raw Foundry diagnostics: they can echo provider URLs or headers.
    throw new Error(`Read-only cast RPC ${method} failed with exit code ${result.status ?? "unknown"}; raw provider output was suppressed.`);
  }
  return parseCastRpcResult(result.stdout, method);
}

function validateFoundryRpcPath() {
  const candidates = getMainnetRpcCandidates({
    primaryUrl: process.env.RH_MAINNET_RPC_URL,
    fallbackUrl: process.env.RH_MAINNET_RPC_FALLBACK_URL,
    fallbackApiKey: process.env.RH_MAINNET_RPC_FALLBACK_API_KEY || process.env.BLOCKVECTRA_API_KEY,
  });
  const expectedReceipt = artifactReceipt("RobinhoodMainnetDemoLendingPool", contracts.lendingPool);
  const failures = [];
  for (const candidate of candidates) {
    try {
  const chainId = castRpcRead(candidate.url, "eth_chainId", [], candidate.label);
  assert.equal(Number(BigInt(chainId)), CHAIN_ID, `Foundry cast RPC is not connected to Robinhood Mainnet chain ${CHAIN_ID}.`);

  const feeHistory = castRpcRead(candidate.url, "eth_feeHistory", ["0x2", "latest", [50]], candidate.label);
  assert.ok(feeHistory && Array.isArray(feeHistory.baseFeePerGas) && feeHistory.baseFeePerGas.length >= 2,
    "Foundry cast eth_feeHistory did not return a valid base fee window.");

  const estimateGas = castRpcRead(candidate.url, "eth_estimateGas", [{
    from: "0x0000000000000000000000000000000000000001",
    to: contracts.lendingPool,
    data: encodeFunctionData({ abi: poolAbi, functionName: "paused" }),
  }], candidate.label);
  assert.ok(typeof estimateGas === "string" && /^0x[0-9a-f]+$/i.test(estimateGas) && BigInt(estimateGas) > 0n,
    "Foundry cast eth_estimateGas did not return a positive estimate.");

  const headValue = castRpcRead(candidate.url, "eth_blockNumber", [], candidate.label);
  assert.ok(typeof headValue === "string" && /^0x[0-9a-f]+$/i.test(headValue), "Foundry cast eth_blockNumber returned an invalid chain head.");
  const head = BigInt(headValue);
  const fromBlock = head > 16n ? head - 16n : 0n;
  const logs = castRpcRead(candidate.url, "eth_getLogs", [{
    address: contracts.lendingPool,
    fromBlock: `0x${fromBlock.toString(16)}`,
    toBlock: headValue,
    topics: [accessControlRoleEventTopics],
  }], candidate.label);
  assert.ok(Array.isArray(logs), "Foundry cast eth_getLogs did not return a log array.");

  const receipt = castRpcRead(candidate.url, "eth_getTransactionReceipt", [expectedReceipt.hash], candidate.label);
  assert.equal(receipt?.transactionHash?.toLowerCase(), expectedReceipt.hash.toLowerCase(),
    "Foundry cast receipt query returned a different deployment transaction.");
  assert.equal(receipt?.status, "0x1", "Foundry cast receipt query did not confirm the successful pool deployment receipt.");
  assert.equal(receipt?.contractAddress?.toLowerCase(), contracts.lendingPool.toLowerCase(),
    "Foundry cast receipt query returned a different Lending pool address.");
  console.log(`PASS Foundry cast RPC via ${candidate.label} · chain ${CHAIN_ID} · feeHistory · estimateGas · bounded logs · canonical pool receipt ${expectedReceipt.hash.slice(0, 10)}…`);
  return;
    } catch (error) {
      failures.push(`${candidate.label}: ${error instanceof Error ? error.message : "Foundry RPC capability check failed"}`);
    }
  }
  throw new Error(`No configured endpoint passed Foundry cast Mainnet RPC checks (${failures.join("; ")}).`);
}

async function writeGuarded(ctx, command, actor, target, abi, functionName, args, options, confirm) {
  const request = { account: actor, address: target, abi, functionName, args };
  await ctx.client.simulateContract(request);
  const gas = await ctx.client.estimateContractGas(request);
  console.log(`PASS read-only simulation: ${functionName} · chain ${CHAIN_ID} · estimated gas ${gas}.`);
  if (!options.execute) return console.log("Simulation only. No Mainnet signature or transaction was requested.");
  assertWriteAuthorization(options, AUTH[command]);
  const alias = options.accountAlias ?? process.env.RH_MAINNET_ACCOUNT;
  assert.ok(alias && /^[A-Za-z0-9._-]+$/.test(alias) && process.stdin.isTTY, "Execution needs an interactive terminal and encrypted Foundry keystore alias.");
  const signer = spawnSync("cast", ["wallet", "address", "--account", alias], { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });
  assert.equal(signer.status, 0, "Could not unlock encrypted Foundry keystore to verify its public role address.");
  const derived = signer.stdout.match(/0x[a-fA-F0-9]{40}/g) ?? [];
  assert.ok(derived.some((address) => getAddress(address).toLowerCase() === actor.toLowerCase()), "Encrypted keystore alias does not match the required on-chain role address.");
  const readSignerNonces = async () => Promise.all([
    ctx.client.getTransactionCount({ address: actor, blockTag: "latest" }),
    ctx.client.getTransactionCount({ address: actor, blockTag: "pending" }),
  ]);
  const [latestBefore, pendingBefore] = await readSignerNonces();
  assertNoPendingSignerTransaction(latestBefore, pendingBefore);
  const phrase = `WRITE Robinhood Mainnet ${AUTH[command]}`;
  assert.equal(await prompt(`Type exactly “${phrase}” to sign and submit: `), phrase, "Final typed authorization did not match.");
  const [latestImmediatelyBefore, pendingImmediatelyBefore] = await readSignerNonces();
  assertNoPendingSignerTransaction(latestImmediatelyBefore, pendingImmediatelyBefore);
  assert.equal(pendingImmediatelyBefore, pendingBefore,
    "Signer nonce changed during the confirmation prompt; inspect transaction state before submitting.");
  const data = encodeFunctionData({ abi, functionName, args });
  const child = spawnMainnetCast(["send", "--rpc-url", ctx.url, "--chain", String(CHAIN_ID), "--account", alias, "--async", "--data", data, target], ctx.url, { rpcLabel: ctx.rpcLabel });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  const exit = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  const hash = output.match(/0x[a-fA-F0-9]{64}/)?.[0];
  if (exit !== 0 || !hash) {
    let nonceState;
    try {
      const [latestAfter, pendingAfter] = await readSignerNonces();
      nonceState = `latest/pending nonce ${latestBefore}/${pendingBefore} before, ${latestAfter}/${pendingAfter} after`;
    } catch {
      nonceState = "signer nonce readback is unavailable";
    }
    throw new Error(`cast send returned no confirmed transaction hash (exit ${exit}); submission outcome must be treated as uncertain (${nonceState}). No automatic retry was attempted. Inspect pending transactions, canonical receipts, and contract state before another submission.`);
  }
  assert.ok(hash, "No transaction hash returned.");
  const receipt = await ctx.client.waitForTransactionReceipt({ hash });
  const canonicalTransaction = await ctx.client.getTransaction({ hash });
  assertCanonicalOperatorWrite({ hash, actor, target, data, receipt, transaction: canonicalTransaction });
  let confirmed = false;
  let lastReadError;
  for (const delay of [0, 500, 1500, 3000]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try { confirmed = await confirm(); if (confirmed) break; }
    catch (error) { lastReadError = error; }
  }
  assert.ok(confirmed, `Receipt ${hash} succeeded, but post-state was not confirmed${lastReadError ? ` (${lastReadError.name})` : ""}.`);
  appendConfirmedMainnetCheckpoint({ chainId: CHAIN_ID, workflow: "lending-operator", operation: command,
    actor, target, transactionHash: hash, blockNumber: receipt.blockNumber, postStateConfirmed: true });
  console.log(`CONFIRMED ${hash}\n${EXPLORER}/tx/${hash}`);
}

async function migrateParticipantRole(ctx, action, options) {
  const previous = ctx.roles.previousParticipantA;
  assert.ok(previous, "Set RH_MAINNET_DEMO_PREVIOUS_PARTICIPANT_A_ADDRESS to the old Wallet A before using migration commands.");
  const history = await readDemoParticipantHolders(ctx);
  const state = classifyDemoParticipantMigration(history.holders, ctx.roles);
  const target = action === "revoke" ? previous : ctx.roles.participantA;
  const expectedState = action === "revoke" ? "awaiting-revocation" : "awaiting-grant";
  const nextState = action === "revoke" ? "awaiting-grant" : "complete";
  assert.equal(state, expectedState,
    action === "revoke"
      ? "Old Wallet A may be revoked only from the exact pre-migration holder set {old Wallet A, Wallet B}."
      : "New Wallet A may be granted only after old Wallet A is revoked and the exact holder set is {Wallet B}."
  );
  const participantRole = await ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "DEMO_PARTICIPANT_ROLE" });
  const adminRole = await ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "DEFAULT_ADMIN_ROLE" });
  assert.equal(await ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "hasRole", args: [adminRole, ctx.roles.admin] }), true,
    "Configured administrator does not hold the pool DEFAULT_ADMIN_ROLE.");
  const [oldAllowed, newAllowed, walletBAllowed] = await Promise.all([
    ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [previous] }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [ctx.roles.participantA] }),
    ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [ctx.roles.participantB] }),
  ]);
  assert.equal(oldAllowed, action === "revoke", "Old Wallet A role read does not match the expected migration stage.");
  assert.equal(newAllowed, false, "Replacement Wallet A is already allowlisted; refusing a duplicate grant.");
  assert.equal(walletBAllowed, true, "Wallet B must remain allowlisted during Wallet A migration.");
  const command = action === "revoke" ? "participant-revoke" : "participant-grant";
  const functionName = action === "revoke" ? "revokeRole" : "grantRole";
  return writeGuarded(ctx, command, ctx.roles.admin, contracts.lendingPool, poolAbi, functionName,
    [participantRole, target], options, async () => {
      const after = await readDemoParticipantHolders(ctx);
      return classifyDemoParticipantMigration(after.holders, ctx.roles) === nextState;
    });
}

async function main() {
  const command = process.argv[2] ?? "help";
  const positional = [], options = {};
  for (let i = 3; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === "--execute") options.execute = true;
    else if (arg.startsWith("--authorize-mainnet-lending-write=")) options.authorization = arg.split("=")[1];
    else if (arg === "--account-alias") options.accountAlias = process.argv[++i];
    else if (arg.startsWith("--account-alias=")) options.accountAlias = arg.split("=")[1];
    else positional.push(arg);
  }
  if (["help", "--help"].includes(command)) {
    console.log("Read-only: status | cast-rpc-check | prepare-lending <participant> <expiry-days> <private-witness.json>. Simulated by default: participant-revoke | participant-grant | price loan|collateral <price-wad> | mint loan|collateral <participant> <base-units> | issue-lending <private-witness.json> | unpause-pool.\n\nParticipant replacement is ordered and fail-closed: revoke the previous Wallet A first, then grant the configured replacement only from the exact intermediate holder set {Wallet B}. This never allows a third participant. The interval between transactions has Wallet B as the sole participant. Every write simulates first; execution requires --execute, the matching --authorize-mainnet-lending-write=<label>, an encrypted Foundry keystore alias matching the required role, and an interactive typed confirmation.");
    return;
  }
  if (command === "cast-rpc-check") return validateFoundryRpcPath();
  const requiredCapabilities = command === "status" || (command === "price" && !options.execute)
    ? ["read", "simulation", "receipt"]
    : undefined;
  const ctx = await getContext(requiredCapabilities);
  if (command === "price") {
    const capabilities = Object.entries(ctx.rpcCapabilities).filter(([, ok]) => ok).map(([name]) => name).join("/");
    console.log(`Robinhood Mainnet ${CHAIN_ID} · RPC ${ctx.rpcLabel} · validated capabilities ${capabilities}${ctx.rpcCapabilities.logs ? "" : " · event logs unavailable"}`);
  }
  if (command === "status") return showStatus(ctx);
  if (command === "participant-revoke") return migrateParticipantRole(ctx, "revoke", options);
  if (command === "participant-grant") return migrateParticipantRole(ctx, "grant", options);
  if (command === "prepare-lending") return prepareCredential(ctx, positional[0], positional[1], positional[2]);
  if (command === "price") {
    assert.ok(["loan", "collateral"].includes(positional[0]) && /^\d+$/.test(positional[1] ?? ""), "Use price loan|collateral <price-in-WAD-base-units>.");
    const asset = positional[0] === "loan" ? contracts.loanToken : contracts.collateralToken;
    const price = BigInt(positional[1]);
    const bounds = normalizePriceBounds(await ctx.client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [asset] }));
    assertPriceWithinBounds(price, bounds.minimumPriceWad, bounds.maximumPriceWad);
    const role = await ctx.client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "PRICE_UPDATER_ROLE" });
    const updater = ctx.roles.oracleUpdater;
    assert.equal(await ctx.client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "hasRole", args: [role, updater] }), true, "Configured oracle updater lacks its on-chain role.");
    const before = bounds.priceWad;
    const [latestBlock, reserveRaw] = await Promise.all([
      ctx.client.getBlock({ blockTag: "latest" }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "getReserveConfig", args: [asset] }),
    ]);
    const maxAge = normalizeReserveConfig(reserveRaw).maxOracleAge;
    if (shouldSkipOraclePriceWrite({ currentPrice: before, updatedAt: bounds.updatedAt, requestedPrice: price, now: latestBlock.timestamp, maxAge })) {
      return console.log("SKIPPED — PRICE STILL FRESH · requested synthetic price matches the live oracle value.");
    }
    if (before === price) {
      const age = bounds.updatedAt > 0n && bounds.updatedAt <= latestBlock.timestamp ? latestBlock.timestamp - bounds.updatedAt : undefined;
      console.log(`Refresh required · unchanged price is ${age === undefined ? "invalidly timestamped" : `${age}s old`} · reserve maximum ${maxAge}s.`);
    }
    return writeGuarded(ctx, command, updater, contracts.oracle, oracleAbi, "setPrice", [asset, price], options,
      async () => {
        const after = normalizePriceBounds(await ctx.client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [asset] }));
        const confirmedBlock = await ctx.client.getBlock({ blockTag: "latest" });
        return after.priceWad === price && after.updatedAt > bounds.updatedAt &&
          syntheticPriceIsFresh({ price: after.priceWad, updatedAt: after.updatedAt, now: confirmedBlock.timestamp, maxAge });
      });
  }
  if (command === "mint") {
    assert.ok(["loan", "collateral"].includes(positional[0]) && /^\d+$/.test(positional[2] ?? ""), "Use mint loan|collateral <participant> <amount-in-base-units>.");
    const recipient = participantAddress(positional[1], ctx.roles), amount = BigInt(positional[2]);
    assert.ok(amount > 0n, "Mint amount must be greater than zero.");
    const token = positional[0] === "loan" ? contracts.loanToken : contracts.collateralToken;
    const entry = positional[0] === "loan" ? ctx.entries.loan : ctx.entries.collateral;
    const [supply, cap, balance, maxSingleMint] = await Promise.all([
      ctx.client.readContract({ address: token, abi: tokenAbi, functionName: "totalSupply" }),
      ctx.client.readContract({ address: token, abi: tokenAbi, functionName: "mintCap" }),
      ctx.client.readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [recipient] }),
      Promise.resolve(process.env[positional[0] === "loan" ? "RH_MAINNET_DEMO_SINGLE_MINT_LIMIT_LOAN" : "RH_MAINNET_DEMO_SINGLE_MINT_LIMIT_COLLATERAL"]),
    ]);
    assert.ok(maxSingleMint && /^\d+$/.test(maxSingleMint), `Set the owner-approved ${positional[0] === "loan" ? "RH_MAINNET_DEMO_SINGLE_MINT_LIMIT_LOAN" : "RH_MAINNET_DEMO_SINGLE_MINT_LIMIT_COLLATERAL"} in local configuration before mint simulation.`);
    assert.ok(amount <= BigInt(maxSingleMint), "Mint exceeds the owner-approved single-transaction allocation limit.");
    assert.ok(supply + amount <= cap, "Mint would exceed the immutable total supply cap.");
    assert.equal(balance, 0n, "Recipient already has a token balance; duplicate-safe mint is refused.");
    assert.equal(await ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [recipient] }), true,
      "Synthetic tokens can only be minted to a currently allowlisted Mainnet demo participant.");
    const history = await getCompleteMintHistory(ctx, token, recipient, entry.block);
    assert.equal(history.count, 0, `Recipient has ${history.count} historical mint event(s); refusing duplicate mint.`);
    console.log(`Complete mint-history scan: no prior mint to recipient · ${history.queries} bounded RPC query(ies) · through block ${history.head}.`);
    const minterRole = await ctx.client.readContract({ address: token, abi: tokenAbi, functionName: "MINTER_ROLE" });
    assert.equal(await ctx.client.readContract({ address: token, abi: tokenAbi, functionName: "hasRole", args: [minterRole, ctx.roles.minter] }), true, "Configured minter lacks the on-chain role.");
    return writeGuarded(ctx, command, ctx.roles.minter, token, tokenAbi, "mint", [recipient, amount], options,
      async () => (await ctx.client.readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [recipient] })) === amount);
  }
  if (command === "issue-lending") {
    assert.ok(positional[0], "Use issue-lending <private-policy-3-witness.json>.");
    const witness = secureRead(positional[0]);
    assert.equal(witness.format, "robinhood-demo-credential-v1", "Witness must use the Robinhood project credential format.");
    assert.equal(witness.policyId, Number(POLICY_ID), "Witness must be Policy 3.");
    assert.ok([ctx.roles.participantA, ctx.roles.participantB].some((wallet) => wallet.toLowerCase() === witness.wallet.toLowerCase()), "Witness wallet is not one of the configured demo participants.");
    assert.equal(await ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [witness.wallet] }), true,
      "A Policy 3 credential may only be issued to a currently allowlisted Mainnet demo participant.");
    const [current, block, role] = await Promise.all([
      ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [witness.wallet, POLICY_ID] }),
      ctx.client.getBlock({ blockTag: "latest" }),
      ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "ISSUER_ROLE" }),
    ]);
    assert.ok(!credentialIsActive(current, block.timestamp), "An active Policy 3 credential already exists; refusing duplicate or unapproved replacement.");
    const version = current.wallet === zeroAddress ? 1n : current.version + 1n;
    assert.equal(witness.expiresAt > Number(block.timestamp), true, "Witness is expired or not yet valid.");
    const commitment = await computeEligibilityCommitment({ subject: witness.wallet, privateValue: witness.privateValue, salt: witness.salt,
      policyId: POLICY_ID, policyVersion: POLICY_VERSION, threshold: THRESHOLD, credentialVersion: version,
      expiresAt: BigInt(witness.expiresAt), chainId: BigInt(CHAIN_ID), vault: contracts.lendingPool });
    assert.equal(commitment.toLowerCase(), witness.commitment.toLowerCase(), "Witness commitment does not match the Mainnet chain and Lending pool.");
    assert.equal(await ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "hasRole", args: [role, ctx.roles.issuer] }), true, "Configured issuer lacks the on-chain credential role.");
    const args = [witness.wallet, POLICY_ID, witness.commitment, BigInt(witness.expiresAt), version];
    return writeGuarded(ctx, command, ctx.roles.issuer, contracts.credentialRegistry, registryAbi, "recordCredential", args, options,
      async () => {
        const after = await ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [witness.wallet, POLICY_ID] });
        return after.version === version && after.commitment.toLowerCase() === witness.commitment.toLowerCase() && !after.revoked;
      });
  }
  if (command === "unpause-pool") {
    const r = ctx.roles;
    const participantHistory = await readDemoParticipantHolders(ctx);
    assertExactDemoParticipants(participantHistory.holders, [r.participantA, r.participantB]);
    const [paused, latest, credentialA, credentialB, loanBounds, collateralBounds, loanConfig, collateralConfig,
      loanBalanceA, loanBalanceB, collateralBalanceA, collateralBalanceB, allowedA, allowedB] = await Promise.all([
      ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "paused" }),
      ctx.client.getBlock({ blockTag: "latest" }),
      ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [r.participantA, POLICY_ID] }),
      ctx.client.readContract({ address: contracts.credentialRegistry, abi: registryAbi, functionName: "getCredential", args: [r.participantB, POLICY_ID] }),
      ctx.client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [contracts.loanToken] }),
      ctx.client.readContract({ address: contracts.oracle, abi: oracleAbi, functionName: "getPriceBounds", args: [contracts.collateralToken] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "getReserveConfig", args: [contracts.loanToken] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "getReserveConfig", args: [contracts.collateralToken] }),
      ctx.client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "balanceOf", args: [r.participantA] }),
      ctx.client.readContract({ address: contracts.loanToken, abi: tokenAbi, functionName: "balanceOf", args: [r.participantB] }),
      ctx.client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "balanceOf", args: [r.participantA] }),
      ctx.client.readContract({ address: contracts.collateralToken, abi: tokenAbi, functionName: "balanceOf", args: [r.participantB] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [r.participantA] }),
      ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "isDemoParticipant", args: [r.participantB] }),
    ]);
    const loanPriceState = normalizePriceBounds(loanBounds);
    const collateralPriceState = normalizePriceBounds(collateralBounds);
    const loanReserveState = normalizeReserveConfig(loanConfig);
    const collateralReserveState = normalizeReserveConfig(collateralConfig);
    assert.ok(allowedA && allowedB, "Both configured participants must remain allowlisted immediately before unpause.");
    assert.ok(loanReserveState.active && loanReserveState.supplyEnabled && loanReserveState.borrowEnabled, "The loan reserve is not configured for the intended demo journey.");
    assert.ok(collateralReserveState.active && collateralReserveState.collateralEnabled, "The collateral reserve is not configured for the intended demo journey.");
    assertMainnetActivationPrerequisites({ paused, now: latest.timestamp, credentialA, credentialB,
      loanPrice: { price: loanPriceState.priceWad, updatedAt: loanPriceState.updatedAt },
      collateralPrice: { price: collateralPriceState.priceWad, updatedAt: collateralPriceState.updatedAt },
      loanMaxAge: loanReserveState.maxOracleAge, collateralMaxAge: collateralReserveState.maxOracleAge,
      loanBalanceA, loanBalanceB, collateralBalanceA, collateralBalanceB });
    assert.equal(await hasRole(ctx.client, contracts.lendingPool, poolAbi, "PAUSER_ROLE", ctx.roles.pauseAuthority), true, "Configured pause authority lacks pool PAUSER_ROLE.");
    return writeGuarded(ctx, command, ctx.roles.pauseAuthority, contracts.lendingPool, poolAbi, "unpauseRisk", [], options,
      async () => (await ctx.client.readContract({ address: contracts.lendingPool, abi: poolAbi, functionName: "paused" })) === false);
  }
  throw new Error(`Unknown Mainnet Lending operator command: ${command}`);
}

if (import.meta.main) main().catch((error) => {
  console.error("Mainnet Lending operator stopped: " + formatMainnetRpcError(error, getMainnetRpcCandidates()));
  process.exitCode = 1;
});
