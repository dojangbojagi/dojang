import assert from "node:assert/strict";
import { getAddress, isAddress } from "viem";

export const LENDING_USER_AUTH = Object.freeze({
  approve: "approve-token",
  "approve-repay": "approve-repay",
  supply: "supply",
  "deposit-collateral": "deposit-collateral",
  "enable-collateral": "enable-collateral",
  borrow: "borrow",
  "repay-all": "repay-all",
  "withdraw-supply": "withdraw-supply",
  "withdraw-collateral": "withdraw-collateral",
});

export const LENDING_USER_ALIASES = Object.freeze({
  // Wallet A is now controlled by MetaMask; never fall back to the inaccessible legacy keystore.
  A: null,
  B: "gyevo-rh-mainnet-wallet-b",
});

export function parseParticipantLabel(label) {
  assert.ok(label === "A" || label === "B", "Participant must be A or B.");
  return label;
}

export function assertParticipantAddress(label, address, configured) {
  parseParticipantLabel(label);
  assert.ok(address && isAddress(address), "Configured participant address is missing or invalid.");
  assert.ok(configured && isAddress(configured), "Expected participant address is missing or invalid.");
  assert.equal(getAddress(address).toLowerCase(), getAddress(configured).toLowerCase(), `Wallet ${label} is not the configured Mainnet participant.`);
  return getAddress(configured);
}

export function assertWitnessForParticipant(witness, participant) {
  assert.equal(witness?.format, "robinhood-demo-credential-v1", "Expected a Robinhood Mainnet project credential witness.");
  assert.equal(witness?.policyId, 3, "Lending requires a Policy 3 witness.");
  assert.ok(isAddress(witness?.wallet), "Witness wallet is invalid.");
  assert.equal(getAddress(witness.wallet).toLowerCase(), getAddress(participant).toLowerCase(), "Witness belongs to a different participant wallet.");
  assert.match(witness.commitment ?? "", /^0x[0-9a-fA-F]{64}$/, "Witness commitment must be bytes32.");
  assert.match(witness.salt ?? "", /^0x[0-9a-fA-F]{64}$/, "Witness salt must be bytes32.");
  assert.match(witness.privateValue ?? "", /^(0|[1-9][0-9]*)$/, "Witness private value must be an unsigned decimal integer.");
  return witness;
}

export function assertActiveCredential(record, wallet, now) {
  assert.ok(record && getAddress(record.wallet).toLowerCase() === getAddress(wallet).toLowerCase(), "No matching credential record exists for this wallet.");
  assert.notEqual(record.issuer, "0x0000000000000000000000000000000000000000", "Policy 3 credential is missing.");
  assert.equal(record.revoked, false, "Policy 3 credential is revoked.");
  assert.ok(BigInt(record.issuedAt) <= BigInt(now), "Policy 3 credential is not yet valid.");
  assert.ok(BigInt(record.expiresAt) > BigInt(now), "Policy 3 credential has expired.");
  return record;
}

export function assertPositiveBaseUnits(value) {
  assert.match(String(value ?? ""), /^[1-9][0-9]*$/, "Amount must be a positive integer in token base units.");
  return BigInt(value);
}

export function requireActionAuthorization(action, authorization) {
  const expected = LENDING_USER_AUTH[action];
  assert.ok(expected, `Unsupported participant operation: ${action}`);
  assert.equal(authorization, expected, `Execution requires --authorize-mainnet-lending-user-write=${expected}.`);
  return expected;
}

export function transactionConfirmationPhrase(action, wallet) {
  const auth = LENDING_USER_AUTH[action];
  assert.ok(auth, `Unsupported participant operation: ${action}`);
  assert.ok(isAddress(wallet), "Wallet address is invalid.");
  return `EXECUTE Robinhood Mainnet Lending ${auth} ${getAddress(wallet)}`;
}

export function assertPrivateWitnessFile(stat) {
  assert.ok(stat?.isFile && !stat.isSymbolicLink, "Witness must be a regular, non-symlink file.");
  assert.equal(stat.mode & 0o077, 0, "Witness file permissions must be 0600 or stricter.");
  assert.ok(stat.size > 0 && stat.size <= 16_384, "Witness file size is outside the supported range.");
}

export function gasLimitWithHeadroom(estimate, headroomBps = 12_000n) {
  const gas = BigInt(estimate);
  assert.ok(gas > 0n && headroomBps >= 10_000n, "Gas estimate and headroom must be positive.");
  return (gas * headroomBps + 9_999n) / 10_000n;
}

export function repaymentAllowanceRequired(debt, borrowRateBps, windowSeconds = 900n) {
  const amount = BigInt(debt);
  const rate = BigInt(borrowRateBps);
  const window = BigInt(windowSeconds);
  assert.ok(amount > 0n && rate >= 0n && window > 0n, "Repayment allowance inputs are invalid.");
  const accrued = (amount * rate * window + (10_000n * 31_536_000n) - 1n) / (10_000n * 31_536_000n);
  return amount + accrued + 1n;
}
