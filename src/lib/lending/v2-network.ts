import type { Address } from "viem";
import type { DemoCredentialRecord, EligibilityProof, PublicProofInputs } from "../protocol/types";
import {
  LENDING_V2_ELIGIBILITY_THRESHOLD,
  LENDING_V2_POLICY_ID,
  LENDING_V2_POLICY_VERSION,
} from "./v2-config";

export const GIWA_SEPOLIA_CHAIN_ID = 91_342 as const;
export const ROBINHOOD_TESTNET_CHAIN_ID = 46_630 as const;
export const ROBINHOOD_MAINNET_CHAIN_ID = 4_663 as const;
export type LendingV2ChainId = typeof GIWA_SEPOLIA_CHAIN_ID | typeof ROBINHOOD_TESTNET_CHAIN_ID | typeof ROBINHOOD_MAINNET_CHAIN_ID;

export function robinhoodLendingV2ProofContextForCredential(input: {
  subject: Address;
  record: DemoCredentialRecord;
  lendingPool: Address;
  chainId?: LendingV2ChainId;
}): PublicProofInputs {
  return {
    subject: input.subject,
    commitment: input.record.commitment,
    policyId: LENDING_V2_POLICY_ID,
    policyVersion: LENDING_V2_POLICY_VERSION,
    threshold: LENDING_V2_ELIGIBILITY_THRESHOLD,
    credentialVersion: input.record.version,
    expiresAt: input.record.expiresAt,
    chainId: BigInt(input.chainId ?? ROBINHOOD_TESTNET_CHAIN_ID),
    vault: input.lendingPool,
  };
}

export function isRobinhoodLendingV2ProofForContext(
  proof: EligibilityProof | undefined,
  context: PublicProofInputs,
  expectedChainId: LendingV2ChainId = ROBINHOOD_TESTNET_CHAIN_ID,
): proof is EligibilityProof {
  if (!proof || proof.localVerification !== "verified" || proof.publicInputs.length !== 9) return false;
  if (
    context.policyId !== LENDING_V2_POLICY_ID ||
    context.policyVersion !== LENDING_V2_POLICY_VERSION ||
    context.threshold !== LENDING_V2_ELIGIBILITY_THRESHOLD ||
    context.chainId !== BigInt(expectedChainId)
  ) return false;

  const expected = [
    BigInt(context.subject),
    BigInt(context.commitment),
    context.policyId,
    context.policyVersion,
    context.threshold,
    context.credentialVersion,
    context.expiresAt,
    context.chainId,
    BigInt(context.vault),
  ];
  return (
    proof.publicContext.subject.toLowerCase() === context.subject.toLowerCase() &&
    proof.publicContext.commitment.toLowerCase() === context.commitment.toLowerCase() &&
    proof.publicContext.policyId === context.policyId &&
    proof.publicContext.policyVersion === context.policyVersion &&
    proof.publicContext.threshold === context.threshold &&
    proof.publicContext.credentialVersion === context.credentialVersion &&
    proof.publicContext.expiresAt === context.expiresAt &&
    proof.publicContext.chainId === context.chainId &&
    proof.publicContext.vault.toLowerCase() === context.vault.toLowerCase() &&
    proof.publicInputs.every((value, index) => value === expected[index])
  );
}

export function robinhoodLendingV2QueryKey(pool?: Address, wallet?: Address, chainId: LendingV2ChainId = ROBINHOOD_TESTNET_CHAIN_ID) {
  return [
    "lending-v2-market",
    String(chainId),
    pool?.toLowerCase() ?? "unconfigured",
    wallet?.toLowerCase() ?? "no-wallet",
  ] as const;
}

export function robinhoodLendingV2DeploymentQueryKey(pool?: Address, chainId: LendingV2ChainId = ROBINHOOD_TESTNET_CHAIN_ID) {
  return ["lending-v2-deployment", String(chainId), pool?.toLowerCase() ?? "unconfigured"] as const;
}

export function robinhoodLendingV2CredentialQueryKey(registry?: Address, wallet?: Address, chainId: LendingV2ChainId = ROBINHOOD_TESTNET_CHAIN_ID) {
  return [
    "lending-v2-credential",
    String(chainId),
    registry?.toLowerCase() ?? "unconfigured",
    wallet?.toLowerCase() ?? "no-wallet",
    "policy-3",
  ] as const;
}
