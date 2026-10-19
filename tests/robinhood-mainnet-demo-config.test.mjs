import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { isAddress } from "viem";
import { robinhoodMainnetDemoChain, robinhoodMainnetDemoContracts, robinhoodMainnetRpcUrls, ROBINHOOD_MAINNET_CHAIN_ID } from "../src/lib/config/robinhood-mainnet-demo.ts";
import { supportedProtocolChains, getDaoPhase2ContractSet, getLendingV2ContractSet } from "../src/lib/config/network-registry.ts";

describe("Robinhood Mainnet demo configuration", () => {
  test("keeps Mainnet Lending isolated behind its own explicit synthetic contract registry", () => {
    expect(ROBINHOOD_MAINNET_CHAIN_ID).toBe(4_663);
    expect(robinhoodMainnetDemoChain.id).toBe(4_663);
    expect(robinhoodMainnetDemoContracts.chainId).toBe(4_663);
    expect(robinhoodMainnetDemoContracts.explorerUrl).toBe("https://robinhoodchain.blockscout.com");
    expect(robinhoodMainnetRpcUrls).toEqual([
      "https://rpc.mainnet.chain.robinhood.com",
    ]);
    expect(robinhoodMainnetDemoChain.rpcUrls.default.http).not.toContain("https://rpc.testnet.chain.robinhood.com");
    expect(supportedProtocolChains.some((chain) => chain.id === 4_663)).toBe(true);
    const mainnetLending = getLendingV2ContractSet(4_663);
    const testnetLending = getLendingV2ContractSet(46_630);
    expect(mainnetLending?.chainId).toBe(4_663);
    expect(mainnetLending?.pool).toBe(robinhoodMainnetDemoContracts.lendingPool);
    expect(mainnetLending?.configuredAssets).toEqual([robinhoodMainnetDemoContracts.loanToken, robinhoodMainnetDemoContracts.collateralToken]);
    expect(mainnetLending?.pool).not.toBe(testnetLending?.pool);
    expect(mainnetLending?.configuredAssets).not.toEqual(testnetLending?.configuredAssets);
    const phase2 = getDaoPhase2ContractSet(4_663);
    expect(phase2?.chainId).toBe(4_663);
    expect(phase2?.credentialRegistry).toBe(robinhoodMainnetDemoContracts.credentialRegistry);
    expect(phase2?.lendingPool).toBe(robinhoodMainnetDemoContracts.lendingPool);
  });

  test("keeps authenticated fallback credentials behind the read-only server proxy", async () => {
    const config = await readFile(new URL("../src/lib/config/robinhood-mainnet-demo.ts", import.meta.url), "utf8");
    const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
    expect(config).toContain('"/api/robinhood-mainnet-rpc"');
    expect(config).toContain("Wallet writes continue through the");
    expect(envExample).not.toContain("NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_FALLBACK_URL");
    expect(envExample).toContain("RH_MAINNET_RPC_FALLBACK_API_KEY=");
    expect(envExample).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*API_KEY/);
  });

  test("publishes the ten confirmed creation addresses, including distinct dUSD and dCOL tokens", () => {
    const { chainId, explorerUrl, ...addresses } = robinhoodMainnetDemoContracts;
    expect(Object.values(addresses)).toHaveLength(10);
    expect(Object.values(addresses).every((address) => isAddress(address))).toBe(true);
    expect(addresses.loanToken).toBe("0xFBaFDF28bB402EcDaFB90E3852f1494352444Bc1");
    expect(addresses.collateralToken).toBe("0xC59B87173B03b030482e5FF8234CBbFD702A49b9");
  });
});
