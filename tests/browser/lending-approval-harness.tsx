import { useState } from "react";
import { createRoot } from "react-dom/client";
import { SupplyView } from "@/components/lending-v2/v2-supply";
import type { ActionRunner } from "@/components/lending/types";
import type { V2Market, V2Proof } from "@/components/lending-v2/v2-types";
import type { Address } from "viem";

const ROBINHOOD_MAINNET_CHAIN_ID = 4_663;
const walletA = "0x3cdb91a29b73daB9219D9A287543800B417b6dbB" as Address;
const asset = "0xFBaFDF28bB402EcDaFB90E3852f1494352444Bc1" as Address;
const pool = "0x8706B2fe815fB3C5986acE47b59bE0853567B48D" as Address;

type MockWallet = { connected: boolean; chainId: number; nativeBalance: bigint; tokenBalance: bigint; feeEstimateCovered: boolean };
type HarnessWindow = Window & {
  __setApprovalAllowance?: (value: string) => void;
  __setProofReady?: (value: boolean) => void;
  __setMockWallet?: (value: Partial<Omit<MockWallet, "tokenBalance">> & { tokenBalance?: string | bigint }) => void;
  __approvalRequest?: { token: Address; spender: Address; amount: string };
  __supplyCalled?: boolean;
};

function Harness() {
  const [allowance, setAllowance] = useState(0n);
  const [proofReady, setProofReady] = useState(false);
  const [wallet, setWallet] = useState<MockWallet>({
    connected: true,
    chainId: ROBINHOOD_MAINNET_CHAIN_ID,
    nativeBalance: 10n ** 16n,
    tokenBalance: 2_100_000n,
    feeEstimateCovered: true,
  });
  const runnerBlock = !wallet.connected
    ? "Connect a wallet first."
    : wallet.chainId !== ROBINHOOD_MAINNET_CHAIN_ID
      ? `Switch to Robinhood Chain Mainnet (chain ${ROBINHOOD_MAINNET_CHAIN_ID}) first.`
      : wallet.nativeBalance === 0n
        ? "This wallet has no Robinhood Chain Mainnet ETH to pay the network fee."
        : !wallet.feeEstimateCovered
          ? "This wallet does not have enough ETH for the estimated fee plus headroom."
          : null;

  const loanReserve = {
    asset,
    symbol: "dUSD",
    decimals: 6,
    data: {
      decimals: 6,
      liquidityIndex: 0n,
      borrowIndex: 0n,
      totalSupplyAssets: 0n,
      totalDebtAssets: 0n,
      availableLiquidity: 0n,
      utilizationBps: 0n,
      currentBorrowRateBps: 0n,
      currentSupplyRateBps: 500n,
      accruedProtocolFees: 0n,
      config: {
        supplyCap: 1_000_000_000n,
        borrowCap: 1_000_000_000n,
        collateralCap: 1_000_000_000n,
        minBorrowAmount: 1n,
        maxOracleAge: 600n,
        maxLtvBps: 2_500,
        liquidationThresholdBps: 4_000,
        liquidationBonusBps: 500,
        closeFactorBps: 2_500,
        reserveFactorBps: 2_000,
        optimalUtilizationBps: 5_000,
        baseBorrowRateBps: 100,
        slope1Bps: 300,
        slope2Bps: 1_200,
        active: true,
        supplyEnabled: true,
        borrowEnabled: true,
        collateralEnabled: false,
      },
    },
    oracle: { state: "fresh" },
    position: {
      supplied: 0n,
      collateral: 0n,
      debt: 0n,
      isCollateralEnabled: false,
      walletBalance: wallet.tokenBalance,
      allowance,
    },
  };
  const collateralReserve = { ...loanReserve, asset: "0xC59B87173B03b030482e5FF8234CBbFD702A49b9" as Address, symbol: "dCOL", decimals: 18 };
  const market = {
    chainId: ROBINHOOD_MAINNET_CHAIN_ID,
    networkName: "Robinhood Chain Mainnet",
    poolAddress: pool,
    explorerUrl: "https://robinhoodchain.blockscout.com",
    state: "ready",
    snapshot: {
      pool,
      blockNumber: 1n,
      blockTimestamp: 1n,
      riskPaused: false,
      credentialRegistry: "0x161fF635c26665ee41e3941F32873E9490C4856b" as Address,
      eligibilityVerifier: "0x311d58862576C1C8Ae97c7AEE6A2DA17FB20e3BD" as Address,
      honkVerifier: "0x47c9c38e4f4f79A8CE8C5ef28C8aF228bec51De7" as Address,
      oracle: "0x21Bb6bf7f3Be2b08B1778C9B2dA743621E6e3262" as Address,
      policyId: 3n,
      policyVersion: 1n,
      threshold: 1_000n,
      reserves: [loanReserve, collateralReserve],
      position: { wallet: walletA, demoParticipant: true, byAsset: {}, riskMetricsState: "available" },
    },
    isSubmitting: false,
    approveToken: async (token: Address, amount: bigint) => {
      (window as HarnessWindow).__approvalRequest = { token, spender: pool, amount: amount.toString() };
    },
    supply: async () => { (window as HarnessWindow).__supplyCalled = true; },
    withdrawSupply: async () => undefined,
  } as unknown as V2Market;
  const proof = { proof: proofReady ? { proof: "0x01" } : undefined } as unknown as V2Proof;
  const runner: ActionRunner = {
    busy: false,
    block: runnerBlock,
    run: async (_label, action) => {
      // This harness invokes only a local spy. It never calls a wallet, RPC writer, or transaction hook.
      await action();
      return false;
    },
  };

  (window as HarnessWindow).__setApprovalAllowance = (value) => setAllowance(BigInt(value));
  (window as HarnessWindow).__setProofReady = setProofReady;
  (window as HarnessWindow).__setMockWallet = (update) => setWallet((current) => ({
    ...current,
    ...update,
    tokenBalance: update.tokenBalance === undefined ? current.tokenBalance : BigInt(update.tokenBalance),
  }));

  return <>
    <p role="status">Test fixture: connected wallet mock on Robinhood Mainnet 4663. No wallet or RPC writes are available.</p>
    <SupplyView market={market} proof={proof} runner={runner} asset={asset} onAsset={() => undefined} />
    <section id="lendv2-eligibility" aria-label="Eligibility">
      <button type="button">Generate Eligibility Proof</button>
    </section>
  </>;
}

createRoot(document.getElementById("root")!).render(<Harness />);
