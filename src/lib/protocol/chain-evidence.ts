import {
  keccak256,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
} from "viem";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { officialDojang, projectContracts } from "@/lib/config/contracts";
import {
  controlledTokenAbi,
  credentialRegistryAbi,
  daoGovernanceAbi,
  eligibilityVerifierAdapterAbi,
  lendingPoolAbi,
  restrictedVaultAbi,
} from "@/lib/contracts/abis";
import { ProtocolError } from "@/lib/protocol/types";

const MAX_EVIDENCE_LOG_RANGE = 100_000n;

export type EvidenceContractName =
  | "credentialRegistry"
  | "proofVerifier"
  | "restrictedVault"
  | "lendingPool"
  | "daoGovernance"
  | "honkVerifier"
  | "lendingAsset"
  | "collateralAsset";

export interface ContractCodeEvidence {
  name: EvidenceContractName;
  address?: Address;
  configuredBy: "environment" | "on-chain" | "unconfigured";
  codeState: "unconfigured" | "no-code" | "present";
  runtimeCodeHash?: Hex;
  explorerUrl?: string;
}

export interface ContractDependencyEvidence {
  from: "proofVerifier" | "restrictedVault" | "lendingPool" | "daoGovernance";
  relation:
    | "honkVerifier"
    | "registry"
    | "verifier"
    | "lendingAsset"
    | "collateralAsset"
    | "dojangScroll"
    | "attesterBook"
    | "eas";
  address: Address;
  matchesConfiguredAddress?: boolean;
}

export interface ProjectDeploymentEvidence {
  chainId: number;
  contracts: readonly ContractCodeEvidence[];
  dependencies: readonly ContractDependencyEvidence[];
  discoveryWarnings: readonly {
    contract: EvidenceContractName;
    reason: "read-failed";
  }[];
}

export interface ProjectEventLog {
  contract: EvidenceContractName;
  address: Address;
  blockNumber: bigint | null;
  transactionHash: Hash | null;
  transactionIndex: number | null;
  logIndex: number | null;
  topics: readonly Hex[];
  data: Hex;
  explorerUrl?: string;
}

export interface ProjectTransactionEvidence {
  chainId: number;
  transactionHash: Hash;
  blockNumber: bigint;
  from: Address;
  to: Address | null;
  status: "success" | "reverted";
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  explorerUrl: string;
  projectEvents: readonly ProjectEventLog[];
}

const configuredAddresses: ReadonlyArray<{
  name: EvidenceContractName;
  address?: Address;
}> = [
  { name: "credentialRegistry", address: projectContracts.credentialRegistry },
  { name: "proofVerifier", address: projectContracts.proofVerifier },
  { name: "restrictedVault", address: projectContracts.restrictedVault },
  { name: "lendingPool", address: projectContracts.lendingPool },
  { name: "daoGovernance", address: projectContracts.daoGovernance },
];

function addressExplorerUrl(address: Address): string {
  return `${GIWA_EXPLORER_URL}/address/${address}`;
}

function transactionExplorerUrl(hash: Hash): string {
  return `${GIWA_EXPLORER_URL}/tx/${hash}`;
}

function addDependency(
  dependencies: ContractDependencyEvidence[],
  dependency: ContractDependencyEvidence,
) {
  dependencies.push(dependency);
}

function sameAddress(left?: Address, right?: Address): boolean | undefined {
  if (!left || !right) return undefined;
  return left.toLowerCase() === right.toLowerCase();
}

function makeEventLog(
  contract: EvidenceContractName,
  log: {
    address: Address;
    blockNumber: bigint | null;
    transactionHash: Hash | null;
    transactionIndex: number | null;
    logIndex: number | null;
    topics: readonly Hex[];
    data: Hex;
  },
): ProjectEventLog {
  return {
    contract,
    address: log.address,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    logIndex: log.logIndex,
    topics: log.topics,
    data: log.data,
    explorerUrl: log.transactionHash ? transactionExplorerUrl(log.transactionHash) : undefined,
  };
}

async function requireGiwaChain(client: PublicClient): Promise<number> {
  const chainId = await client.getChainId();
  if (chainId !== GIWA_CHAIN_ID) {
    throw new ProtocolError(
      "WRONG_NETWORK",
      `Evidence reads require GIWA Sepolia (chain ${GIWA_CHAIN_ID}); RPC reports chain ${chainId}.`,
    );
  }
  return chainId;
}

