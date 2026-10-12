"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { robinhoodContracts, projectContracts } from "@/lib/config/contracts";
import { readGovernanceProposalPage } from "@/lib/governance/service";
import { readRobinhoodGovernanceProposalPage } from "@/lib/governance/robinhood-service";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import type { ProtocolChainId } from "@/hooks/use-wallet-network";
import type { GovernanceProposalFeedState } from "@/lib/protocol/types";

const DEFAULT_PAGE_SIZE = 20;

/** Read-only, paginated proposal discovery. It never submits a governance transaction. */
export function useDaoProposalFeed(input: { beforeId?: bigint; pageSize?: number; chainId?: ProtocolChainId } = {}) {
  const chainId = input.chainId ?? GIWA_CHAIN_ID;
  const isRobinhood = chainId === ROBINHOOD_TESTNET_CHAIN_ID;
  const account = useWalletNetwork(chainId);
  const client = usePublicClient({ chainId });
  const contractAddress = isRobinhood ? robinhoodContracts.governance : projectContracts.daoGovernance;
  const registryAddress = isRobinhood ? robinhoodContracts.credentialRegistry : undefined;
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  const queryKey = useMemo(
    () => [
      "dao-proposal-feed",
      chainId,
      contractAddress,
      account.address,
      input.beforeId?.toString(),
      pageSize,
    ] as const,
    [account.address, chainId, contractAddress, input.beforeId, pageSize],
  );

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!contractAddress) throw new Error("DAO Governance is not configured.");
      if (!client) throw new Error(`${isRobinhood ? "Robinhood Testnet" : "GIWA Sepolia"} read client is unavailable.`);
      if (isRobinhood) {
        if (!registryAddress) throw new Error("Robinhood project credential registry is not configured.");
        return readRobinhoodGovernanceProposalPage(client, contractAddress, registryAddress, {
          beforeId: input.beforeId,
          pageSize,
          wallet: account.address as Address | undefined,
        });
      }
      return readGovernanceProposalPage(client, contractAddress, {
        beforeId: input.beforeId,
        pageSize,
        wallet: account.address as Address | undefined,
      });
    },
    enabled: Boolean(client && contractAddress && (!isRobinhood || registryAddress)),
    refetchInterval: 15_000,
    retry: 1,
  });

  let state: GovernanceProposalFeedState;
  if (!contractAddress || (isRobinhood && !registryAddress)) state = "unconfigured";
  else if (query.isError) state = "read-error";
  else if (query.isPending) state = "checking";
  else if (query.data?.state === "no-code") state = "no-code";
  else if (query.data?.state === "dependency-mismatch") state = "dependency-mismatch";
  else state = "ready";

  const page = query.data?.state === "ready" ? query.data.page : undefined;
  return {
    state,
    page,
    proposals: page?.proposals ?? [],
    totalProposals: page?.totalProposals,
    nextCursor: page?.nextCursor,
    quorum: page?.quorum,
    votingPeriod: page?.votingPeriod,
    executionWindow: page?.executionWindow,
    minimumRemainingValidity: page?.minimumRemainingValidity,
    error: query.error instanceof Error ? query.error : undefined,
    isLoading: state === "checking",
    refetch: query.refetch,
  };
}
