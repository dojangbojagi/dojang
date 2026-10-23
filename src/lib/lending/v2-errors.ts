export type LendingV2ErrorCategory =
  | "configuration"
  | "wallet"
  | "eligibility"
  | "oracle"
  | "cap"
  | "liquidity"
  | "health"
  | "reserve"
  | "allowance"
  | "balance"
  | "liquidation"
  | "paused"
  | "rpc"
  | "unknown";

export type LendingV2Failure = {
  category: LendingV2ErrorCategory;
  code: string;
  message: string;
};

function errorText(error: unknown, depth = 0): string {
  if (depth > 5 || !error || typeof error !== "object") return "";
  const value = error as Record<string, unknown>;
  const parts = [value.name, value.message, value.shortMessage, value.details, value.reason];
  const data = value.data;
  if (data && typeof data === "object") {
    const decoded = data as Record<string, unknown>;
    parts.push(decoded.errorName, decoded.reason);
  }
  return `${parts.filter((part): part is string => typeof part === "string").join(" ")} ${errorText(value.cause, depth + 1)}`.trim();
}

const exactFailures: Array<[string[], LendingV2ErrorCategory, string]> = [
  [["reservenotconfigured"], "reserve", "This asset is not configured as a Lending V2 reserve."],
  [["reserveinactive"], "reserve", "This reserve is inactive."],
  [["reservesupplydisabled"], "reserve", "Supplying is disabled for this reserve."],
  [["reserveborrowdisabled"], "reserve", "Borrowing is disabled for this reserve."],
  [["reservecollateraldisabled"], "reserve", "Collateral use is disabled for this reserve."],
  [["supplycapexceeded"], "cap", "The reserve supply cap would be exceeded."],
  [["borrowcapexceeded"], "cap", "The reserve borrow cap would be exceeded."],
  [["collateralcapexceeded"], "cap", "The reserve collateral cap would be exceeded."],
  [["insufficientliquidity"], "liquidity", "The reserve does not have enough available liquidity."],
  [["insufficientsupplierposition"], "liquidity", "The requested withdrawal exceeds the supplied position."],
  [["insufficientcollateral"], "health", "The requested action exceeds the deposited collateral position."],
  [["borrowbelowminimum"], "cap", "The borrow amount is below this reserve's minimum."],
  [["borrowingcapacityexceeded"], "health", "The requested debt exceeds the current collateral borrowing capacity."],
  [["unsafeposition"], "health", "The action would leave the position below its required health threshold."],
  [["oracleunavailable"], "oracle", "The configured test oracle is unavailable; risk-increasing actions are blocked."],
  [["invalidoracleprice"], "oracle", "The oracle returned a zero or invalid price."],
  [["staleoracleprice"], "oracle", "The oracle price is stale; risk-increasing actions are blocked."],
  [["futureoracleprice"], "oracle", "The oracle timestamp is in the future; risk-increasing actions are blocked."],
  [["missingcredential"], "eligibility", "No GYEVO Policy 3 Project Credential is registered for this wallet."],
  [["credentialrevoked"], "eligibility", "The GYEVO Policy 3 Project Credential has been revoked."],
  [["credentialnotyetvalid"], "eligibility", "The GYEVO Policy 3 Project Credential is not yet valid."],
  [["credentialexpired"], "eligibility", "The GYEVO Policy 3 Project Credential has expired."],
  [["issuernotauthorized"], "eligibility", "The credential issuer is no longer authorized by the project registry."],
  [["wrongsubject"], "eligibility", "The proof is bound to a different wallet."],
  [["wrongcommitment"], "eligibility", "The proof commitment does not match the active registry record."],
  [["wrongpolicyversion"], "eligibility", "The proof uses a different policy version. Generate a fresh V2 proof."],
  [["wrongpolicy"], "eligibility", "The proof is not policy 3. V1 proofs cannot authorize Lending V2."],
  [["wrongthreshold"], "eligibility", "The proof threshold does not match the V2 policy."],
  [["wrongcredentialversion"], "eligibility", "The credential changed after the proof was generated."],
  [["wrongexpiry"], "eligibility", "The proof expiry does not match the credential record."],
  [["wrongchain"], "eligibility", "This proof is bound to a different Robinhood network."],
  [["wronglendingpool"], "eligibility", "The proof is bound to a different Lending V2 pool."],
  [["invalidproof"], "eligibility", "The on-chain verifier rejected this proof."],
  [["liquidationclosefactorexceeded"], "liquidation", "The requested liquidation exceeds the reserve close-factor limit."],
  [["liquidationcollateralinsufficient"], "liquidation", "The borrower does not have enough eligible collateral for this liquidation."],
  [["positionhealthy"], "liquidation", "The position is not currently eligible for liquidation."],
  [["nodebt"], "liquidation", "The borrower has no outstanding debt in this reserve."],
  [["collateralnotenabled"], "liquidation", "The selected asset is not enabled as borrower collateral."],
  [["unsupportedtokenbehavior"], "balance", "This token transfer did not settle the exact requested amount."],
  [["insufficientallowance"], "allowance", "Approve the V2 pool to spend the required token amount first."],
  [["insufficientfunds"], "balance", "The wallet does not have enough token balance or network gas for this action."],
  [["enforcedpause"], "paused", "Risk-increasing Lending V2 operations are paused."],
  [["unsupportedchain"], "configuration", "The V2 pool supports only GIWA Sepolia (91342), Robinhood Testnet (46630), and the separately configured Robinhood Mainnet deployment (4663)."],
  [["accesscontrolunauthorizedaccount"], "configuration", "This wallet is not authorized for the requested administrative operation."],
  [["user rejected", "user denied"], "wallet", "The wallet request was rejected; no transaction was submitted."],
];

export function mapLendingV2Error(error: unknown): LendingV2Failure {
  const text = errorText(error);
  const normalized = text.toLowerCase().replaceAll("_", "");
  if (normalized.includes("estimated transaction fee") || normalized.includes("native balance covering")) {
    return { category: "balance", code: "insufficient-native-gas", message: "The wallet does not have enough Robinhood Chain ETH for the estimated fee plus transaction headroom." };
  }
  if (normalized.includes("approve the lending v2 pool")) {
    return { category: "allowance", code: "insufficient-allowance", message: "Approve the V2 pool to spend the required token amount first." };
  }
  if (normalized.includes("wallet token balance")) {
    return { category: "balance", code: "insufficient-token-balance", message: "The wallet token balance is below the requested amount." };
  }
  for (const [needles, category, message] of exactFailures) {
    if (needles.some((needle) => normalized.includes(needle))) {
      return { category, code: needles[0], message };
    }
  }
  if (normalized.includes("revert")) {
    return { category: "unknown", code: "simulation-revert", message: "The contract simulation reverted. No transaction was submitted." };
  }
  if (normalized.includes("network") || normalized.includes("timeout") || normalized.includes("rpc")) {
    return { category: "rpc", code: "rpc-error", message: "The selected network RPC request failed. No successful state change was confirmed." };
  }
  return { category: "unknown", code: "unknown", message: text || "The Lending V2 action failed." };
}
