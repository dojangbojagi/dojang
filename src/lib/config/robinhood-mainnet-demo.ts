import { defineChain, isAddress, type Address } from "viem";
import { appEnv } from "@/lib/config/env";

export const ROBINHOOD_MAINNET_CHAIN_ID = 4_663;
export const ROBINHOOD_MAINNET_DEMO_EXPLORER_URL = "https://robinhoodchain.blockscout.com";

/** Dormant config only: deliberately absent from active wallet/network selection. */
export const robinhoodMainnetDemoChain = defineChain({
  id: ROBINHOOD_MAINNET_CHAIN_ID,
  name: "Robinhood Chain Mainnet (GYEVO controlled demo)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [appEnv.robinhoodMainnetRpcUrl] } },
  blockExplorers: {
    default: { name: "Robinhood Chain Explorer", url: ROBINHOOD_MAINNET_DEMO_EXPLORER_URL },
  },
});

function checkedAddress(value?: string): Address | undefined {
  return value && isAddress(value) ? value as Address : undefined;
}

/** Separate Mainnet demo address registry; blank until approved deployment receipts exist. */
export const robinhoodMainnetDemoContracts = {
  chainId: ROBINHOOD_MAINNET_CHAIN_ID,
  explorerUrl: ROBINHOOD_MAINNET_DEMO_EXPLORER_URL,
  zkTranscriptLib: checkedAddress(appEnv.robinhoodMainnetDemoContracts.zkTranscriptLib),
  relationsLib: checkedAddress(appEnv.robinhoodMainnetDemoContracts.relationsLib),
  honkVerifier: checkedAddress(appEnv.robinhoodMainnetDemoContracts.honkVerifier),
  credentialRegistry: checkedAddress(appEnv.robinhoodMainnetDemoContracts.credentialRegistry),
  verifierAdapter: checkedAddress(appEnv.robinhoodMainnetDemoContracts.verifierAdapter),
  oracle: checkedAddress(appEnv.robinhoodMainnetDemoContracts.oracle),
  loanToken: checkedAddress(appEnv.robinhoodMainnetDemoContracts.loanToken),
  collateralToken: checkedAddress(appEnv.robinhoodMainnetDemoContracts.collateralToken),
  lendingPool: checkedAddress(appEnv.robinhoodMainnetDemoContracts.lendingPool),
  governance: checkedAddress(appEnv.robinhoodMainnetDemoContracts.governance),
} as const;
