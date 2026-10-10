"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { projectContracts } from "@/lib/config/contracts";
import { readGovernanceProposalPage } from "@/lib/governance/service";
import type { GovernanceProposalFeedState } from "@/lib/protocol/types";

const DEFAULT_PAGE_SIZE = 20;

/** Read-only, paginated proposal discovery. It never submits a governance transaction. */
export function useDaoProposalFeed(input: { beforeId?: bigint; pageSize?: number } = {}) {
  const account = useWalletNetwork();
  const client = usePublicClient({ chainId: GIWA_CHAIN_ID });
  const contractAddress = projectContracts.daoGovernance;
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  const queryKey = useMemo(
    () => [
      "dao-proposal-feed",
      contractAddress,
      account.address,
      input.beforeId?.toString(),
      pageSize,
    ] as const,
    [account.address, contractAddress, input.beforeId, pageSize],
  );

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!contractAddress) throw new Error("DAO Governance is not configured.");
      if (!client) throw new Error("GIWA Sepolia read client is unavailable.");
      return readGovernanceProposalPage(client, contractAddress, {
        beforeId: input.beforeId,
        pageSize,
        wallet: account.address as Address | undefined,
      });
    },
    enabled: Boolean(contractAddress),
    refetchInterval: 15_000,
    retry: 1,
  });

  let state: GovernanceProposalFeedState;
  if (!contractAddress) state = "unconfigured";
  else if (query.isError) state = "read-error";
  else if (query.isPending) state = "checking";
  else if (query.data?.state === "no-code") state = "no-code";
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
