import { defineChain } from "viem";
import { appEnv } from "@/lib/config/env";

export const ROBINHOOD_TESTNET_CHAIN_ID = 46_630;
export const ROBINHOOD_TESTNET_PUBLIC_RPC_URL = "https://rpc.testnet.chain.robinhood.com";
export const ROBINHOOD_TESTNET_RPC_URL =
  appEnv.robinhoodRpcUrl;
export const ROBINHOOD_TESTNET_EXPLORER_URL = "https://explorer.testnet.chain.robinhood.com";

export const robinhoodTestnet = defineChain({
  id: ROBINHOOD_TESTNET_CHAIN_ID,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [ROBINHOOD_TESTNET_RPC_URL] } },
  blockExplorers: {
    default: { name: "Robinhood Testnet Explorer", url: ROBINHOOD_TESTNET_EXPLORER_URL },
  },
  testnet: true,
});
