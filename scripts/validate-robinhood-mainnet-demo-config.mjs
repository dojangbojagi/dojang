import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAddress } from "viem";

const ROOT = resolve(import.meta.dirname, "..");

export const ADDRESS_KEYS = [
  "RH_MAINNET_DEPLOYER_ADDRESS",
  "RH_MAINNET_ADMIN_ADDRESS",
  "RH_MAINNET_ISSUER_ADDRESS",
  "RH_MAINNET_ORACLE_UPDATER_ADDRESS",
  "RH_MAINNET_RISK_ADMIN_ADDRESS",
  "RH_MAINNET_PAUSE_AUTHORITY_ADDRESS",
  "RH_MAINNET_DEMO_MINTER_ADDRESS",
  "RH_MAINNET_DEMO_PARTICIPANT_A_ADDRESS",
  "RH_MAINNET_DEMO_PARTICIPANT_B_ADDRESS",
];
export const OPTIONAL_ADDRESS_KEYS = ["RH_MAINNET_DEMO_PREVIOUS_PARTICIPANT_A_ADDRESS"];

export const PARAMETER_KEYS = [
  "RH_MAINNET_DEMO_GOVERNANCE_VOTING_PERIOD",
  "RH_MAINNET_DEMO_GOVERNANCE_QUORUM",
  "RH_MAINNET_DEMO_GOVERNANCE_EXECUTION_WINDOW",
  "RH_MAINNET_DEMO_GOVERNANCE_INITIAL_MIN_VALIDITY",
  "RH_MAINNET_DEMO_LOAN_MINT_CAP",
  "RH_MAINNET_DEMO_COLLATERAL_MINT_CAP",
  "RH_MAINNET_DEMO_LENDING_SUPPLY_CAP",
  "RH_MAINNET_DEMO_LENDING_BORROW_CAP",
  "RH_MAINNET_DEMO_COLLATERAL_CAP",
  "RH_MAINNET_DEMO_MIN_BORROW_AMOUNT",
  "RH_MAINNET_DEMO_MAX_ORACLE_AGE",
  "RH_MAINNET_DEMO_MAX_LTV_BPS",
  "RH_MAINNET_DEMO_LIQUIDATION_THRESHOLD_BPS",
  "RH_MAINNET_DEMO_LIQUIDATION_BONUS_BPS",
  "RH_MAINNET_DEMO_CLOSE_FACTOR_BPS",
  "RH_MAINNET_DEMO_RESERVE_FACTOR_BPS",
  "RH_MAINNET_DEMO_OPTIMAL_UTILIZATION_BPS",
  "RH_MAINNET_DEMO_BASE_BORROW_RATE_BPS",
  "RH_MAINNET_DEMO_SLOPE1_BPS",
  "RH_MAINNET_DEMO_SLOPE2_BPS",
  "RH_MAINNET_DEMO_LOAN_PRICE_MIN_WAD",
  "RH_MAINNET_DEMO_LOAN_PRICE_MAX_WAD",
  "RH_MAINNET_DEMO_COLLATERAL_PRICE_MIN_WAD",
  "RH_MAINNET_DEMO_COLLATERAL_PRICE_MAX_WAD",
];

const REQUIRED_KEYS = ["RH_MAINNET_RPC_URL", "RH_MAINNET_ACCOUNT", ...ADDRESS_KEYS, ...PARAMETER_KEYS];
const UINT64_MAX = (1n << 64n) - 1n;
const UINT128_MAX = (1n << 128n) - 1n;
const UINT16_MAX = (1n << 16n) - 1n;
const UINT256_MAX = (1n << 256n) - 1n;
const BPS = 10_000n;
const DAY = 86_400n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function parseEnvValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}

/** Parse only the explicitly allowed public deployment keys; never execute .env text. */
export function parseAllowedEnv(text) {
  const allowed = new Set([...REQUIRED_KEYS, ...OPTIONAL_ADDRESS_KEYS]);
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match || !allowed.has(match[1])) continue;
    values[match[1]] = parseEnvValue(match[2]);
  }
  return values;
}

function uint(values, key, errors, max = (1n << 256n) - 1n) {
  const raw = values[key];
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    errors.push(`${key} must be a base-10 unsigned integer.`);
    return null;
  }
  const parsed = BigInt(raw);
  if (parsed > max) {
    errors.push(`${key} exceeds its Solidity integer width.`);
    return null;
  }
  return parsed;
}

function checkRange(value, key, min, max, errors) {
  if (value !== null && (value < min || value > max)) {
    errors.push(`${key} is outside its contract-supported range.`);
  }
}

