import type { Address } from "viem";

export function daoGovernanceQueryKey(
  contractAddress: Address | undefined,
  wallet: Address | undefined,
  proposalId?: bigint,
) {
  return ["dao-governance", contractAddress, wallet, proposalId?.toString()] as const;
}
