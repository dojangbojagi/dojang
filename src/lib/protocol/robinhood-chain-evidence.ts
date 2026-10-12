import {
  decodeEventLog,
  isHash,
  keccak256,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
} from "viem";
import { robinhoodContracts } from "@/lib/config/contracts";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";
import {
  controlledTestOracleAbi,
  controlledTokenAbi,
  credentialRegistryAbi,
  robinhoodGovernanceAbi,
  eligibilityVerifierAdapterAbi,
  lendingPoolV2Abi,
} from "@/lib/contracts/abis";
import { ProtocolError } from "@/lib/protocol/types";

const MAX_LOG_RANGE = 100_000n;
const LOG_CHUNK_SIZE = 2_000n;

export type RobinhoodContractKey = keyof typeof robinhoodContracts;

export interface RobinhoodCodeEvidence {
  name: RobinhoodContractKey;
  address?: Address;
  state: "unconfigured" | "no-code" | "code-present";
  runtimeCodeHash?: Hex;
  explorerUrl?: string;
}

export interface RobinhoodEventEvidence {
  contract: RobinhoodContractKey;
  address: Address;
  eventName?: string;
  blockNumber: bigint | null;
  transactionHash: Hash | null;
  logIndex: number | null;
  topics: readonly Hex[];
  data: Hex;
  explorerUrl?: string;
}

export interface RobinhoodTransactionEvidence {
  chainId: number;
  transactionHash: Hash;
  blockNumber: bigint;
  from: Address;
  to: Address | null;
  status: "success" | "reverted";
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  explorerUrl: string;
  projectEvents: readonly RobinhoodEventEvidence[];
}

const addresses = Object.entries(robinhoodContracts) as [RobinhoodContractKey, Address | undefined][];
const eventAbiByContract = {
  credentialRegistry: credentialRegistryAbi,
  verifierAdapter: eligibilityVerifierAdapterAbi,
  lendingV2Oracle: controlledTestOracleAbi,
  lendingV2Asset: controlledTokenAbi,
  lendingV2Collateral: controlledTokenAbi,
  lendingV2Pool: lendingPoolV2Abi,
  governance: robinhoodGovernanceAbi,
} as const;

function addressUrl(address: Address): string {
  return `${ROBINHOOD_TESTNET_EXPLORER_URL}/address/${address}`;
}

function transactionUrl(hash: Hash): string {
  return `${ROBINHOOD_TESTNET_EXPLORER_URL}/tx/${hash}`;
}

async function requireRobinhood(client: PublicClient): Promise<number> {
  const chainId = await client.getChainId();
  if (chainId !== ROBINHOOD_TESTNET_CHAIN_ID) {
    throw new ProtocolError(
      "WRONG_NETWORK",
      `Robinhood evidence requires chain ${ROBINHOOD_TESTNET_CHAIN_ID}; RPC reports chain ${chainId}.`,
    );
  }
  return chainId;
}

/** Reads code only from configured Robinhood addresses, on a verified 46630 RPC. */
export async function inspectRobinhoodContracts(client: PublicClient): Promise<readonly RobinhoodCodeEvidence[]> {
  await requireRobinhood(client);
  return Promise.all(addresses.map(async ([name, address]) => {
    if (!address) return { name, state: "unconfigured" } as const;
    const code = await client.getBytecode({ address });
    if (!code || code === "0x") return { name, address, state: "no-code", explorerUrl: addressUrl(address) } as const;
    return {
      name,
      address,
      state: "code-present",
      runtimeCodeHash: keccak256(code),
      explorerUrl: addressUrl(address),
    } as const;
  }));
}

function matchingConfiguredContract(address: Address): RobinhoodContractKey | undefined {
  return addresses.find(([, configured]) => configured?.toLowerCase() === address.toLowerCase())?.[0];
}

