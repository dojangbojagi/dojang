import { explainProtocolError } from "@/lib/protocol/errors";

/**
 * Presentation-only: the LendingPool ABI in the app has no error fragments, so viem cannot name a custom revert and
 * its raw multi-paragraph message reaches the UI. These are the 4-byte selectors of the contract's own errors
 * (keccak of the error signature in contracts/src/LendingPool.sol); the wording comes from explainProtocolError.
 */
const POOL_ERROR_BY_SELECTOR: Record<string, string> = {
  "0xef9b6f55": "BorrowingCapacityExceeded",
  "0xf6f992e7": "CredentialExpired",
  "0x68d7050f": "CredentialNotYetValid",
  "0x5dea5a30": "CredentialRevoked",
  "0x3a23d825": "InsufficientCollateral",
  "0xbb55fd27": "InsufficientLiquidity",
  "0x73f1c848": "InsufficientSupplierPosition",
  "0x09bde339": "InvalidProof",
  "0x1d342f47": "IssuerNotAuthorized",
  "0x2b6de1db": "MissingCredential",
  "0xd4471d4c": "RepayExceedsDebt",
  "0x31acae85": "UnsafeCollateralWithdrawal",
  "0x7dd521ac": "UnsupportedTokenBehavior",
  "0x10dfc033": "WrongChain",
  "0xe2d3b1c0": "WrongCommitment",
  "0x551b52f3": "WrongCredentialVersion",
  "0xd2811f7c": "WrongExpiry",
  "0xf072322c": "WrongLendingPool",
  "0x1beb0849": "WrongPolicy",
  "0x07f3106b": "WrongPolicyVersion",
  "0xad1859ba": "WrongSubject",
  "0x2f77f378": "WrongThreshold",
  "0x1f2a2005": "ZeroAmount",
};

/** Errors that explainProtocolError has no sentence for. */
const LOCAL_COPY: Record<string, string> = {
  InsufficientSupplierPosition: "This is more than your supplied position.",
  CredentialNotYetValid: "This credential is not valid yet.",
  ZeroAmount: "Enter an amount greater than zero.",
};

const RAW_MARKERS = /reverted with the following signature|ContractFunctionExecutionError|Unable to decode signature|Docs: https:\/\/viem\.sh|Version: viem|Request Arguments|Raw Call Arguments/i;
const GENERIC = "The contract rejected this action, so nothing changed on-chain.";

/** Turns an error, or the error text a hook already stored, into one readable sentence. */
export function explainLendingFailure(input: unknown): string {
  const text = typeof input === "string" ? input : explainProtocolError(input);
  if (!RAW_MARKERS.test(text)) return text;
  const selector = /signature:?\s*"?(0x[0-9a-fA-F]{8})/.exec(text)?.[1]?.toLowerCase();
  const name = selector ? POOL_ERROR_BY_SELECTOR[selector] : undefined;
  if (name) {
    const known = explainProtocolError(new Error(name));
    return known !== name ? known : (LOCAL_COPY[name] ?? GENERIC);
  }
  return GENERIC;
}
