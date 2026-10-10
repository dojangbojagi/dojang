import {
  keccak256,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
} from "viem";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { projectContracts } from "@/lib/config/contracts";
import {
  controlledTokenAbi,
  credentialRegistryAbi,
  eligibilityVerifierAdapterAbi,
  lendingPoolAbi,
  restrictedVaultAbi,
} from "@/lib/contracts/abis";
import { ProtocolError } from "@/lib/protocol/types";

export type EvidenceContractName =
  | "credentialRegistry"
  | "proofVerifier"
  | "restrictedVault"
  | "lendingPool"
  | "honkVerifier"
  | "lendingAsset"
  | "collateralAsset";

export interface ContractCodeEvidence {
  name: EvidenceContractName;
  address?: Address;
  configuredBy: "environment" | "on-chain" | "unconfigured";
  codeState: "unconfigured" | "no-code" | "present";
  runtimeCodeHash?: Hex;
}

export interface ContractDependencyEvidence {
  from: "proofVerifier" | "restrictedVault" | "lendingPool";
  relation: "honkVerifier" | "registry" | "verifier" | "lendingAsset" | "collateralAsset";
  address: Address;
  matchesConfiguredAddress?: boolean;
}

export interface ProjectDeploymentEvidence {
  chainId: number;
  contracts: readonly ContractCodeEvidence[];
  dependencies: readonly ContractDependencyEvidence[];
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
];

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
        });
      }
      if (hasCode) codeByAddress.set(honkVerifier.toLowerCase(), code!);
    } catch {
      // A contract at the configured address may be the wrong ABI or version.
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
      // Keep the configured code evidence even if an address does not expose this ABI.
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
        });
        if (hasCode) codeByAddress.set(address.toLowerCase(), code!);
      }
    } catch {
      // The lending pool may not be deployed or may not match the expected ABI.
    }
  }

  return { chainId, contracts, dependencies };
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
  if (fromBlock < 0n || toBlock < fromBlock || chunkSize < 1n || chunkSize > 10_000n) {
    throw new RangeError("Use an ordered non-negative block range and a chunk size from 1 to 10,000.");
  }

  const deployment = await inspectProjectDeployment(client);
  const contracts = deployment.contracts.filter(
    (entry): entry is ContractCodeEvidence & { address: Address } => entry.codeState === "present" && Boolean(entry.address),
  );
  const events: ProjectEventLog[] = [];

  for (const contract of contracts) {
    let start = fromBlock;
    while (start <= toBlock) {
      const end = start + chunkSize - 1n < toBlock ? start + chunkSize - 1n : toBlock;
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
    case "restrictedVault": return restrictedVaultAbi;
    case "lendingPool": return lendingPoolAbi;
    case "lendingAsset":
    case "collateralAsset": return controlledTokenAbi;
    default: return undefined;
  }
}
