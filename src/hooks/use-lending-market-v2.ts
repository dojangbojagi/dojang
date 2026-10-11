"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { maxUint256, parseEventLogs, type Address, type Hex, type TransactionReceipt } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { projectContracts, invalidContractConfig } from "@/lib/config/contracts";
import { appEnv } from "@/lib/config/env";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { controlledTokenAbi, lendingPoolV2Abi } from "@/lib/contracts/abis";
import { isLendingV2ProofForContext, lendingV2MarketQueryKey, lendingV2ProofContextForCredential } from "@/lib/lending/v2-config";
import { LendingV2UnavailableError, LendingV2WrongNetworkError, readLendingV2Credential, readLendingV2Deployment, readLendingV2Market, type LendingV2MarketSnapshot, type LendingV2MarketState } from "@/lib/lending/v2-service";
import { mapLendingV2Error, type LendingV2Failure } from "@/lib/lending/v2-errors";
import { ProtocolError, type EligibilityProof, type TransactionLifecycle } from "@/lib/protocol/types";

type WriteRequest = Parameters<ReturnType<typeof useWriteContract>["writeContractAsync"]>[0];
type ProofInputs = readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

function positiveAmount(amount: bigint): bigint {
  if (amount <= 0n) throw new ProtocolError("INVALID_AMOUNT", "Enter an amount greater than zero.");
  return amount;
}

function transactionPending(state: TransactionLifecycle["state"]): boolean {
  return ["simulating", "awaiting-signature", "submitted", "confirming"].includes(state);
}

function receiptHasV2Event(
  receipt: TransactionReceipt,
  pool: Address,
  eventName: string,
  matches: (args: Record<string, unknown>) => boolean,
): boolean {
  const poolLogs = receipt.logs.filter((log) => log.address.toLowerCase() === pool.toLowerCase());
  const events = parseEventLogs({ abi: lendingPoolV2Abi, logs: poolLogs, strict: false });
  return events.some((event) => event.eventName === eventName && matches(event.args as Record<string, unknown>));
}

function eventBigintFromReceipt(receipt: TransactionReceipt, pool: Address, eventName: string, key: string): bigint | undefined {
  const poolLogs = receipt.logs.filter((log) => log.address.toLowerCase() === pool.toLowerCase());
  const events = parseEventLogs({ abi: lendingPoolV2Abi, logs: poolLogs, strict: false });
  const event = events.find((item) => item.eventName === eventName);
  return event ? eventBigint(event.args as Record<string, unknown>, key) : undefined;
}

function eventAddress(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value.toLowerCase() : undefined;
}

function eventBigint(args: Record<string, unknown>, key: string): bigint | undefined {
  const value = args[key];
  return typeof value === "bigint" ? value : undefined;
}

function eventBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  return typeof value === "boolean" ? value : undefined;
}

