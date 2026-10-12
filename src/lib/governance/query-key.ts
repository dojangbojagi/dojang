import type { Address } from "viem";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";

export function daoGovernanceQueryKey(
  contractAddress: Address | undefined,
  wallet: Address | undefined,
  proposalId?: bigint,
  chainId: number = GIWA_CHAIN_ID,
) {
  return ["dao-governance", chainId, contractAddress, wallet, proposalId?.toString()] as const;
}