function decodeEvent(contract: RobinhoodContractKey, log: { topics: readonly Hex[]; data: Hex }): string | undefined {
  const abi = eventAbiByContract[contract as keyof typeof eventAbiByContract];
  if (!abi) return undefined;
  try {
    return decodeEventLog({ abi, topics: log.topics as [Hex, ...Hex[]], data: log.data, strict: false }).eventName;
  } catch {
    return undefined;
  }
}

function makeEvent(log: {
  address: Address;
  blockNumber: bigint | null;
  transactionHash: Hash | null;
  logIndex: number | null;
  topics: readonly Hex[];
  data: Hex;
}): RobinhoodEventEvidence | undefined {
  const contract = matchingConfiguredContract(log.address);
  if (!contract) return undefined;
  return {
    contract,
    address: log.address,
    eventName: decodeEvent(contract, log),
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    topics: log.topics,
    data: log.data,
    explorerUrl: log.transactionHash ? transactionUrl(log.transactionHash) : undefined,
  };
}

/** Reads a Robinhood receipt and identifies only logs emitted by configured project-owned addresses. */
export async function readRobinhoodTransactionEvidence(
  client: PublicClient,
  value: string,
): Promise<RobinhoodTransactionEvidence> {
  const chainId = await requireRobinhood(client);
  if (!isHash(value)) throw new ProtocolError("RPC_ERROR", "Enter a valid 0x transaction hash.");
  const transactionHash = value as Hash;
  const receipt = await client.getTransactionReceipt({ hash: transactionHash });
  const transaction = await client.getTransaction({ hash: transactionHash });
  const projectEvents = receipt.logs.flatMap((log) => {
    const event = makeEvent(log);
    return event ? [event] : [];
  });
  return {
    chainId,
    transactionHash,
    blockNumber: receipt.blockNumber,
    from: transaction.from,
    to: transaction.to,
    status: receipt.status === "success" ? "success" : "reverted",
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
    explorerUrl: transactionUrl(transactionHash),
    projectEvents,
  };
}

/** Scans configured Robinhood V2 addresses in small bounded chunks and rejects future block ranges. */
export async function scanRobinhoodProjectEvents(
  client: PublicClient,
  input: { fromBlock: bigint; toBlock: bigint },
): Promise<readonly RobinhoodEventEvidence[]> {
  await requireRobinhood(client);
  if (input.fromBlock < 0n || input.toBlock < input.fromBlock) {
    throw new ProtocolError("RPC_ERROR", "The last block must not be before the first block.");
  }
  if (input.toBlock - input.fromBlock + 1n > MAX_LOG_RANGE) {
    throw new ProtocolError("RPC_ERROR", "At most 100,000 blocks may be scanned per request.");
  }
  const latest = await client.getBlockNumber();
  if (input.toBlock > latest) {
    throw new ProtocolError("RPC_ERROR", `The requested end block is ahead of the latest Robinhood block ${latest}.`);
  }

  const configured = addresses.filter(([key, address]) => address && key in eventAbiByContract) as [keyof typeof eventAbiByContract, Address][];
  const result: RobinhoodEventEvidence[] = [];
  for (const [contract, address] of configured) {
    for (let fromBlock = input.fromBlock; fromBlock <= input.toBlock; fromBlock += LOG_CHUNK_SIZE) {
      const toBlock = fromBlock + LOG_CHUNK_SIZE - 1n > input.toBlock
        ? input.toBlock
        : fromBlock + LOG_CHUNK_SIZE - 1n;
      const logs = await client.getLogs({ address, fromBlock, toBlock });
      for (const log of logs) {
        const event = makeEvent(log);
        if (event) result.push(event);
      }
    }
  }
  return result.sort((left, right) => {
    const blockOrder = (left.blockNumber ?? 0n) - (right.blockNumber ?? 0n);
    if (blockOrder !== 0n) return blockOrder < 0n ? -1 : 1;
    return (left.logIndex ?? 0) - (right.logIndex ?? 0);
  });
}
