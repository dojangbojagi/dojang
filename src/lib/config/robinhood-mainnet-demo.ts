import { defineChain, fallback, http, isAddress, type Address } from "viem";
import { appEnv } from "@/lib/config/env";

export const ROBINHOOD_MAINNET_CHAIN_ID = 4_663;
export const ROBINHOOD_MAINNET_PUBLIC_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const ROBINHOOD_MAINNET_FALLBACK_RPC_URL = "https://api.blockvectra.com/v1/robinhood_mainnet/public";
export const ROBINHOOD_MAINNET_DEMO_EXPLORER_URL = "https://robinhoodchain.blockscout.com";
// Wallet network metadata intentionally contains only the public Robinhood RPC.
// The authenticated fallback is server-only and is never exposed to wallet extensions.
export const robinhoodMainnetRpcUrls = [appEnv.robinhoodMainnetRpcUrl || ROBINHOOD_MAINNET_PUBLIC_RPC_URL];

/**
 * Mainnet reads use a same-origin read-only proxy so the BlockVectra credential stays server-side.
 * The public Robinhood RPC remains a direct read fallback. Wallet writes continue through the
 * explicitly selected wallet connector and never use the API route.
 */
const mainnetReadEndpoints = typeof window === "undefined"
  ? [robinhoodMainnetRpcUrls[0]!]
  : ["/api/robinhood-mainnet-rpc", robinhoodMainnetRpcUrls[0]!];

export const robinhoodMainnetReadTransport = fallback(
  mainnetReadEndpoints.map((url) => http(url, { timeout: 8_000, retryCount: 0 })),
  { rank: false, retryCount: 0, retryDelay: 0 },
);

/** Mainnet network configuration used by the production DAO selector and read-only integrations. */
export const robinhoodMainnetDemoChain = defineChain({
  id: ROBINHOOD_MAINNET_CHAIN_ID,
  name: "Robinhood Chain Mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: robinhoodMainnetRpcUrls } },
  blockExplorers: {
    default: { name: "Robinhood Chain Explorer", url: ROBINHOOD_MAINNET_DEMO_EXPLORER_URL },
  },
});

function checkedAddress(value?: string): Address | undefined {
  return value && isAddress(value) ? value as Address : undefined;
}

/** Chain 4663 creation addresses from ten successful receipts in the Mainnet Foundry broadcast artifact. */
export const robinhoodMainnetDemoContracts = {
  chainId: ROBINHOOD_MAINNET_CHAIN_ID,
  explorerUrl: ROBINHOOD_MAINNET_DEMO_EXPLORER_URL,
  zkTranscriptLib: checkedAddress("0xf37f9fE79bD275BD64fb4079Df9E0EaaaF09994F"),
  relationsLib: checkedAddress("0xD593cC3E5AF275827bE507cCcD5a0C7bAbac8D81"),
  honkVerifier: checkedAddress("0x47c9c38e4f4f79A8CE8C5ef28C8aF228bec51De7"),
  credentialRegistry: checkedAddress("0x161fF635c26665ee41e3941F32873E9490C4856b"),
  verifierAdapter: checkedAddress("0x311d58862576C1C8Ae97c7AEE6A2DA17FB20e3BD"),
  oracle: checkedAddress("0x21Bb6bf7f3Be2b08B1778C9B2dA743621E6e3262"),
  loanToken: checkedAddress("0xFBaFDF28bB402EcDaFB90E3852f1494352444Bc1"),
  collateralToken: checkedAddress("0xC59B87173B03b030482e5FF8234CBbFD702A49b9"),
  lendingPool: checkedAddress("0x8706B2fe815fB3C5986acE47b59bE0853567B48D"),
  governance: checkedAddress("0x803C6f452abDB5B9A23DaDbA8d7e157ba55B6dea"),
} as const;
