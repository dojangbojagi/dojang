import { ProtocolError } from "@/lib/protocol/types";

function collectErrorText(error: unknown, depth = 0): string {
  if (depth > 3 || !error || typeof error !== "object") return "";
  const value = error as { name?: unknown; message?: unknown; shortMessage?: unknown; cause?: unknown };
  const own = [value.name, value.message, value.shortMessage].filter((part): part is string => typeof part === "string").join(" ");
  return `${own} ${collectErrorText(value.cause, depth + 1)}`.trim();
}

export function explainProtocolError(error: unknown): string {
  if (error instanceof ProtocolError) return error.message;
  const detail = collectErrorText(error);
  const message = detail.toLowerCase();
  if (message.includes("user rejected") || message.includes("user denied")) return "The wallet request was rejected. No transaction was submitted.";
  if (message.includes("insufficient funds")) return "This wallet does not have enough GIWA Sepolia ETH to pay the network fee.";
  if (message.includes("alreadygranted")) return "This wallet has already entered the Restricted Vault.";
  if (message.includes("credentialmissing")) return "No active project demo credential is registered for this wallet and policy.";
  if (message.includes("credentialrevoked")) return "The issuer revoked this demo credential.";
  if (message.includes("credentialexpired")) return "This demo credential has expired. Request a current issuer credential.";
  if (message.includes("issuernotauthorized")) return "The credential's issuer no longer has the registry issuer role.";
  if (message.includes("missingcredential")) return "No lending credential is registered for this wallet and lending policy.";
  if (message.includes("wrongsubject")) return "The proof is bound to a different wallet.";
  if (message.includes("wrongcommitment")) return "The proof commitment does not match the active issuer record.";
  if (message.includes("wrongpolicyversion")) return "The proof uses a different policy version. Generate a new proof for the active policy.";
  if (message.includes("wrongpolicy")) return "The proof uses a policy that the Restricted Vault does not accept.";
  if (message.includes("wrongthreshold")) return "The proof threshold does not match the active policy.";
  if (message.includes("wrongcredentialversion")) return "The credential changed after this proof was prepared.";
  if (message.includes("wrongexpiry")) return "The proof expiry does not match the active credential.";
  if (message.includes("wrongchain") || message.includes("unsupportedchain")) return "This action is restricted to GIWA Sepolia.";
  if (message.includes("wrongvault")) return "The proof was prepared for a different vault contract.";
  if (message.includes("wronglendingpool")) return "The proof was prepared for a different LendingPool.";
  if (message.includes("invalidproof")) return "The verifier rejected the proof. Access was not granted.";
  if (message.includes("insufficientliquidity")) return "The market does not have enough unborrowed supplier liquidity for this action.";
  if (message.includes("insufficientcollateral")) return "This wallet does not have enough deposited collateral for this action.";
  if (message.includes("borrowingcapacityexceeded")) return "The requested debt would exceed the market's current collateral limit.";
  if (message.includes("repayexceedsdebt")) return "The repayment amount exceeds the outstanding loan balance.";
  if (message.includes("unsafecollateralwithdrawal")) return "That withdrawal would leave the loan below the required collateral ratio.";
  if (message.includes("unsupportedtokenbehavior")) return "The market rejected a token transfer whose received or sent amount did not match.";
  if (message.includes("notverifiedmember")) return "A current official Dojang Verified Address is required for this governance action.";
  if (message.includes("dojangreadfailed")) return "The official Dojang or EAS verification read failed. Membership was not granted.";
  if (message.includes("invaliddojangattestation")) return "The Dojang attestation metadata does not match the configured official schema or attester.";
  if (message.includes("votingnotstarted")) return "Voting has not opened for this proposal yet.";
  if (message.includes("votingclosed")) return "The voting deadline for this proposal has passed.";
  if (message.includes("alreadyvoted")) return "This wallet has already voted on this proposal.";
  if (message.includes("proposalstillactive")) return "This proposal can be finalized after its voting deadline.";
  if (message.includes("proposalnotfinalized")) return "Finalize the voting outcome before executing this proposal.";
  if (message.includes("proposalnotsucceeded")) return "Only a successful, unexpired proposal can be executed.";
  if (message.includes("accesspolicyrequireslongercredentialvalidity")) return "This verified credential does not remain valid long enough for the current access policy.";
  if (message.includes("invalidproposal")) return "The requested governance proposal does not exist.";
  if (message.includes("unauthorizedaction")) return "Governance only allows its approved access-policy action.";
  if (message.includes("accesscontrolunauthorizedaccount") || message.includes("notcredentialissuer") || message.includes("missingrole")) return "This account is not authorized to issue or revoke demo credentials.";
  if (message.includes("unexpectedcredentialversion")) return "The credential changed while it was being prepared. Refresh the record and issue it again.";
  if (message.includes("zeroaddress") || message.includes("zerowallet") || message.includes("zerocommitment")) return "The contract rejected an empty address or commitment.";
  if (detail) return detail;
  return "The request failed. Check the network connection and try again.";
}