/** Reads only configured project addresses and their on-chain constructor links. */
export async function inspectProjectDeployment(
  client: PublicClient,
): Promise<ProjectDeploymentEvidence> {
  const chainId = await requireGiwaChain(client);
  const contracts: ContractCodeEvidence[] = [];
  const dependencies: ContractDependencyEvidence[] = [];
  const discoveryWarnings: ProjectDeploymentEvidence["discoveryWarnings"][number][] = [];
  const codeByAddress = new Map<string, Hex>();
  const configuredByName = new Map(configuredAddresses.map(({ name, address }) => [name, address]));

  for (const { name, address } of configuredAddresses) {
    if (!address) {
      contracts.push({ name, configuredBy: "unconfigured", codeState: "unconfigured" });
      continue;
    }

    const code = await client.getBytecode({ address });
    if (code && code !== "0x") codeByAddress.set(address.toLowerCase(), code);
    contracts.push({
      name,
      address,
      configuredBy: "environment",
      codeState: code && code !== "0x" ? "present" : "no-code",
      runtimeCodeHash: code && code !== "0x" ? keccak256(code) : undefined,
      explorerUrl: addressExplorerUrl(address),
    });
  }

  const isConfiguredContractLive = (name: EvidenceContractName) => {
    const address = configuredByName.get(name);
    return Boolean(address && codeByAddress.has(address.toLowerCase()));
  };

  const registry = projectContracts.credentialRegistry;
  const verifier = projectContracts.proofVerifier;
  const vault = projectContracts.restrictedVault;
  const pool = projectContracts.lendingPool;
  const dao = projectContracts.daoGovernance;

  if (verifier && isConfiguredContractLive("proofVerifier")) {
    try {
      const honkVerifier = await client.readContract({
        address: verifier,
        abi: eligibilityVerifierAdapterAbi,
        functionName: "honkVerifier",
      });
      addDependency(dependencies, {
        from: "proofVerifier",
        relation: "honkVerifier",
        address: honkVerifier,
      });
      const code = await client.getBytecode({ address: honkVerifier });
      const hasCode = Boolean(code && code !== "0x");
      if (!contracts.some((entry) => entry.name === "honkVerifier")) {
        contracts.push({
          name: "honkVerifier",
          address: honkVerifier,
          configuredBy: "on-chain",
          codeState: hasCode ? "present" : "no-code",
          runtimeCodeHash: hasCode ? keccak256(code!) : undefined,
          explorerUrl: addressExplorerUrl(honkVerifier),
        });
      }
      if (hasCode) codeByAddress.set(honkVerifier.toLowerCase(), code!);
    } catch {
      discoveryWarnings.push({ contract: "proofVerifier", reason: "read-failed" });
    }
  }

  if (vault && isConfiguredContractLive("restrictedVault")) {
    try {
      const [actualRegistry, actualVerifier] = await Promise.all([
        client.readContract({ address: vault, abi: restrictedVaultAbi, functionName: "registry" }),
        client.readContract({ address: vault, abi: restrictedVaultAbi, functionName: "verifier" }),
      ]);
      addDependency(dependencies, {
        from: "restrictedVault",
        relation: "registry",
        address: actualRegistry,
        matchesConfiguredAddress: sameAddress(actualRegistry, registry),
      });
      addDependency(dependencies, {
        from: "restrictedVault",
        relation: "verifier",
        address: actualVerifier,
        matchesConfiguredAddress: sameAddress(actualVerifier, verifier),
      });
    } catch {
      discoveryWarnings.push({ contract: "restrictedVault", reason: "read-failed" });
    }
  }

  if (pool && isConfiguredContractLive("lendingPool")) {
    try {
      const [actualRegistry, actualVerifier, lendingAsset, collateralAsset] = await Promise.all([
        client.readContract({ address: pool, abi: lendingPoolAbi, functionName: "registry" }),
        client.readContract({ address: pool, abi: lendingPoolAbi, functionName: "verifier" }),
        client.readContract({ address: pool, abi: lendingPoolAbi, functionName: "lendingAsset" }),
        client.readContract({ address: pool, abi: lendingPoolAbi, functionName: "collateralAsset" }),
      ]);
      addDependency(dependencies, {
        from: "lendingPool",
        relation: "registry",
        address: actualRegistry,
        matchesConfiguredAddress: sameAddress(actualRegistry, registry),
      });
      addDependency(dependencies, {
        from: "lendingPool",
        relation: "verifier",
        address: actualVerifier,
        matchesConfiguredAddress: sameAddress(actualVerifier, verifier),
      });
      addDependency(dependencies, { from: "lendingPool", relation: "lendingAsset", address: lendingAsset });
      addDependency(dependencies, { from: "lendingPool", relation: "collateralAsset", address: collateralAsset });

      for (const [name, address] of [
        ["lendingAsset", lendingAsset],
        ["collateralAsset", collateralAsset],
      ] as const) {
        const code = await client.getBytecode({ address });
        const hasCode = Boolean(code && code !== "0x");
        contracts.push({
          name,
          address,
          configuredBy: "on-chain",
          codeState: hasCode ? "present" : "no-code",
          runtimeCodeHash: hasCode ? keccak256(code!) : undefined,
          explorerUrl: addressExplorerUrl(address),
        });
        if (hasCode) codeByAddress.set(address.toLowerCase(), code!);
      }
    } catch {
      discoveryWarnings.push({ contract: "lendingPool", reason: "read-failed" });
    }
  }

  if (dao && isConfiguredContractLive("daoGovernance")) {
    try {
      const [dojangScroll, attesterBook, eas] = await Promise.all([
        client.readContract({ address: dao, abi: daoGovernanceAbi, functionName: "dojangScroll" }),
        client.readContract({ address: dao, abi: daoGovernanceAbi, functionName: "attesterBook" }),
        client.readContract({ address: dao, abi: daoGovernanceAbi, functionName: "eas" }),
      ]);
      addDependency(dependencies, {
        from: "daoGovernance",
        relation: "dojangScroll",
        address: dojangScroll,
        matchesConfiguredAddress: sameAddress(dojangScroll, officialDojang.dojangScroll),
      });
      addDependency(dependencies, {
        from: "daoGovernance",
        relation: "attesterBook",
        address: attesterBook,
        matchesConfiguredAddress: sameAddress(attesterBook, officialDojang.dojangAttesterBook),
      });
      addDependency(dependencies, {
        from: "daoGovernance",
        relation: "eas",
        address: eas,
        matchesConfiguredAddress: sameAddress(eas, officialDojang.eas),
      });
    } catch {
      discoveryWarnings.push({ contract: "daoGovernance", reason: "read-failed" });
    }
  }

  return { chainId, contracts, dependencies, discoveryWarnings };
}