/** Validate structure and deployed constructor invariants without printing configured values. */
export function validateConfig(values) {
  const errors = [];
  const missing = REQUIRED_KEYS.filter((key) => !values[key]);
  const warnings = [
    "Passing validation does not approve these parameters or authorize signing, deployment, oracle writes, minting, issuance, or unpausing.",
    "Verify RH_MAINNET_ACCOUNT derives RH_MAINNET_DEPLOYER_ADDRESS locally with cast wallet address before deployment.",
  ];

  if (missing.length) return { ok: false, missing, errors, warnings };

  try {
    const rpcUrl = new URL(values.RH_MAINNET_RPC_URL);
    if (rpcUrl.protocol !== "https:") errors.push("RH_MAINNET_RPC_URL must use HTTPS.");
  } catch {
    errors.push("RH_MAINNET_RPC_URL must be a valid HTTPS URL for chain ID 4663.");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(values.RH_MAINNET_ACCOUNT)) {
    errors.push("RH_MAINNET_ACCOUNT must be a Foundry keystore alias, not a key or password.");
  }

  const addresses = [];
  for (const key of ADDRESS_KEYS) {
    if (!isAddress(values[key])) errors.push(`${key} must be a valid EVM address.`);
    else if (values[key].toLowerCase() === ZERO_ADDRESS) errors.push(`${key} cannot be the zero address.`);
    else addresses.push([key, values[key].toLowerCase()]);
  }
  const seen = new Map();
  for (const [key, normalized] of addresses) {
    if (seen.has(normalized)) errors.push(`${key} must be distinct from ${seen.get(normalized)}.`);
    else seen.set(normalized, key);
  }
  const previousA = values.RH_MAINNET_DEMO_PREVIOUS_PARTICIPANT_A_ADDRESS;
  if (previousA) {
    if (!isAddress(previousA)) errors.push("RH_MAINNET_DEMO_PREVIOUS_PARTICIPANT_A_ADDRESS must be a valid EVM address.");
    else if (previousA.toLowerCase() === ZERO_ADDRESS) errors.push("RH_MAINNET_DEMO_PREVIOUS_PARTICIPANT_A_ADDRESS cannot be the zero address.");
    else if (seen.has(previousA.toLowerCase())) errors.push(`RH_MAINNET_DEMO_PREVIOUS_PARTICIPANT_A_ADDRESS must be distinct from ${seen.get(previousA.toLowerCase())}.`);
  }

  const n = {};
  for (const key of PARAMETER_KEYS) {
    const max = key.endsWith("_WAD") ? UINT128_MAX
      : key.includes("VOTING_PERIOD") || key.includes("EXECUTION_WINDOW") || key.includes("MIN_VALIDITY") || key.includes("ORACLE_AGE")
        ? UINT64_MAX
        : key.endsWith("_BPS") ? UINT16_MAX : undefined;
    n[key] = uint(values, key, errors, max);
  }

  const val = (name) => n[`RH_MAINNET_DEMO_${name}`];
  checkRange(val("GOVERNANCE_VOTING_PERIOD"), "RH_MAINNET_DEMO_GOVERNANCE_VOTING_PERIOD", 1n, 30n * DAY, errors);
  checkRange(val("GOVERNANCE_QUORUM"), "RH_MAINNET_DEMO_GOVERNANCE_QUORUM", 1n, (1n << 256n) - 1n, errors);
  checkRange(val("GOVERNANCE_EXECUTION_WINDOW"), "RH_MAINNET_DEMO_GOVERNANCE_EXECUTION_WINDOW", 1n, 90n * DAY, errors);
  checkRange(val("GOVERNANCE_INITIAL_MIN_VALIDITY"), "RH_MAINNET_DEMO_GOVERNANCE_INITIAL_MIN_VALIDITY", 0n, 365n * DAY, errors);

  for (const key of ["LOAN_MINT_CAP", "COLLATERAL_MINT_CAP", "LENDING_SUPPLY_CAP", "LENDING_BORROW_CAP", "COLLATERAL_CAP", "MIN_BORROW_AMOUNT", "MAX_ORACLE_AGE"]) {
    const max = key === "MAX_ORACLE_AGE" ? UINT64_MAX : UINT256_MAX;
    checkRange(val(key), `RH_MAINNET_DEMO_${key}`, 1n, max, errors);
  }
  if (val("LENDING_SUPPLY_CAP") !== null && val("LOAN_MINT_CAP") !== null && val("LENDING_SUPPLY_CAP") > val("LOAN_MINT_CAP")) {
    errors.push("LENDING_SUPPLY_CAP cannot exceed LOAN_MINT_CAP.");
  }
  if (val("LENDING_BORROW_CAP") !== null && val("LENDING_SUPPLY_CAP") !== null && val("LENDING_BORROW_CAP") > val("LENDING_SUPPLY_CAP")) {
    errors.push("LENDING_BORROW_CAP cannot exceed LENDING_SUPPLY_CAP.");
  }
  if (val("MIN_BORROW_AMOUNT") !== null && val("LENDING_BORROW_CAP") !== null && val("MIN_BORROW_AMOUNT") > val("LENDING_BORROW_CAP")) {
    errors.push("MIN_BORROW_AMOUNT cannot exceed LENDING_BORROW_CAP.");
  }
  if (val("COLLATERAL_CAP") !== null && val("COLLATERAL_MINT_CAP") !== null && val("COLLATERAL_CAP") > val("COLLATERAL_MINT_CAP")) {
    errors.push("COLLATERAL_CAP cannot exceed COLLATERAL_MINT_CAP.");
  }

  checkRange(val("MAX_LTV_BPS"), "RH_MAINNET_DEMO_MAX_LTV_BPS", 1n, BPS - 1n, errors);
  checkRange(val("LIQUIDATION_THRESHOLD_BPS"), "RH_MAINNET_DEMO_LIQUIDATION_THRESHOLD_BPS", 1n, BPS - 1n, errors);
  checkRange(val("LIQUIDATION_BONUS_BPS"), "RH_MAINNET_DEMO_LIQUIDATION_BONUS_BPS", 0n, 5_000n, errors);
  checkRange(val("CLOSE_FACTOR_BPS"), "RH_MAINNET_DEMO_CLOSE_FACTOR_BPS", 1n, BPS, errors);
  checkRange(val("RESERVE_FACTOR_BPS"), "RH_MAINNET_DEMO_RESERVE_FACTOR_BPS", 0n, BPS, errors);
  checkRange(val("OPTIMAL_UTILIZATION_BPS"), "RH_MAINNET_DEMO_OPTIMAL_UTILIZATION_BPS", 1n, BPS - 1n, errors);
  for (const key of ["BASE_BORROW_RATE_BPS", "SLOPE1_BPS", "SLOPE2_BPS"]) {
    checkRange(val(key), `RH_MAINNET_DEMO_${key}`, 0n, UINT16_MAX, errors);
  }
  if ([val("MAX_LTV_BPS"), val("LIQUIDATION_THRESHOLD_BPS")].every((x) => x !== null)
      && val("MAX_LTV_BPS") > val("LIQUIDATION_THRESHOLD_BPS")) {
    errors.push("MAX_LTV_BPS must not exceed LIQUIDATION_THRESHOLD_BPS.");
  }
  if ([val("BASE_BORROW_RATE_BPS"), val("SLOPE1_BPS"), val("SLOPE2_BPS")].every((x) => x !== null)
      && val("BASE_BORROW_RATE_BPS") + val("SLOPE1_BPS") + val("SLOPE2_BPS") > 100_000n) {
    errors.push("The annualized rate sum exceeds the Lending contract maximum of 100000 BPS.");
  }

  for (const asset of ["LOAN", "COLLATERAL"]) {
    const minimum = val(`${asset}_PRICE_MIN_WAD`);
    const maximum = val(`${asset}_PRICE_MAX_WAD`);
    checkRange(minimum, `RH_MAINNET_DEMO_${asset}_PRICE_MIN_WAD`, 1n, UINT128_MAX, errors);
    checkRange(maximum, `RH_MAINNET_DEMO_${asset}_PRICE_MAX_WAD`, 1n, UINT128_MAX, errors);
    if (minimum !== null && maximum !== null && maximum < minimum) {
      errors.push(`RH_MAINNET_DEMO_${asset}_PRICE_MAX_WAD must be at least its minimum bound.`);
    }
  }

  return { ok: errors.length === 0, missing, errors, warnings };
}

function readConfig() {
  const fileValues = parseAllowedEnv(readFileSync(resolve(ROOT, ".env"), "utf8"));
  const processValues = Object.fromEntries(REQUIRED_KEYS.filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  return { ...fileValues, ...processValues };
}

function main() {
  let values;
  try {
    values = readConfig();
  } catch (error) {
    if (error?.code === "ENOENT") values = {};
    else throw error;
  }
  const result = validateConfig(values);
  console.log("Robinhood Mainnet controlled-demo configuration check (read-only)");
  console.log("Network: chain ID 4663 | values are not displayed");
  if (result.missing.length) {
    console.error(`Missing ${result.missing.length} required value(s):`);
    for (const key of result.missing) console.error(`  - ${key}`);
  }
  for (const error of result.errors) console.error(`Invalid: ${error}`);
  for (const warning of result.warnings) console.warn(`Review: ${warning}`);
  if (result.ok) console.log("PASS: values satisfy validator checks; this is not owner approval or deployment authorization.");
  else console.error("FAIL: complete the listed values and correct validation errors; no values were changed.");
  process.exitCode = result.ok ? 0 : 1;
}

if (import.meta.main) main();
