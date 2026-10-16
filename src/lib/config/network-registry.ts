import type { Address, Hash } from "viem";
import { giwaSepolia, GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import {
  invalidContractConfig,
  invalidRobinhoodContractConfig,
  projectContracts,
  robinhoodContracts,
} from "@/lib/config/contracts";
import { robinhoodTestnet, ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";
import {
  robinhoodMainnetDemoChain,
  robinhoodMainnetDemoContracts,
  ROBINHOOD_MAINNET_CHAIN_ID,
  ROBINHOOD_MAINNET_DEMO_EXPLORER_URL,
} from "@/lib/config/robinhood-mainnet-demo";
import { robinhoodMainnetPhase2Contracts } from "@/lib/config/contracts";

export const supportedProtocolChains = [robinhoodTestnet, giwaSepolia, robinhoodMainnetDemoChain] as const;
export const primaryProtocolChainId = ROBINHOOD_TESTNET_CHAIN_ID;
export type SupportedProtocolChainId = typeof GIWA_CHAIN_ID | typeof ROBINHOOD_TESTNET_CHAIN_ID | typeof ROBINHOOD_MAINNET_CHAIN_ID;

export interface DaoPhase2ContractSet {
  chainId: typeof ROBINHOOD_TESTNET_CHAIN_ID | typeof ROBINHOOD_MAINNET_CHAIN_ID;
  explorerUrl: string;
  governance?: Address;
  reputationRegistry?: Address;
  credentialRegistry?: Address;
  verifier?: Address;
  lendingPool?: Address;
  phase2DeploymentPending: boolean;
}

/** Returns only the Phase 2 contract addresses assigned to the requested chain. */
export function getDaoPhase2ContractSet(chainId: number): DaoPhase2ContractSet | undefined {
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) {
    const governance = robinhoodContracts.phase2Governance;
    const reputationRegistry = robinhoodContracts.phase2ReputationRegistry;
    const credentialRegistry = robinhoodContracts.credentialRegistry;
    const verifier = robinhoodContracts.verifierAdapter;
    const lendingPool = robinhoodContracts.lendingV2Pool;
    if (!credentialRegistry || !verifier || !lendingPool) return undefined;
    return {
      chainId: ROBINHOOD_TESTNET_CHAIN_ID,
      explorerUrl: ROBINHOOD_TESTNET_EXPLORER_URL,
      governance,
      reputationRegistry,
      credentialRegistry,
      verifier,
      lendingPool,
      phase2DeploymentPending: false,
    };
  }
  if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) {
    return {
      chainId: ROBINHOOD_MAINNET_CHAIN_ID,
      explorerUrl: ROBINHOOD_MAINNET_DEMO_EXPLORER_URL,
      governance: robinhoodMainnetPhase2Contracts.governance,
      reputationRegistry: robinhoodMainnetPhase2Contracts.reputationRegistry,
      credentialRegistry: robinhoodMainnetDemoContracts.credentialRegistry,
      verifier: robinhoodMainnetDemoContracts.verifierAdapter,
      lendingPool: robinhoodMainnetDemoContracts.lendingPool,
      phase2DeploymentPending: !robinhoodMainnetPhase2Contracts.governance || !robinhoodMainnetPhase2Contracts.reputationRegistry,
    };
  }
  return undefined;
}

export interface LendingV2ContractSet {
  chainId: SupportedProtocolChainId;
  explorerUrl: string;
  pool?: Address;
  credentialRegistry?: Address;
  verifierAdapter?: Address;
  oracle?: Address;
  verifierDependencies: readonly (Address | undefined)[];
  configuredAssets: readonly Address[];
  invalidConfigNames: readonly string[];
  missingRequiredConfigNames: readonly string[];
}

/** Resolves only addresses explicitly configured for the requested network; it never falls back across chains. */
export function getLendingV2ContractSet(chainId: number): LendingV2ContractSet | undefined {
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID) {
    return {
      chainId: ROBINHOOD_TESTNET_CHAIN_ID,
      explorerUrl: ROBINHOOD_TESTNET_EXPLORER_URL,
      pool: robinhoodContracts.lendingV2Pool,
      credentialRegistry: robinhoodContracts.credentialRegistry,
      verifierAdapter: robinhoodContracts.verifierAdapter,
      oracle: robinhoodContracts.lendingV2Oracle,
      verifierDependencies: [robinhoodContracts.zkTranscriptLib, robinhoodContracts.relationsLib, robinhoodContracts.honkVerifier],
      configuredAssets: [robinhoodContracts.lendingV2Asset, robinhoodContracts.lendingV2Collateral].filter(
        (address): address is Address => Boolean(address),
      ),
      invalidConfigNames: invalidRobinhoodContractConfig,
      missingRequiredConfigNames: Object.entries({
        lendingV2Pool: robinhoodContracts.lendingV2Pool,
        credentialRegistry: robinhoodContracts.credentialRegistry,
        verifierAdapter: robinhoodContracts.verifierAdapter,
        honkVerifier: robinhoodContracts.honkVerifier,
        lendingV2Oracle: robinhoodContracts.lendingV2Oracle,
        lendingV2Asset: robinhoodContracts.lendingV2Asset,
        lendingV2Collateral: robinhoodContracts.lendingV2Collateral,
      }).filter(([, address]) => !address).map(([name]) => name),
    };
  }
  if (chainId === GIWA_CHAIN_ID) {
    return {
      chainId: GIWA_CHAIN_ID,
      explorerUrl: GIWA_EXPLORER_URL,
      pool: projectContracts.lendingPoolV2,
      credentialRegistry: projectContracts.credentialRegistry,
      verifierAdapter: projectContracts.proofVerifier,
      verifierDependencies: [],
      oracle: undefined,
      configuredAssets: [],
      invalidConfigNames: invalidContractConfig,
      missingRequiredConfigNames: [],
    };
  }
  return undefined;
}

export interface DeploymentReceiptReference {
  transactionHash: Hash;
  blockNumber: bigint;
}

/** Kept empty until deployment receipts are confirmed and recorded from their chain. */
export const deploymentReceiptRegistry: Readonly<Record<number, Readonly<Record<string, DeploymentReceiptReference>>>> = {
  [GIWA_CHAIN_ID]: {},
  [ROBINHOOD_TESTNET_CHAIN_ID]: {},
};

export function hasSupportedProtocolChain(chainId: number): chainId is SupportedProtocolChainId {
  return supportedProtocolChains.some((chain) => chain.id === chainId);
}
