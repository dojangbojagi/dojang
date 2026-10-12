import type { Address, Hash } from "viem";
import { giwaSepolia, GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import {
  invalidContractConfig,
  invalidRobinhoodContractConfig,
  projectContracts,
  robinhoodContracts,
} from "@/lib/config/contracts";
import { robinhoodTestnet, ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";

export const supportedProtocolChains = [robinhoodTestnet, giwaSepolia] as const;
export const primaryProtocolChainId = ROBINHOOD_TESTNET_CHAIN_ID;
export type SupportedProtocolChainId = typeof GIWA_CHAIN_ID | typeof ROBINHOOD_TESTNET_CHAIN_ID;

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
