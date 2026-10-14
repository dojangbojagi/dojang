import { describe, expect, test } from "bun:test";
import { robinhoodMainnetDemoChain, robinhoodMainnetDemoContracts, ROBINHOOD_MAINNET_CHAIN_ID } from "../src/lib/config/robinhood-mainnet-demo.ts";
import { supportedProtocolChains, getLendingV2ContractSet } from "../src/lib/config/network-registry.ts";

describe("dormant Robinhood Mainnet demo configuration", () => {
  test("records the correct network and explorer without activating it in wallet UX", () => {
    expect(ROBINHOOD_MAINNET_CHAIN_ID).toBe(4_663);
    expect(robinhoodMainnetDemoChain.id).toBe(4_663);
    expect(robinhoodMainnetDemoContracts.chainId).toBe(4_663);
    expect(robinhoodMainnetDemoContracts.explorerUrl).toBe("https://robinhoodchain.blockscout.com");
    expect(supportedProtocolChains.some((chain) => chain.id === 4_663)).toBe(false);
    expect(getLendingV2ContractSet(4_663)).toBeUndefined();
  });

  test("does not invent Mainnet deployment addresses", () => {
    expect(robinhoodMainnetDemoContracts.lendingPool).toBeUndefined();
    expect(robinhoodMainnetDemoContracts.governance).toBeUndefined();
    expect(robinhoodMainnetDemoContracts.oracle).toBeUndefined();
  });
});
