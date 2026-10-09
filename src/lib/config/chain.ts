import { defineChain } from "viem";
import { appEnv } from "@/lib/config/env";

export const giwaSepolia = defineChain({
  id: 91342,
  name: "GIWA Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [appEnv.giwaRpcUrl] },
  },
  blockExplorers: {
    default: { name: "GIWA Sepolia Explorer", url: "https://sepolia-explorer.giwa.io" },
  },
  testnet: true,
});

export const GIWA_CHAIN_ID = 91342;
export const GIWA_EXPLORER_URL = "https://sepolia-explorer.giwa.io";
