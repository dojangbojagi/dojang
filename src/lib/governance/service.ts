import type { Address, PublicClient } from "viem";
import { parseAbiItem } from "viem";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { daoGovernanceAbi } from "@/lib/contracts/abis";
import { ProtocolError } from "@/lib/protocol/types";
import type {
  GovernanceProposalPage,
  GovernanceProposalPageResult,
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

const MAX_PROPOSAL_PAGE_SIZE = 50;
const DEFAULT_PROPOSAL_PAGE_SIZE = 20;
const PROPOSAL_DETAIL_CONCURRENCY = 5;
const MAX_PROPOSAL_EVENT_RANGE = 100_000n;
const DEFAULT_PROPOSAL_EVENT_CHUNK_SIZE = 1_000n;
const MAX_PROPOSAL_EVENT_CHUNK_SIZE = 10_000n;

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

interface GovernanceSettings {
  votingPeriod: bigint;
  quorum: bigint;
  executionWindow: bigint;
  minimumRemainingValidity: bigint;
  nextProposalId: bigint;
}

async function readGovernanceSettings(
  client: PublicClient,
  address: Address,
): Promise<GovernanceSettings> {
  const [votingPeriod, quorum, executionWindow, minimumRemainingValidity, nextProposalId] = await Promise.all([
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "votingPeriod" }),
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "quorum" }),
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "executionWindow" }),
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "minimumRemainingValidity" }),
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "nextProposalId" }),
  ]);
  return { votingPeriod, quorum, executionWindow, minimumRemainingValidity, nextProposalId };
}

async function requireGiwaChain(client: PublicClient): Promise<void> {
  const chainId = await client.getChainId();
  if (chainId !== GIWA_CHAIN_ID) {
    throw new ProtocolError(
      "WRONG_NETWORK",
      `Governance reads require GIWA Sepolia (chain ${GIWA_CHAIN_ID}); RPC reports chain ${chainId}.`,
    );
  }
}

async function readProposalDetails(
  client: PublicClient,
  address: Address,
  proposalId: bigint,
  wallet?: Address,
): Promise<GovernanceProposal> {
  const [rawProposal, stateIndex, voteCounts, walletHasVoted] = await Promise.all([
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "getProposal", args: [proposalId] }),
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "proposalState", args: [proposalId] }),
    client.readContract({ address, abi: daoGovernanceAbi, functionName: "proposalVoteCounts", args: [proposalId] }),
    wallet
      ? client.readContract({ address, abi: daoGovernanceAbi, functionName: "hasVoted", args: [proposalId, wallet] })
      : Promise.resolve(undefined),
  ]);
  const details = rawProposal as unknown as ProposalTuple;
  const state = proposalStateByIndex[Number(stateIndex)];
  if (!state) throw new Error(`Unknown governance proposal state ${String(stateIndex)}.`);
  const [forVotes, againstVotes, abstainVotes] = voteCounts;

  return {
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

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function readGovernanceSnapshot(
  client: PublicClient,
  address: Address,
  wallet?: Address,
  proposalId?: bigint,
): Promise<GovernanceSnapshot> {
  const settings = await readGovernanceSettings(client, address);

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

  const proposal = proposalId === undefined
    ? undefined
    : await readProposalDetails(client, address, proposalId, wallet);

  return {
    votingPeriod: settings.votingPeriod,
    quorum: settings.quorum,
    executionWindow: settings.executionWindow,
    minimumRemainingValidity: settings.minimumRemainingValidity,
    nextProposalId: settings.nextProposalId,
    isVerifiedMember,
    protectedActionCount,
    proposal,
  };
}

/**
 * Reads a descending page from the contract's monotonic proposal IDs. `beforeId` is
 * exclusive; pass the returned `nextCursor` to fetch the next page. Reads are bounded
 * to at most 50 proposals and five concurrent proposal-detail reads.
 */
export async function readGovernanceProposalPage(
  client: PublicClient,
  address: Address,
  input: { beforeId?: bigint; pageSize?: number; wallet?: Address } = {},
): Promise<GovernanceProposalPageResult> {
  await requireGiwaChain(client);

  const pageSize = input.pageSize ?? DEFAULT_PROPOSAL_PAGE_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PROPOSAL_PAGE_SIZE) {
    throw new RangeError(`Proposal page size must be an integer from 1 to ${MAX_PROPOSAL_PAGE_SIZE}.`);
  }

  const code = await client.getBytecode({ address });
  if (!code || code === "0x") return { state: "no-code" };

  const settings = await readGovernanceSettings(client, address);
  const totalProposals = settings.nextProposalId > 0n ? settings.nextProposalId - 1n : 0n;
  const highestId = totalProposals;
  const exclusiveUpperBound = input.beforeId === undefined
    ? highestId + 1n
    : input.beforeId;
  const lastId = exclusiveUpperBound - 1n < highestId ? exclusiveUpperBound - 1n : highestId;
  const ids: bigint[] = [];
  for (let id = lastId; id > 0n && ids.length < pageSize; id -= 1n) ids.push(id);

  const proposals = await mapWithConcurrency(ids, PROPOSAL_DETAIL_CONCURRENCY, (id) =>
    readProposalDetails(client, address, id, input.wallet),
  );
  const page: GovernanceProposalPage = {
    proposals,
    totalProposals,
    nextCursor: ids.length === pageSize && ids.at(-1)! > 1n ? ids.at(-1) : undefined,
    votingPeriod: settings.votingPeriod,
    quorum: settings.quorum,
    executionWindow: settings.executionWindow,
    minimumRemainingValidity: settings.minimumRemainingValidity,
  };
  return { state: "ready", page };
}

export async function readGovernanceProposalIds(
  client: PublicClient,
  address: Address,
  fromBlock: bigint,
  toBlock: bigint,
  blockChunkSize = DEFAULT_PROPOSAL_EVENT_CHUNK_SIZE,
): Promise<bigint[]> {
  await requireGiwaChain(client);
  if (
    fromBlock < 0n ||
    toBlock < fromBlock ||
    toBlock - fromBlock + 1n > MAX_PROPOSAL_EVENT_RANGE ||
    blockChunkSize < 1n ||
    blockChunkSize > MAX_PROPOSAL_EVENT_CHUNK_SIZE
  ) {
    throw new RangeError(
      `Use an ordered block range of at most ${MAX_PROPOSAL_EVENT_RANGE} blocks and a chunk size from 1 to ${MAX_PROPOSAL_EVENT_CHUNK_SIZE}.`,
    );
  }

  const proposalIds = new Set<bigint>();
  for (let start = fromBlock; start <= toBlock;) {
    const end = start + blockChunkSize - 1n < toBlock ? start + blockChunkSize - 1n : toBlock;
    const logs = await client.getLogs({
      address,
      event: proposalCreatedEvent,
      fromBlock: start,
      toBlock: end,
    });
    for (const log of logs) {
      if (typeof log.args.proposalId === "bigint") proposalIds.add(log.args.proposalId);
    }
    start = end + 1n;
  }
  return [...proposalIds].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}