export function useLendingMarketV2(): {
  state: LendingV2MarketState;
  snapshot?: LendingV2MarketSnapshot;
  transaction: TransactionLifecycle;
  failure?: LendingV2Failure;
  isSubmitting: boolean;
  readAvailable: boolean;
  writesAvailable: boolean;
  refetch: () => Promise<void>;
  inspectPosition: (wallet: Address) => Promise<LendingV2MarketSnapshot["position"]>;
  approveToken: (asset: Address, amount: bigint) => Promise<void>;
  supply: (asset: Address, amount: bigint, proof: EligibilityProof) => Promise<void>;
  withdrawSupply: (asset: Address, amount: bigint) => Promise<void>;
  depositCollateral: (asset: Address, amount: bigint) => Promise<void>;
  enableCollateral: (asset: Address, proof: EligibilityProof) => Promise<void>;
  disableCollateral: (asset: Address) => Promise<void>;
  withdrawCollateral: (asset: Address, amount: bigint) => Promise<void>;
  borrow: (asset: Address, amount: bigint, proof: EligibilityProof) => Promise<void>;
  repay: (asset: Address, amount: bigint) => Promise<void>;
  liquidate: (borrower: Address, debtAsset: Address, collateralAsset: Address, requestedRepay: bigint) => Promise<void>;
} {
  const account = useWalletNetwork();
  const client = usePublicClient({ chainId: GIWA_CHAIN_ID });
  const writer = useWriteContract();
  const queryClient = useQueryClient();
  const pool = projectContracts.lendingPoolV2;
  const poolValue = appEnv.contracts.lendingPoolV2;
  const invalidPoolConfig = invalidContractConfig.includes("lendingPoolV2");
  const [transaction, setTransaction] = useState<TransactionLifecycle>({ state: "idle" });
  const [failure, setFailure] = useState<LendingV2Failure>();

  const deploymentQuery = useQuery({
    queryKey: ["lending-v2-deployment", String(GIWA_CHAIN_ID), pool?.toLowerCase() ?? "unconfigured"],
    queryFn: async () => {
      if (!client || !pool) throw new LendingV2UnavailableError("The Lending V2 pool is not configured.");
      return readLendingV2Deployment(client, pool, projectContracts.credentialRegistry);
    },
    enabled: Boolean(pool && client),
    retry: 1,
    staleTime: 15_000,
  });

  const marketKey = lendingV2MarketQueryKey(pool, account.address);
  const marketQuery = useQuery({
    queryKey: marketKey,
    queryFn: async () => {
      if (!client || !pool) throw new LendingV2UnavailableError("The Lending V2 pool is not configured.");
      return readLendingV2Market(client, {
        pool,
        wallet: account.address,
        expectedRegistry: projectContracts.credentialRegistry,
      });
    },
    enabled: Boolean(pool && client),
    retry: 1,
    staleTime: 8_000,
    refetchOnWindowFocus: true,
  });

  let state: LendingV2MarketState;
  if (!poolValue) state = "unconfigured";
  else if (invalidPoolConfig) state = "unavailable";
  else if (!account.address) state = "disconnected";
  else if (!account.isGiwaSepolia) state = "wrong-network";
  else if (deploymentQuery.isPending || marketQuery.isPending) state = "checking";
  else if (deploymentQuery.error instanceof LendingV2UnavailableError || marketQuery.error instanceof LendingV2UnavailableError) state = "unavailable";
  else if (deploymentQuery.error instanceof LendingV2WrongNetworkError) state = "wrong-network";
  else if (deploymentQuery.isError || marketQuery.isError) state = "read-error";
  else state = "ready";

  const assertBase = useCallback(async () => {
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect a wallet before using Lending V2.");
    if (!account.isGiwaSepolia) throw new ProtocolError("WRONG_NETWORK", "Switch to GIWA Sepolia before submitting a Lending V2 transaction.");
    if (!pool || !client || !poolValue || invalidPoolConfig) {
      throw new ProtocolError("LENDING_NOT_CONFIGURED", "A valid Lending V2 pool address is not configured.");
    }
    await readLendingV2Deployment(client, pool, projectContracts.credentialRegistry);
  }, [account.address, account.isGiwaSepolia, client, invalidPoolConfig, pool, poolValue]);

  const assertSupportedAsset = useCallback(async (asset: Address) => {
    if (!client || !pool) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The V2 pool is not configured.");
    const assets = await client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "getReserveAssets" });
    if (!assets.some((supported) => supported.toLowerCase() === asset.toLowerCase())) {
      throw new ProtocolError("LENDING_NOT_CONFIGURED", "The selected token is not a configured Lending V2 reserve.");
    }
  }, [client, pool]);

  const readTokenBalance = useCallback(async (asset: Address, wallet: Address) => {
    if (!client) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The GIWA RPC client is unavailable.");
    return client.readContract({ address: asset, abi: controlledTokenAbi, functionName: "balanceOf", args: [wallet] });
  }, [client]);

  const assertAllowance = useCallback(async (asset: Address, amount: bigint) => {
    if (!client || !pool || !account.address) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The pool or wallet is unavailable.");
    const allowance = await client.readContract({ address: asset, abi: controlledTokenAbi, functionName: "allowance", args: [account.address, pool] });
    if (allowance < amount) throw new ProtocolError("INSUFFICIENT_FUNDS", "Approve the Lending V2 pool to spend this token amount first.");
  }, [account.address, client, pool]);

  const assertBalance = useCallback(async (asset: Address, amount: bigint) => {
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect the token-owning wallet first.");
    const balance = await readTokenBalance(asset, account.address);
    if (balance < amount) throw new ProtocolError("INSUFFICIENT_FUNDS", "The wallet token balance is below the requested amount.");
  }, [account.address, readTokenBalance]);

  const assertV2Proof = useCallback(async (proof: EligibilityProof) => {
    if (!client || !pool || !account.address) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The V2 proof context is not available.");
    const deployment = await readLendingV2Deployment(client, pool, projectContracts.credentialRegistry);
    const credential = await readLendingV2Credential(client, deployment.credentialRegistry, account.address);
    if (credential.state !== "active" || !credential.record) {
      throw new ProtocolError("CREDENTIAL_REQUIRED", "An active policy-3 Project Test Credential from a current authorized issuer is required.");
    }
    const context = lendingV2ProofContextForCredential({ subject: account.address, record: credential.record, lendingPool: pool });
    if (!isLendingV2ProofForContext(proof, context)) {
      throw new ProtocolError("INVALID_PROOF", "A locally verified proof for this wallet, policy 3, credential, chain, and V2 pool is required.");
    }
  }, [account.address, client, pool]);

  const refetch = useCallback(async () => {
    await marketQuery.refetch();
    await deploymentQuery.refetch();
  }, [deploymentQuery, marketQuery]);

  const inspectPosition = useCallback(async (wallet: Address) => {
    if (!pool || !client) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The V2 public read client is unavailable.");
    const snapshot = await queryClient.fetchQuery({
      queryKey: lendingV2MarketQueryKey(pool, wallet),
      queryFn: () => readLendingV2Market(client, { pool, wallet, expectedRegistry: projectContracts.credentialRegistry }),
      staleTime: 8_000,
    });
    return snapshot.position;
  }, [client, pool, queryClient]);

  const run = useCallback(async (input: {
    simulate: () => Promise<{ request: WriteRequest }>;
    readback: (receipt: Awaited<ReturnType<NonNullable<typeof client>["waitForTransactionReceipt"]>>) => Promise<boolean>;
  }) => {
    let phase: "validating" | "simulating" | "signature" | "submitted" | "confirming" | "readback" = "validating";
    let hash: Hex | undefined;
    let explorerUrl: string | undefined;
    setFailure(undefined);
    try {
      setTransaction({ state: "simulating" });
      await assertBase();
      if (!client || !account.address) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The wallet or GIWA RPC client is unavailable.");
      phase = "simulating";
      setTransaction({ state: "simulating" });
      const simulation = await input.simulate();
      phase = "signature";
      setTransaction({ state: "awaiting-signature" });
      hash = await writer.writeContractAsync(simulation.request);
      explorerUrl = `${GIWA_EXPLORER_URL}/tx/${hash}`;
      phase = "submitted";
      setTransaction({ state: "submitted", hash, explorerUrl });
      phase = "confirming";
      setTransaction({ state: "confirming", hash, explorerUrl });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setTransaction({ state: "reverted", hash, explorerUrl, error: "The transaction was included but reverted on-chain." });
        const reverted = new ProtocolError("RPC_ERROR", "The Lending V2 transaction reverted on-chain.");
        setFailure({ category: "unknown", code: "transaction-reverted", message: reverted.message });
        throw reverted;
      }
      phase = "readback";
      await queryClient.invalidateQueries({ queryKey: ["lending-v2-market", String(GIWA_CHAIN_ID), pool?.toLowerCase()] });
      await marketQuery.refetch();
      if (!await input.readback(receipt)) {
        const unconfirmed = new ProtocolError("TRANSACTION_STATE_UNCONFIRMED", "The receipt succeeded, but post-transaction state could not be confirmed by readback.");
        setTransaction({ state: "rpc-error", hash, explorerUrl, error: unconfirmed.message });
        setFailure({ category: "rpc", code: "readback-failed", message: unconfirmed.message });
        throw unconfirmed;
      }
      setTransaction({ state: "confirmed", hash, explorerUrl });
    } catch (error) {
      if (error instanceof ProtocolError && error.code === "TRANSACTION_STATE_UNCONFIRMED") throw error;
      if (error instanceof ProtocolError && error.message === "The Lending V2 transaction reverted on-chain.") throw error;
      const mapped = mapLendingV2Error(error);
      setFailure(mapped);
      if (phase === "validating") setTransaction({ state: "rpc-error", error: `Input validation failed. ${mapped.message}` });
      else if (phase === "simulating") setTransaction({ state: "rpc-error", error: `Simulation failed before submission. ${mapped.message}` });
      else if (mapped.category === "wallet") setTransaction({ state: "rejected", hash, explorerUrl, error: mapped.message });
      else if (phase === "confirming" && hash) setTransaction({ state: "rpc-error", hash, explorerUrl, error: mapped.message });
      else if (hash) setTransaction({ state: "rpc-error", hash, explorerUrl, error: mapped.message });
      else setTransaction({ state: "rpc-error", error: mapped.message });
      if (!(error instanceof ProtocolError)) throw new ProtocolError("RPC_ERROR", mapped.message, error);
      throw error;
    }
  }, [account.address, assertBase, client, marketQuery, pool, queryClient, writer]);

  const simulatePool = useCallback(async <TFunctionName extends "supply" | "withdrawSupply" | "depositCollateral" | "setCollateralEnabled" | "withdrawCollateral" | "borrow" | "repay" | "liquidate">(
    functionName: TFunctionName,
    args: readonly unknown[],
  ): Promise<{ request: WriteRequest }> => {
    if (!client || !pool || !account.address) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The V2 pool or wallet is unavailable.");
    const result = await client.simulateContract({
      account: account.address,
      address: pool,
      abi: lendingPoolV2Abi,
      functionName,
      args,
    } as never);
    return { request: result.request as WriteRequest };
  }, [account.address, client, pool]);

  const approveToken = useCallback(async (asset: Address, requestedAmount: bigint) => {
    const amount = positiveAmount(requestedAmount);
    await run({
      simulate: async () => {
        await assertSupportedAsset(asset);
        if (!client || !pool || !account.address) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The V2 token approval context is unavailable.");
        const result = await client.simulateContract({
          account: account.address,
          address: asset,
          abi: controlledTokenAbi,
          functionName: "approve",
          args: [pool, amount],
        });
        return { request: result.request as WriteRequest };
      },
      readback: async () => {
        if (!client || !pool || !account.address) return false;
        const allowance = await client.readContract({ address: asset, abi: controlledTokenAbi, functionName: "allowance", args: [account.address, pool] });
        return allowance >= amount;
      },
    });
  }, [account.address, assertSupportedAsset, client, pool, run]);

  const supply = useCallback(async (asset: Address, requestedAmount: bigint, proof: EligibilityProof) => {
    const amount = positiveAmount(requestedAmount);
    let suppliedBefore: bigint | undefined;
    let balanceBefore: bigint | undefined;
    await run({
      simulate: async () => {
        await assertSupportedAsset(asset);
        await assertV2Proof(proof);
        if (!client || !pool || !account.address) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The V2 supply context is unavailable.");
        const [positionBefore, walletBalance] = await Promise.all([
          readPosition(client, pool, account.address, asset),
          readTokenBalance(asset, account.address),
        ]);
        suppliedBefore = positionBefore[0];
        balanceBefore = walletBalance;
        await assertBalance(asset, amount);
        await assertAllowance(asset, amount);
        return simulatePool("supply", [asset, amount, proof.proof, proof.publicInputs]);
      },
      readback: async (receipt) => {
        if (!client || !pool || !account.address) return false;
        const suppliedEvent = receiptHasV2Event(receipt, pool, "LiquiditySupplied", (args) =>
          eventAddress(args, "asset") === asset.toLowerCase() &&
          eventAddress(args, "supplier") === account.address!.toLowerCase() && eventBigint(args, "amount") === amount);
        const [position, balance] = await Promise.all([
          client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "getPosition", args: [account.address, asset] }),
          readTokenBalance(asset, account.address),
        ]);
        return Boolean(suppliedEvent && suppliedBefore !== undefined && balanceBefore !== undefined &&
          position[0] > suppliedBefore && balance === balanceBefore - amount);
      },
    });
  }, [account.address, assertAllowance, assertBalance, assertSupportedAsset, assertV2Proof, client, pool, readTokenBalance, run, simulatePool]);

  const withdrawSupply = useCallback(async (asset: Address, requestedAmount: bigint) => {
    const amount = positiveAmount(requestedAmount);
    let suppliedBefore: bigint | undefined;
    let balanceBefore: bigint | undefined;
    await run({
      simulate: async () => {
        await assertSupportedAsset(asset);
        if (!client || !pool || !account.address) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The V2 supply withdrawal context is unavailable.");
        const [position, balance] = await Promise.all([
          readPosition(client, pool, account.address, asset),
          readTokenBalance(asset, account.address),
        ]);
        suppliedBefore = position[0];
        balanceBefore = balance;
        return simulatePool("withdrawSupply", [asset, amount]);
      },
      readback: async (receipt) => {
        if (!client || !pool || !account.address) return false;
        const event = receiptHasV2Event(receipt, pool, "LiquidityWithdrawn", (args) =>
          eventAddress(args, "asset") === asset.toLowerCase() &&
          eventAddress(args, "supplier") === account.address!.toLowerCase() && eventBigint(args, "amount") === amount);
        const [position, balance] = await Promise.all([
          readPosition(client, pool, account.address, asset),
          readTokenBalance(asset, account.address),
        ]);
        return Boolean(event && suppliedBefore !== undefined && balanceBefore !== undefined &&
          position[0] < suppliedBefore && balance === balanceBefore + amount);
      },
    });
  }, [account.address, assertSupportedAsset, client, readTokenBalance, run, simulatePool]);

  const depositCollateral = useCallback(async (asset: Address, requestedAmount: bigint) => {
    const amount = positiveAmount(requestedAmount);
    let collateralBefore: bigint | undefined;
    let balanceBefore: bigint | undefined;
    await run({
      simulate: async () => {
        await assertSupportedAsset(asset);
        if (!client || !pool || !account.address) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The V2 collateral context is unavailable.");
        const [positionBefore, walletBalance] = await Promise.all([
          readPosition(client, pool, account.address, asset),
          readTokenBalance(asset, account.address),
        ]);
        collateralBefore = positionBefore[1];
        balanceBefore = walletBalance;
        await assertBalance(asset, amount);
        await assertAllowance(asset, amount);
        return simulatePool("depositCollateral", [asset, amount]);
      },
      readback: async (receipt) => {
        if (!client || !pool || !account.address) return false;
        const event = receiptHasV2Event(receipt, pool, "CollateralDeposited", (args) =>
          eventAddress(args, "asset") === asset.toLowerCase() &&
          eventAddress(args, "user") === account.address!.toLowerCase() && eventBigint(args, "amount") === amount);
        const [position, balance] = await Promise.all([
          client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "getPosition", args: [account.address, asset] }),
          readTokenBalance(asset, account.address),
        ]);
        return Boolean(event && collateralBefore !== undefined && balanceBefore !== undefined &&
          position[1] === collateralBefore + amount && balance === balanceBefore - amount);
      },
    });
  }, [account.address, assertAllowance, assertBalance, assertSupportedAsset, client, pool, readTokenBalance, run, simulatePool]);

  const setCollateralEnabled = useCallback(async (asset: Address, enabled: boolean, proof?: EligibilityProof) => {
    await run({
      simulate: async () => {
        await assertSupportedAsset(asset);
        let proofBytes: Hex = "0x";
        let publicInputs: ProofInputs = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
        if (enabled) {
          if (!proof) throw new ProtocolError("INVALID_PROOF", "Enabling collateral requires a local policy-3 proof.");
          await assertV2Proof(proof);
          proofBytes = proof.proof;
          publicInputs = proof.publicInputs;
        }
        return simulatePool("setCollateralEnabled", [asset, enabled, proofBytes, publicInputs]);
      },
      readback: async (receipt) => {
        if (!client || !pool || !account.address) return false;
        const event = receiptHasV2Event(receipt, pool, "CollateralUseChanged", (args) =>
          eventAddress(args, "asset") === asset.toLowerCase() &&
          eventAddress(args, "user") === account.address!.toLowerCase() && eventBoolean(args, "enabled") === enabled);
        const position = await client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "getPosition", args: [account.address, asset] });
        return Boolean(event && position[3] === enabled);
      },
    });
  }, [account.address, assertSupportedAsset, assertV2Proof, client, pool, run, simulatePool]);

  const enableCollateral = useCallback((asset: Address, proof: EligibilityProof) => setCollateralEnabled(asset, true, proof), [setCollateralEnabled]);
  const disableCollateral = useCallback((asset: Address) => setCollateralEnabled(asset, false), [setCollateralEnabled]);

  const withdrawCollateral = useCallback(async (asset: Address, requestedAmount: bigint) => {
    const amount = positiveAmount(requestedAmount);
    let collateralBefore: bigint | undefined;
    let balanceBefore: bigint | undefined;
    await run({
      simulate: async () => {
        await assertSupportedAsset(asset);
        if (!client || !pool || !account.address) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The V2 collateral withdrawal context is unavailable.");
        const [position, balance] = await Promise.all([
          readPosition(client, pool, account.address, asset),
          readTokenBalance(asset, account.address),
        ]);
        collateralBefore = position[1];
        balanceBefore = balance;
        return simulatePool("withdrawCollateral", [asset, amount]);
      },
      readback: async (receipt) => {
        if (!client || !pool || !account.address) return false;
        const event = receiptHasV2Event(receipt, pool, "CollateralWithdrawn", (args) =>
          eventAddress(args, "asset") === asset.toLowerCase() &&
          eventAddress(args, "user") === account.address!.toLowerCase() && eventBigint(args, "amount") === amount);
        const [position, balance] = await Promise.all([
          readPosition(client, pool, account.address, asset),
          readTokenBalance(asset, account.address),
        ]);
        return Boolean(event && collateralBefore !== undefined && balanceBefore !== undefined &&
          position[1] === collateralBefore - amount && balance === balanceBefore + amount);
      },
    });
  }, [account.address, assertSupportedAsset, client, readTokenBalance, run, simulatePool]);

  const borrow = useCallback(async (asset: Address, requestedAmount: bigint, proof: EligibilityProof) => {
    const amount = positiveAmount(requestedAmount);
    let debtBefore: bigint | undefined;
    let balanceBefore: bigint | undefined;
    await run({
      simulate: async () => {
        await assertSupportedAsset(asset);
        await assertV2Proof(proof);
        if (!client || !pool || !account.address) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The V2 borrow context is unavailable.");
        const [positionBefore, walletBalance] = await Promise.all([
          readPosition(client, pool, account.address, asset),
          readTokenBalance(asset, account.address),
        ]);
        debtBefore = positionBefore[2];
        balanceBefore = walletBalance;
        return simulatePool("borrow", [asset, amount, proof.proof, proof.publicInputs]);
      },
      readback: async (receipt) => {
        if (!client || !pool || !account.address) return false;
        const event = receiptHasV2Event(receipt, pool, "Borrowed", (args) =>
          eventAddress(args, "asset") === asset.toLowerCase() &&
          eventAddress(args, "borrower") === account.address!.toLowerCase() && eventBigint(args, "amount") === amount);
        const [position, balance] = await Promise.all([
          client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "getPosition", args: [account.address, asset] }),
          readTokenBalance(asset, account.address),
        ]);
        return Boolean(event && debtBefore !== undefined && balanceBefore !== undefined &&
          position[2] >= debtBefore + amount && balance === balanceBefore + amount);
      },
    });
  }, [account.address, assertSupportedAsset, assertV2Proof, client, pool, readTokenBalance, run, simulatePool]);

  const repay = useCallback(async (asset: Address, requestedAmount: bigint) => {
    const amount = positiveAmount(requestedAmount);
    let debtBefore: bigint | undefined;
    let balanceBefore: bigint | undefined;
    await run({
      simulate: async () => {
        await assertSupportedAsset(asset);
        if (!client || !pool || !account.address) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The V2 repayment context is unavailable.");
        const [debt, balance] = await Promise.all([
          client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [account.address, asset] }),
          readTokenBalance(asset, account.address),
        ]);
        debtBefore = debt;
        balanceBefore = balance;
        const amountNeeded = amount === maxUint256 || amount > debt ? debt : amount;
        if (debt === 0n) throw new ProtocolError("INVALID_AMOUNT", "This wallet has no debt in the selected reserve.");
        if (balance < amountNeeded) throw new ProtocolError("INSUFFICIENT_FUNDS", "The wallet balance is not enough to repay the requested debt amount.");
        await assertAllowance(asset, amountNeeded);
        return simulatePool("repay", [asset, amount]);
      },
      readback: async (receipt) => {
        if (!client || !pool || !account.address) return false;
        const event = receiptHasV2Event(receipt, pool, "Repaid", (args) =>
          eventAddress(args, "asset") === asset.toLowerCase() &&
          eventAddress(args, "borrower") === account.address!.toLowerCase() && (eventBigint(args, "amount") ?? 0n) > 0n);
        const debt = await client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [account.address, asset] });
        const balance = await readTokenBalance(asset, account.address);
        const repaidAmount = event ? eventBigintFromReceipt(receipt, pool, "Repaid", "amount") : undefined;
        return Boolean(event && debtBefore !== undefined &&
          balanceBefore !== undefined && repaidAmount !== undefined && balance === balanceBefore - repaidAmount &&
          (amount === maxUint256 ? debt === 0n : debt < debtBefore));
      },
    });
  }, [account.address, assertAllowance, assertSupportedAsset, client, pool, readTokenBalance, run, simulatePool]);

  const liquidate = useCallback(async (borrower: Address, debtAsset: Address, collateralAsset: Address, requestedRepay: bigint) => {
    const amount = positiveAmount(requestedRepay);
    let debtBefore: bigint | undefined;
    let liquidatorCollateralBefore: bigint | undefined;
    await run({
      simulate: async () => {
        await assertSupportedAsset(debtAsset);
        await assertSupportedAsset(collateralAsset);
        await assertBalance(debtAsset, amount);
        await assertAllowance(debtAsset, amount);
        if (!client || !pool) throw new ProtocolError("LENDING_NOT_CONFIGURED", "The V2 liquidation context is unavailable.");
        debtBefore = await client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [borrower, debtAsset] });
        if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect the liquidator wallet first.");
        liquidatorCollateralBefore = await readTokenBalance(collateralAsset, account.address);
        return simulatePool("liquidate", [borrower, debtAsset, collateralAsset, amount]);
      },
      readback: async (receipt) => {
        if (!client || !pool || !account.address) return false;
        const event = receiptHasV2Event(receipt, pool, "Liquidated", (args) =>
          eventAddress(args, "debtAsset") === debtAsset.toLowerCase() &&
          eventAddress(args, "collateralAsset") === collateralAsset.toLowerCase() &&
          eventAddress(args, "borrower") === borrower.toLowerCase() &&
          eventAddress(args, "liquidator") === account.address!.toLowerCase());
        const debtAfter = await client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "getDebtBalance", args: [borrower, debtAsset] });
        const collateralAfter = await readTokenBalance(collateralAsset, account.address);
        const seizedAmount = eventBigintFromReceipt(receipt, pool, "Liquidated", "seizedCollateral");
        return Boolean(event && debtBefore !== undefined && liquidatorCollateralBefore !== undefined && seizedAmount !== undefined &&
          debtAfter < debtBefore && collateralAfter === liquidatorCollateralBefore + seizedAmount);
      },
    });
  }, [account.address, assertAllowance, assertBalance, assertSupportedAsset, client, pool, readTokenBalance, run, simulatePool]);

  return {
    state,
    snapshot: marketQuery.data,
    transaction,
    failure,
    isSubmitting: transactionPending(transaction.state),
    readAvailable: Boolean(poolValue && deploymentQuery.data && marketQuery.data),
    writesAvailable: Boolean(poolValue && deploymentQuery.data && account.address && account.isGiwaSepolia && !transactionPending(transaction.state)),
    refetch,
    inspectPosition,
    approveToken,
    supply,
    withdrawSupply,
    depositCollateral,
    enableCollateral,
    disableCollateral,
    withdrawCollateral,
    borrow,
    repay,
    liquidate,
  };
}

async function readPosition(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  pool: Address,
  wallet: Address,
  asset: Address,
) {
  return client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "getPosition", args: [wallet, asset] });
}