/** Fetches an authentic receipt and logs emitted by configured project contracts. */
export async function readProjectTransactionEvidence(
  client: PublicClient,
  hash: Hash,
): Promise<ProjectTransactionEvidence> {
  const chainId = await requireGiwaChain(client);
  const deployment = await inspectProjectDeployment(client);
  const contractByAddress = new Map(
    deployment.contracts
      .filter((entry): entry is ContractCodeEvidence & { address: Address } => Boolean(entry.address))
      .map((entry) => [entry.address.toLowerCase(), entry.name]),
  );
  const receipt = await client.getTransactionReceipt({ hash });

  return {
    chainId,
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    from: receipt.from,
    to: receipt.to,
    status: receipt.status,
    gasUsed: receipt.gasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice,
    explorerUrl: transactionExplorerUrl(receipt.transactionHash),
    projectEvents: receipt.logs.flatMap((log) => {
      const contract = contractByAddress.get(log.address.toLowerCase());
      return contract ? [makeEventLog(contract, log)] : [];
    }),
  };
}

/**
 * Scans logs only for the configured project contracts and the two assets discovered from
 * LendingPool, over the caller's explicit block range. It does not query network-wide stats.
 */
export async function readProjectProtocolLogs(
  client: PublicClient,
  input: { fromBlock: bigint; toBlock: bigint; blockChunkSize?: bigint },
): Promise<readonly ProjectEventLog[]> {
  await requireGiwaChain(client);
  const { fromBlock, toBlock } = input;
  const chunkSize = input.blockChunkSize ?? 1_000n;
  if (
    fromBlock < 0n ||
    toBlock < fromBlock ||
    toBlock - fromBlock + 1n > MAX_EVIDENCE_LOG_RANGE ||
    chunkSize < 1n ||
    chunkSize > 10_000n
  ) {
    throw new RangeError(
      `Use an ordered non-negative range of at most ${MAX_EVIDENCE_LOG_RANGE} blocks and a chunk size from 1 to 10,000.`,
    );
  }

  const latestBlock = await client.getBlockNumber();
  const boundedToBlock = toBlock < latestBlock ? toBlock : latestBlock;
  if (fromBlock > boundedToBlock) return [];

  const deployment = await inspectProjectDeployment(client);
  const contracts = deployment.contracts.filter(
    (entry): entry is ContractCodeEvidence & { address: Address } => entry.codeState === "present" && Boolean(entry.address),
  );
  const events: ProjectEventLog[] = [];

  for (const contract of contracts) {
    let start = fromBlock;
    while (start <= boundedToBlock) {
      const end = start + chunkSize - 1n < boundedToBlock ? start + chunkSize - 1n : boundedToBlock;
      const logs = await client.getLogs({ address: contract.address, fromBlock: start, toBlock: end });
      events.push(...logs.map((log) => makeEventLog(contract.name, log)));
      start = end + 1n;
    }
  }

  return events.sort((left, right) => {
    const blockOrder = (left.blockNumber ?? 0n) - (right.blockNumber ?? 0n);
    if (blockOrder !== 0n) return blockOrder < 0n ? -1 : 1;
    const txOrder = (left.transactionIndex ?? 0) - (right.transactionIndex ?? 0);
    if (txOrder !== 0) return txOrder;
    return (left.logIndex ?? 0) - (right.logIndex ?? 0);
  });
}

/** ABI selector for a project's emitted event; callers can decode using the exported ABIs. */
export function protocolEventAbi(contract: EvidenceContractName) {
  switch (contract) {
    case "credentialRegistry": return credentialRegistryAbi;
    case "daoGovernance": return daoGovernanceAbi;
    case "restrictedVault": return restrictedVaultAbi;
    case "lendingPool": return lendingPoolAbi;
    case "lendingAsset":
    case "collateralAsset": return controlledTokenAbi;
    default: return undefined;
  }
}
