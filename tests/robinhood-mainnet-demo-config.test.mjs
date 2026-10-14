import { describe, expect, test } from "bun:test";
import { isAddress } from "viem";
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

  test("publishes the ten confirmed creation addresses, including distinct dUSD and dCOL tokens", () => {
    const { chainId, explorerUrl, ...addresses } = robinhoodMainnetDemoContracts;
    expect(Object.values(addresses)).toHaveLength(10);
    expect(Object.values(addresses).every((address) => isAddress(address))).toBe(true);
    expect(addresses.loanToken).toBe("0xFBaFDF28bB402EcDaFB90E3852f1494352444Bc1");
    expect(addresses.collateralToken).toBe("0xC59B87173B03b030482e5FF8234CBbFD702A49b9");
  });
});
