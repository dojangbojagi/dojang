"use client";

import { useCallback, useMemo, useState } from "react";
import type { Address } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { projectContracts } from "@/lib/config/contracts";
import { controlledTokenAbi, lendingPoolAbi } from "@/lib/contracts/abis";
import { isLendingProofForContext, lendingProofContextForCredential } from "@/lib/lending/config";
import { useLendingCredential } from "@/hooks/use-lending-credential";
import { explainProtocolError } from "@/lib/protocol/errors";
import {
  ProtocolError,
  type EligibilityProof,
  type LendingMarketState,
  type LendingMarketSummary,
  type LendingUserPosition,
  type TransactionLifecycle,
} from "@/lib/protocol/types";

type WriteRequest = Parameters<ReturnType<typeof useWriteContract>["writeContractAsync"]>[0];

function asAmount(amount: bigint): bigint {
  if (amount <= 0n) throw new ProtocolError("INVALID_AMOUNT", "Enter an amount greater than zero.");
  return amount;
}

function isUserRejected(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("user rejected") || message.includes("user denied");
}

export function useLendingMarket(): {
  state: LendingMarketState;
  summary?: LendingMarketSummary;
  position?: LendingUserPosition;
  transaction: TransactionLifecycle;
  isSubmitting: boolean;
  refetch: () => Promise<void>;
  approveLendingAsset: (amount: bigint) => Promise<void>;
  approveCollateralAsset: (amount: bigint) => Promise<void>;
  supply: (amount: bigint) => Promise<void>;
  withdrawSupply: (amount: bigint) => Promise<void>;
  depositCollateral: (amount: bigint) => Promise<void>;
  withdrawCollateral: (amount: bigint) => Promise<void>;
  borrow: (amount: bigint, proof: EligibilityProof) => Promise<void>;
  repay: (amount: bigint) => Promise<void>;
} {
  const account = useWalletNetwork();
  const client = usePublicClient({ chainId: GIWA_CHAIN_ID });
  const writer = useWriteContract();
  const credential = useLendingCredential();
  const [transaction, setTransaction] = useState<TransactionLifecycle>({ state: "idle" });
  const pool = projectContracts.lendingPool;

  const lendingAssetQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "lendingAsset",
    query: { enabled: Boolean(pool), retry: 1 },
  });
  const collateralAssetQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "collateralAsset",
    query: { enabled: Boolean(pool), retry: 1 },
  });
  const lendingDecimalsQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "lendingAssetDecimals",
    query: { enabled: Boolean(pool), retry: 1 },
  });
  const collateralDecimalsQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "collateralAssetDecimals",
    query: { enabled: Boolean(pool), retry: 1 },
  });
  const availableLiquidityQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "availableLiquidity",
    query: { enabled: Boolean(pool), retry: 1 },
  });
  const totalSupplierLiquidityQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "totalSupplierLiquidity",
    query: { enabled: Boolean(pool), retry: 1 },
  });
  const totalDebtQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "totalDebt",
    query: { enabled: Boolean(pool), retry: 1 },
  });

  const lendingSymbolQuery = useReadContract({
    address: lendingAssetQuery.data,
    chainId: GIWA_CHAIN_ID,
    abi: controlledTokenAbi,
    functionName: "symbol",
    query: { enabled: Boolean(lendingAssetQuery.data), retry: 1 },
  });
  const collateralSymbolQuery = useReadContract({
    address: collateralAssetQuery.data,
    chainId: GIWA_CHAIN_ID,
    abi: controlledTokenAbi,
    functionName: "symbol",
    query: { enabled: Boolean(collateralAssetQuery.data), retry: 1 },
  });

  const supplierPositionQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "supplierBalance",
    args: account.address ? [account.address] : undefined,
    query: { enabled: Boolean(pool && account.address), retry: 1 },
  });
  const collateralBalanceQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "collateralBalance",
    args: account.address ? [account.address] : undefined,
    query: { enabled: Boolean(pool && account.address), retry: 1 },
  });
  const collateralValueQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "collateralValue",
    args: account.address ? [account.address] : undefined,
    query: { enabled: Boolean(pool && account.address), retry: 1 },
  });
  const debtBalanceQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "debtBalance",
    args: account.address ? [account.address] : undefined,
    query: { enabled: Boolean(pool && account.address), retry: 1 },
  });
  const borrowingCapacityQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "borrowingCapacity",
    args: account.address ? [account.address] : undefined,
    query: { enabled: Boolean(pool && account.address), retry: 1 },
  });
  const remainingCapacityQuery = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName: "remainingBorrowCapacity",
    args: account.address ? [account.address] : undefined,
    query: { enabled: Boolean(pool && account.address), retry: 1 },
  });

  const lendingBalanceQuery = useReadContract({
    address: lendingAssetQuery.data,
    chainId: GIWA_CHAIN_ID,
    abi: controlledTokenAbi,
    functionName: "balanceOf",
    args: account.address ? [account.address] : undefined,
    query: { enabled: Boolean(lendingAssetQuery.data && account.address), retry: 1 },
  });
  const lendingAllowanceQuery = useReadContract({
    address: lendingAssetQuery.data,
    chainId: GIWA_CHAIN_ID,
    abi: controlledTokenAbi,
    functionName: "allowance",
    args: account.address && pool ? [account.address, pool] : undefined,
    query: { enabled: Boolean(lendingAssetQuery.data && account.address && pool), retry: 1 },
  });
  const collateralWalletBalanceQuery = useReadContract({
    address: collateralAssetQuery.data,
    chainId: GIWA_CHAIN_ID,
    abi: controlledTokenAbi,
    functionName: "balanceOf",
    args: account.address ? [account.address] : undefined,
    query: { enabled: Boolean(collateralAssetQuery.data && account.address), retry: 1 },
  });
  const collateralAllowanceQuery = useReadContract({
    address: collateralAssetQuery.data,
    chainId: GIWA_CHAIN_ID,
    abi: controlledTokenAbi,
    functionName: "allowance",
    args: account.address && pool ? [account.address, pool] : undefined,
    query: { enabled: Boolean(collateralAssetQuery.data && account.address && pool), retry: 1 },
  });

  const globalQueries = [
    lendingAssetQuery,
    collateralAssetQuery,
    lendingDecimalsQuery,
    collateralDecimalsQuery,
    availableLiquidityQuery,
    totalSupplierLiquidityQuery,
    totalDebtQuery,
    lendingSymbolQuery,
    collateralSymbolQuery,
  ];
  const userQueries = account.address ? [
    supplierPositionQuery,
    collateralBalanceQuery,
    collateralValueQuery,
    debtBalanceQuery,
    borrowingCapacityQuery,
    remainingCapacityQuery,
    lendingBalanceQuery,
    lendingAllowanceQuery,
    collateralWalletBalanceQuery,
    collateralAllowanceQuery,
  ] : [];

  let state: LendingMarketState;
  if (!pool) state = "unconfigured";
  else if (!account.address) state = "disconnected";
  else if (!account.isGiwaSepolia) state = "wrong-network";
  else if ([...globalQueries, ...userQueries].some((query) => query.isError)) state = "read-error";
  else if ([...globalQueries, ...userQueries].some((query) => query.isPending)) state = "checking";
  else state = "ready";

  const summary = useMemo<LendingMarketSummary | undefined>(() => {
    const lendingAsset = lendingAssetQuery.data;
    const collateralAsset = collateralAssetQuery.data;
    const lendingDecimals = lendingDecimalsQuery.data;
    const collateralDecimals = collateralDecimalsQuery.data;
    const availableLiquidity = availableLiquidityQuery.data;
    const totalSupplierLiquidity = totalSupplierLiquidityQuery.data;
    const totalDebt = totalDebtQuery.data;
    const lendingSymbol = lendingSymbolQuery.data;
    const collateralSymbol = collateralSymbolQuery.data;
    if (
      !lendingAsset || !collateralAsset || lendingDecimals === undefined || collateralDecimals === undefined ||
      availableLiquidity === undefined || totalSupplierLiquidity === undefined || totalDebt === undefined ||
      lendingSymbol === undefined || collateralSymbol === undefined
    ) return undefined;
    return {
      lendingAsset: { address: lendingAsset, symbol: lendingSymbol, decimals: Number(lendingDecimals) },
      collateralAsset: { address: collateralAsset, symbol: collateralSymbol, decimals: Number(collateralDecimals) },
      availableLiquidity,
      totalSupplierLiquidity,
      totalDebt,
    };
  }, [
    availableLiquidityQuery.data,
    collateralAssetQuery.data,
    collateralDecimalsQuery.data,
    collateralSymbolQuery.data,
    lendingAssetQuery.data,
    lendingDecimalsQuery.data,
    lendingSymbolQuery.data,
    totalDebtQuery.data,
    totalSupplierLiquidityQuery.data,
  ]);

  const position = useMemo<LendingUserPosition | undefined>(() => {
    if (!account.address) return undefined;
    const values = [
      lendingBalanceQuery.data,
      lendingAllowanceQuery.data,
      collateralWalletBalanceQuery.data,
      collateralAllowanceQuery.data,
      supplierPositionQuery.data,
      collateralBalanceQuery.data,
      collateralValueQuery.data,
      debtBalanceQuery.data,
      borrowingCapacityQuery.data,
      remainingCapacityQuery.data,
    ];
    if (values.some((value) => value === undefined)) return undefined;
    return {
      lendingAssetBalance: lendingBalanceQuery.data!,
      lendingAssetAllowance: lendingAllowanceQuery.data!,
      collateralAssetBalance: collateralWalletBalanceQuery.data!,
      collateralAssetAllowance: collateralAllowanceQuery.data!,
      supplierPosition: supplierPositionQuery.data!,
      collateralBalance: collateralBalanceQuery.data!,
      collateralValue: collateralValueQuery.data!,
      debtBalance: debtBalanceQuery.data!,
      borrowingCapacity: borrowingCapacityQuery.data!,
      remainingBorrowCapacity: remainingCapacityQuery.data!,
    };
  }, [
    account.address,
    borrowingCapacityQuery.data,
    collateralAllowanceQuery.data,
    collateralBalanceQuery.data,
    collateralValueQuery.data,
    collateralWalletBalanceQuery.data,
    debtBalanceQuery.data,
    lendingAllowanceQuery.data,
    lendingBalanceQuery.data,
    remainingCapacityQuery.data,
    supplierPositionQuery.data,
  ]);

  const assertCanTransact = useCallback(() => {
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect a wallet before using the lending market.");
    if (!account.isGiwaSepolia) throw new ProtocolError("WRONG_NETWORK", "Switch to GIWA Sepolia before submitting a lending transaction.");
    if (!pool || !client) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The lending pool is not configured.");
    if (state !== "ready" || !summary || !position) {
      throw new ProtocolError("RPC_ERROR", "Wait for the lending market and wallet position reads to finish.");
    }
  }, [account.address, account.isGiwaSepolia, client, pool, position, state, summary]);

  const execute = useCallback(async (
    simulate: () => Promise<{ request: WriteRequest }>,
    verifyReadback: () => Promise<boolean>,
  ): Promise<void> => {
    if (!client) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The GIWA RPC client is unavailable.");
    let hash: `0x${string}` | undefined;
    try {
      setTransaction({ state: "simulating" });
      const simulation = await simulate();
      setTransaction({ state: "awaiting-signature" });
      hash = await writer.writeContractAsync(simulation.request);
      const explorerUrl = `${GIWA_EXPLORER_URL}/tx/${hash}`;
      setTransaction({ state: "submitted", hash, explorerUrl });
      setTransaction({ state: "confirming", hash, explorerUrl });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setTransaction({ state: "reverted", hash, explorerUrl, error: "The lending transaction reverted on-chain." });
        throw new ProtocolError("RPC_ERROR", "The lending transaction reverted on-chain.");
      }
      if (!await verifyReadback()) {
        setTransaction({
          state: "rpc-error",
          hash,
          explorerUrl,
          error: "The receipt succeeded, but the resulting lending state did not match the expected position.",
        });
        throw new ProtocolError("TRANSACTION_STATE_UNCONFIRMED", "The receipt succeeded, but lending state readback is not confirmed.");
      }
      setTransaction({ state: "confirmed", hash, explorerUrl });
    } catch (error) {
      if (error instanceof ProtocolError && error.code === "TRANSACTION_STATE_UNCONFIRMED") throw error;
      if (error instanceof ProtocolError && error.message === "The lending transaction reverted on-chain.") throw error;
      const detail = explainProtocolError(error);
      const state = isUserRejected(error) ? "rejected" : "rpc-error";
      setTransaction({ state, hash, explorerUrl: hash ? `${GIWA_EXPLORER_URL}/tx/${hash}` : undefined, error: detail });
      throw error;
    }
  }, [client, writer]);

  const approveLendingAsset = useCallback(async (requestedAmount: bigint) => {
    const amount = asAmount(requestedAmount);
    assertCanTransact();
    if (!summary || !pool || !account.address || !client) return;
    await execute(
      () => client.simulateContract({
        account: account.address!, address: summary.lendingAsset.address, abi: controlledTokenAbi,
        functionName: "approve", args: [pool, amount],
      }),
      async () => {
        const readback = await lendingAllowanceQuery.refetch();
        return readback.data !== undefined && readback.data >= amount;
      },
    );
  }, [account.address, assertCanTransact, client, execute, lendingAllowanceQuery, pool, summary]);

  const approveCollateralAsset = useCallback(async (requestedAmount: bigint) => {
    const amount = asAmount(requestedAmount);
    assertCanTransact();
    if (!summary || !pool || !account.address || !client) return;
    await execute(
      () => client.simulateContract({
        account: account.address!, address: summary.collateralAsset.address, abi: controlledTokenAbi,
        functionName: "approve", args: [pool, amount],
      }),
      async () => {
        const readback = await collateralAllowanceQuery.refetch();
        return readback.data !== undefined && readback.data >= amount;
      },
    );
  }, [account.address, assertCanTransact, client, collateralAllowanceQuery, execute, pool, summary]);

  const supply = useCallback(async (requestedAmount: bigint) => {
    const amount = asAmount(requestedAmount);
    assertCanTransact();
    if (!pool || !account.address || !client || !summary || !position) return;
    const expectedPosition = position.supplierPosition + amount;
    const expectedLiquidity = summary.availableLiquidity + amount;
    await execute(
      () => client.simulateContract({
        account: account.address!, address: pool, abi: lendingPoolAbi,
        functionName: "supply", args: [amount],
      }),
      async () => {
        const [supplier, liquidity] = await Promise.all([
          supplierPositionQuery.refetch(),
          availableLiquidityQuery.refetch(),
          totalSupplierLiquidityQuery.refetch(),
          lendingBalanceQuery.refetch(),
        ]).then(([supplierResult, liquidityResult]) => [supplierResult, liquidityResult] as const);
        return supplier.data === expectedPosition && liquidity.data === expectedLiquidity;
      },
    );
  }, [account.address, assertCanTransact, availableLiquidityQuery, client, execute, lendingBalanceQuery, pool, position, summary, supplierPositionQuery, totalSupplierLiquidityQuery]);

  const withdrawSupply = useCallback(async (requestedAmount: bigint) => {
    const amount = asAmount(requestedAmount);
    assertCanTransact();
    if (!pool || !account.address || !client || !summary || !position) return;
    const expectedPosition = position.supplierPosition - amount;
    const expectedLiquidity = summary.availableLiquidity - amount;
    await execute(
      () => client.simulateContract({
        account: account.address!, address: pool, abi: lendingPoolAbi,
        functionName: "withdrawSupply", args: [amount],
      }),
      async () => {
        const [supplier, liquidity] = await Promise.all([
          supplierPositionQuery.refetch(),
          availableLiquidityQuery.refetch(),
          totalSupplierLiquidityQuery.refetch(),
          lendingBalanceQuery.refetch(),
        ]).then(([supplierResult, liquidityResult]) => [supplierResult, liquidityResult] as const);
        return supplier.data === expectedPosition && liquidity.data === expectedLiquidity;
      },
    );
  }, [account.address, assertCanTransact, availableLiquidityQuery, client, execute, lendingBalanceQuery, pool, position, summary, supplierPositionQuery, totalSupplierLiquidityQuery]);

  const depositCollateral = useCallback(async (requestedAmount: bigint) => {
    const amount = asAmount(requestedAmount);
    assertCanTransact();
    if (!pool || !account.address || !client || !position) return;
    const expectedCollateral = position.collateralBalance + amount;
    await execute(
      () => client.simulateContract({
        account: account.address!, address: pool, abi: lendingPoolAbi,
        functionName: "depositCollateral", args: [amount],
      }),
      async () => {
        const [collateral, walletBalance] = await Promise.all([
          collateralBalanceQuery.refetch(),
          collateralWalletBalanceQuery.refetch(),
          collateralAllowanceQuery.refetch(),
        ]).then(([collateralResult, balanceResult]) => [collateralResult, balanceResult] as const);
        return collateral.data === expectedCollateral && walletBalance.data === position.collateralAssetBalance - amount;
      },
    );
  }, [account.address, assertCanTransact, client, collateralAllowanceQuery, collateralBalanceQuery, collateralWalletBalanceQuery, execute, pool, position]);

  const withdrawCollateral = useCallback(async (requestedAmount: bigint) => {
    const amount = asAmount(requestedAmount);
    assertCanTransact();
    if (!pool || !account.address || !client || !position) return;
    const expectedCollateral = position.collateralBalance - amount;
    await execute(
      () => client.simulateContract({
        account: account.address!, address: pool, abi: lendingPoolAbi,
        functionName: "withdrawCollateral", args: [amount],
      }),
      async () => {
        const [collateral, walletBalance] = await Promise.all([
          collateralBalanceQuery.refetch(),
          collateralWalletBalanceQuery.refetch(),
        ]);
        return collateral.data === expectedCollateral && walletBalance.data === position.collateralAssetBalance + amount;
      },
    );
  }, [account.address, assertCanTransact, client, collateralBalanceQuery, collateralWalletBalanceQuery, execute, pool, position]);

  const borrow = useCallback(async (requestedAmount: bigint, proof: EligibilityProof) => {
    const amount = asAmount(requestedAmount);
    assertCanTransact();
    if (!pool || !account.address || !client || !position || credential.state !== "active" || !credential.record) {
      throw new ProtocolError("CREDENTIAL_REQUIRED", "An active lending credential is required to borrow.");
    }
    const context = lendingProofContextForCredential({
      subject: account.address,
      record: credential.record,
      lendingPool: pool,
    });
    if (!isLendingProofForContext(proof, context)) {
      throw new ProtocolError("INVALID_PROOF", "Borrowing requires a locally verified proof bound to the current wallet, credential, chain, policy, and LendingPool.");
    }
    const expectedDebt = position.debtBalance + amount;
    const expectedBalance = position.lendingAssetBalance + amount;
    await execute(
      () => client.simulateContract({
        account: account.address!, address: pool, abi: lendingPoolAbi,
        functionName: "borrow", args: [amount, proof.proof, proof.publicInputs],
      }),
      async () => {
        const [debt, balance] = await Promise.all([
          debtBalanceQuery.refetch(),
          lendingBalanceQuery.refetch(),
          totalDebtQuery.refetch(),
          availableLiquidityQuery.refetch(),
        ]).then(([debtResult, balanceResult]) => [debtResult, balanceResult] as const);
        return debt.data === expectedDebt && balance.data === expectedBalance;
      },
    );
  }, [account.address, assertCanTransact, availableLiquidityQuery, client, credential.record, credential.state, debtBalanceQuery, execute, lendingBalanceQuery, pool, position, totalDebtQuery]);

  const repay = useCallback(async (requestedAmount: bigint) => {
    const amount = asAmount(requestedAmount);
    assertCanTransact();
    if (!pool || !account.address || !client || !position) return;
    const expectedDebt = position.debtBalance - amount;
    const expectedBalance = position.lendingAssetBalance - amount;
    await execute(
      () => client.simulateContract({
        account: account.address!, address: pool, abi: lendingPoolAbi,
        functionName: "repay", args: [amount],
      }),
      async () => {
        const [debt, balance] = await Promise.all([
          debtBalanceQuery.refetch(),
          lendingBalanceQuery.refetch(),
          totalDebtQuery.refetch(),
          availableLiquidityQuery.refetch(),
        ]).then(([debtResult, balanceResult]) => [debtResult, balanceResult] as const);
        return debt.data === expectedDebt && balance.data === expectedBalance;
      },
    );
  }, [account.address, assertCanTransact, availableLiquidityQuery, client, debtBalanceQuery, execute, lendingBalanceQuery, pool, position, totalDebtQuery]);

  const refetch = useCallback(async () => {
    await Promise.all([...globalQueries, ...userQueries].map((query) => query.refetch()));
  }, [globalQueries, userQueries]);

  return {
    state,
    summary,
    position,
    transaction,
    isSubmitting: ["simulating", "awaiting-signature", "submitted", "confirming"].includes(transaction.state),
    refetch,
    approveLendingAsset,
    approveCollateralAsset,
    supply,
    withdrawSupply,
    depositCollateral,
    withdrawCollateral,
    borrow,
    repay,
  };
}
