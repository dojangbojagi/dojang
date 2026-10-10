"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { decodeEventLog, isAddressEqual, type TransactionReceipt } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { projectContracts } from "@/lib/config/contracts";
import { daoGovernanceAbi } from "@/lib/contracts/abis";
import { readGovernanceSnapshot } from "@/lib/governance/service";
import { explainProtocolError } from "@/lib/protocol/errors";
import {
  ProtocolError,
  type GovernanceProposalState,
  type GovernanceVoteType,
  type GovernanceWriteResult,
  type TransactionLifecycle,
} from "@/lib/protocol/types";

const voteTypeIndex: Record<GovernanceVoteType, number> = {
  against: 0,
  for: 1,
  abstain: 2,
};

const proposalStateByIndex: readonly (GovernanceProposalState | undefined)[] = [
  undefined,
  "pending",
  "active",
  "succeeded",
  "rejected",
  "expired",
  "executed",
];

interface GovernanceWriteContext {
  address: NonNullable<typeof projectContracts.daoGovernance>;
  wallet: NonNullable<ReturnType<typeof useWalletNetwork>["address"]>;
  client: NonNullable<ReturnType<typeof usePublicClient>>;
}

export function useDaoGovernance(proposalId?: bigint) {
  const account = useWalletNetwork();
  const client = usePublicClient({ chainId: GIWA_CHAIN_ID });
  const writer = useWriteContract();
  const queryClient = useQueryClient();
  const contractAddress = projectContracts.daoGovernance;
  const [transaction, setTransaction] = useState<TransactionLifecycle>({ state: "idle" });
  const queryKey = useMemo(
    () => ["dao-governance", contractAddress, account.address, proposalId] as const,
    [account.address, contractAddress, proposalId],
  );

  const snapshotQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!client || !contractAddress) throw new Error("DAO Governance is not configured.");
      return readGovernanceSnapshot(client, contractAddress, account.address, proposalId);
    },
    enabled: Boolean(client && contractAddress),
    refetchInterval: 15_000,
    retry: 1,
  });

  let state: "unconfigured" | "checking" | "ready" | "read-error";
  if (!contractAddress) state = "unconfigured";
  else if (snapshotQuery.isError) state = "read-error";
  else if (snapshotQuery.isPending) state = "checking";
  else state = "ready";

  const ensureWriteContext = useCallback((): GovernanceWriteContext => {
    if (!account.address) {
      throw new ProtocolError("WALLET_REQUIRED", "Connect an official Dojang-verified wallet to use governance.");
    }
    if (!account.isGiwaSepolia) {
      throw new ProtocolError("WRONG_NETWORK", "Switch to GIWA Sepolia before submitting a governance transaction.");
    }
    if (!contractAddress || !client) {
      throw new ProtocolError("GOVERNANCE_NOT_CONFIGURED", "The DAO Governance contract or GIWA RPC client is not configured.");
    }
    return { address: contractAddress, wallet: account.address, client };
  }, [account.address, account.isGiwaSepolia, client, contractAddress]);

  const submitWrite = useCallback(async <TResult,>(
    simulate: () => Promise<{ request: unknown; result: TResult }>,
    confirmReadback: (result: TResult, receipt: TransactionReceipt) => Promise<boolean>,
  ): Promise<GovernanceWriteResult<TResult> | undefined> => {
    setTransaction({ state: "simulating" });
    try {
      const simulation = await simulate();
      setTransaction({ state: "awaiting-signature" });
      const hash = await writer.writeContractAsync(
        simulation.request as Parameters<typeof writer.writeContractAsync>[0],
      );
      const explorerUrl = `${GIWA_EXPLORER_URL}/tx/${hash}`;
      setTransaction({ state: "submitted", hash, explorerUrl });
      setTransaction({ state: "confirming", hash, explorerUrl });

      const receipt = await client!.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setTransaction({ state: "reverted", hash, explorerUrl, error: "The governance transaction reverted." });
        return undefined;
      }

      if (!(await confirmReadback(simulation.result, receipt))) {
        setTransaction({
          state: "rpc-error",
          hash,
          explorerUrl,
          error: "The receipt succeeded, but the expected governance state readback is not confirmed yet.",
        });
        return undefined;
      }

      await queryClient.invalidateQueries({ queryKey: ["dao-governance", contractAddress] });
      await queryClient.invalidateQueries({ queryKey: ["dao-proposal-feed", contractAddress] });
      setTransaction({ state: "confirmed", hash, explorerUrl });
      return { result: simulation.result, receipt };
    } catch (error) {
      const detail = explainProtocolError(error);
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const rejected = message.includes("user rejected") || message.includes("user denied");
      setTransaction({ state: rejected ? "rejected" : "rpc-error", error: detail });
      throw error;
    }
  }, [client, contractAddress, queryClient, writer]);

  const createProposal = useCallback(async (input: {
    contentReference: string;
    newMinimumRemainingValidity: bigint;
  }): Promise<bigint | undefined> => {
    const context = ensureWriteContext();
    let createdProposalId: bigint | undefined;
    await submitWrite(
      async () => {
        const simulation = await context.client.simulateContract({
          account: context.wallet,
          address: context.address,
          abi: daoGovernanceAbi,
          functionName: "createProposal",
          args: [input.contentReference, input.newMinimumRemainingValidity],
        });
        return { request: simulation.request, result: simulation.result };
      },
      async (_predictedProposalId, receipt) => {
        for (const log of receipt.logs) {
          if (!isAddressEqual(log.address, context.address)) continue;
          try {
            const decoded = decodeEventLog({
              abi: daoGovernanceAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName !== "ProposalCreated") continue;
            createdProposalId = decoded.args.proposalId;
            const proposal = await context.client.readContract({
              address: context.address,
              abi: daoGovernanceAbi,
              functionName: "getProposal",
              args: [createdProposalId],
            });
            return proposal.proposer.toLowerCase() === context.wallet.toLowerCase()
              && proposal.proposedMinimumRemainingValidity === input.newMinimumRemainingValidity
              && proposal.contentReference === input.contentReference;
          } catch {
            continue;
          }
        }
        return false;
      },
    );
    return createdProposalId;
  }, [ensureWriteContext, submitWrite]);

  const castVote = useCallback(async (targetProposalId: bigint, vote: GovernanceVoteType) => {
    const context = ensureWriteContext();
    return submitWrite(
      async () => {
        const simulation = await context.client.simulateContract({
          account: context.wallet,
          address: context.address,
          abi: daoGovernanceAbi,
          functionName: "castVote",
          args: [targetProposalId, voteTypeIndex[vote]],
        });
        return { request: simulation.request, result: undefined };
      },
      async () => context.client.readContract({
        address: context.address,
        abi: daoGovernanceAbi,
        functionName: "hasVoted",
        args: [targetProposalId, context.wallet],
      }),
    );
  }, [ensureWriteContext, submitWrite]);

  const finalizeProposal = useCallback(async (targetProposalId: bigint) => {
    const context = ensureWriteContext();
    return submitWrite(
      async () => {
        const simulation = await context.client.simulateContract({
          account: context.wallet,
          address: context.address,
          abi: daoGovernanceAbi,
          functionName: "finalizeProposal",
          args: [targetProposalId],
        });
        return { request: simulation.request, result: undefined };
      },
      async () => {
        const stateIndex = await context.client.readContract({
          address: context.address,
          abi: daoGovernanceAbi,
          functionName: "proposalState",
          args: [targetProposalId],
        });
        return stateIndex !== 1 && stateIndex !== 2;
      },
    );
  }, [ensureWriteContext, submitWrite]);

  const executeProposal = useCallback(async (targetProposalId: bigint) => {
    const context = ensureWriteContext();
    return submitWrite(
      async () => {
        const simulation = await context.client.simulateContract({
          account: context.wallet,
          address: context.address,
          abi: daoGovernanceAbi,
          functionName: "executeProposal",
          args: [targetProposalId],
        });
        return { request: simulation.request, result: undefined };
      },
      async () => {
        const [stateIndex, proposal] = await Promise.all([
          context.client.readContract({
            address: context.address,
            abi: daoGovernanceAbi,
            functionName: "proposalState",
            args: [targetProposalId],
          }),
          context.client.readContract({
            address: context.address,
            abi: daoGovernanceAbi,
            functionName: "getProposal",
            args: [targetProposalId],
          }),
        ]);
        return proposal.executed && proposal.approved
          && proposal.proposedMinimumRemainingValidity === await context.client.readContract({
            address: context.address,
            abi: daoGovernanceAbi,
            functionName: "minimumRemainingValidity",
          })
          && proposalStateByIndex[Number(stateIndex)] === "executed";
      },
    );
  }, [ensureWriteContext, submitWrite]);

  const performProtectedAction = useCallback(async () => {
    const context = ensureWriteContext();
    const currentCount = await context.client.readContract({
      address: context.address,
      abi: daoGovernanceAbi,
      functionName: "protectedActionCount",
      args: [context.wallet],
    });
    return submitWrite(
      async () => {
        const simulation = await context.client.simulateContract({
          account: context.wallet,
          address: context.address,
          abi: daoGovernanceAbi,
          functionName: "performProtectedAction",
        });
        return { request: simulation.request, result: currentCount };
      },
      async (previousCount) => context.client.readContract({
        address: context.address,
        abi: daoGovernanceAbi,
        functionName: "protectedActionCount",
        args: [context.wallet],
      }).then((count) => count === previousCount + 1n),
    );
  }, [ensureWriteContext, submitWrite]);

  return {
    state,
    snapshot: snapshotQuery.data,
    error: snapshotQuery.error,
    isLoading: state === "checking",
    isVerifiedMember: snapshotQuery.data?.isVerifiedMember,
    proposal: snapshotQuery.data?.proposal,
    transaction,
    isSubmitting: ["simulating", "awaiting-signature", "submitted", "confirming"].includes(transaction.state),
    createProposal,
    castVote,
    finalizeProposal,
    executeProposal,
    performProtectedAction,
    refetch: snapshotQuery.refetch,
  };
}
