import type { Address, PublicClient } from "viem";
import { parseAbiItem } from "viem";
import { daoGovernanceAbi } from "@/lib/contracts/abis";
import type {
  GovernanceProposal,
  GovernanceProposalState,
  GovernanceSnapshot,
} from "@/lib/protocol/types";

const proposalStateByIndex: readonly (GovernanceProposalState | undefined)[] = [
  undefined,
  "pending",
  "active",
  "succeeded",
  "rejected",
  "expired",
  "executed",
];

const proposalCreatedEvent = parseAbiItem(
  "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, uint64 startAt, uint64 deadline, uint64 executionDeadline, uint64 proposedMinimumRemainingValidity, string contentReference)",
);

interface ProposalTuple {
  proposer: Address;
  contentReference: string;
  createdAt: bigint;
  startAt: bigint;
  deadline: bigint;
  executionDeadline: bigint;
  proposedMinimumRemainingValidity: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  finalized: boolean;
  approved: boolean;
  executed: boolean;
}

export async function readGovernanceSnapshot(
  client: PublicClient,
  address: Address,
  wallet?: Address,
  proposalId?: bigint,
): Promise<GovernanceSnapshot> {
  const [votingPeriod, quorum, executionWindow, minimumRemainingValidity, nextProposalId] = await Promise.all([
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "votingPeriod" }),
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "quorum" }),
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "executionWindow" }),
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "minimumRemainingValidity" }),
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "nextProposalId" }),
  ]);

  const [isVerifiedMember, protectedActionCount] = wallet
    ? await Promise.all([
        client.readContract({
          address,
          abi: daoGovernanceAbi,
          functionName: "isVerifiedMember",
          args: [wallet],
        }),
        client.readContract({
          address,
          abi: daoGovernanceAbi,
          functionName: "protectedActionCount",
          args: [wallet],
        }),
      ])
    : [undefined, undefined];

  let proposal: GovernanceProposal | undefined;
  if (proposalId !== undefined) {
    const [rawProposal, stateIndex, voteCounts, walletHasVoted] = await Promise.all([
      client.readContract({ address, abi: daoGovernanceAbi, functionName: "getProposal", args: [proposalId] }),
      client.readContract({ address, abi: daoGovernanceAbi, functionName: "proposalState", args: [proposalId] }),
      client.readContract({ address, abi: daoGovernanceAbi, functionName: "proposalVoteCounts", args: [proposalId] }),
      wallet
        ? client.readContract({
            address,
            abi: daoGovernanceAbi,
            functionName: "hasVoted",
            args: [proposalId, wallet],
          })
        : Promise.resolve(undefined),
    ]);
    const details = rawProposal as unknown as ProposalTuple;
    const state = proposalStateByIndex[Number(stateIndex)];
    if (!state) throw new Error(`Unknown governance proposal state ${String(stateIndex)}.`);
    const [forVotes, againstVotes, abstainVotes] = voteCounts;
    proposal = {
      id: proposalId,
      proposer: details.proposer,
      contentReference: details.contentReference,
      createdAt: details.createdAt,
      startAt: details.startAt,
      deadline: details.deadline,
      executionDeadline: details.executionDeadline,
      proposedMinimumRemainingValidity: details.proposedMinimumRemainingValidity,
      forVotes,
      againstVotes,
      abstainVotes,
      finalized: details.finalized,
      approved: details.approved,
      executed: details.executed,
      state,
      walletHasVoted,
    };
  }

  return {
    votingPeriod,
    quorum,
    executionWindow,
    minimumRemainingValidity,
    nextProposalId,
    isVerifiedMember,
    protectedActionCount,
    proposal,
  };
}

export async function readGovernanceProposalIds(
  client: PublicClient,
  address: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<bigint[]> {
  const logs = await client.getLogs({
    address,
    event: proposalCreatedEvent,
    fromBlock,
    toBlock,
  });
  return logs.flatMap((log) => (typeof log.args.proposalId === "bigint" ? [log.args.proposalId] : []));
}
