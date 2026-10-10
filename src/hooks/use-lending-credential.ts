"use client";

import { useCallback, useMemo, useState } from "react";
import { zeroAddress, type Address } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { projectContracts } from "@/lib/config/contracts";
import { credentialIssuerRoleAbi, credentialRegistryAbi } from "@/lib/contracts/abis";
import {
  LENDING_ELIGIBILITY_THRESHOLD,
  LENDING_POLICY_ID,
  LENDING_POLICY_VERSION,
} from "@/lib/lending/config";
import { computeEligibilityCommitment, generateFieldSalt } from "@/lib/zk/commitment";
import { explainProtocolError } from "@/lib/protocol/errors";
import {
  ProtocolError,
  type DemoCredentialRecord,
  type LendingCredentialState,
  type TransactionLifecycle,
} from "@/lib/protocol/types";
import type { DemoCredentialWitness } from "@/lib/credential/witness";

export function useLendingCredential(walletOverride?: Address) {
  const account = useWalletNetwork();
  const wallet = walletOverride ?? account.address;
  const registry = projectContracts.credentialRegistry;
  const query = useReadContract({
    address: registry,
    chainId: GIWA_CHAIN_ID,
    abi: credentialRegistryAbi,
    functionName: "getCredential",
    args: wallet ? [wallet, LENDING_POLICY_ID] : undefined,
    query: { enabled: Boolean(registry && wallet), retry: 1 },
  });
  const roleQuery = useReadContract({
    address: registry,
    chainId: GIWA_CHAIN_ID,
    abi: credentialIssuerRoleAbi,
    functionName: "ISSUER_ROLE",
    query: { enabled: Boolean(registry), retry: 1 },
  });

  const record = useMemo<DemoCredentialRecord | undefined>(() => {
    const value = query.data;
    if (!value || value.wallet === zeroAddress) return undefined;
    return {
      wallet: value.wallet,
      commitment: value.commitment,
      issuer: value.issuer,
      issuedAt: value.issuedAt,
      expiresAt: value.expiresAt,
      version: value.version,
      revoked: value.revoked,
    };
  }, [query.data]);

  const issuerQuery = useReadContract({
    address: registry,
    chainId: GIWA_CHAIN_ID,
    abi: credentialIssuerRoleAbi,
    functionName: "hasRole",
    args: record && roleQuery.data ? [roleQuery.data, record.issuer] : undefined,
    query: { enabled: Boolean(registry && record && roleQuery.data), retry: 1 },
  });

  let state: LendingCredentialState;
  if (!wallet) state = "disconnected";
  else if (!registry) state = "unconfigured";
  else if (query.isError || roleQuery.isError || issuerQuery.isError) state = "read-error";
  else if (query.isPending || roleQuery.isPending || (record && issuerQuery.isPending)) state = "checking";
  else if (!record) state = "missing";
  else if (record.revoked) state = "revoked";
  else if (record.expiresAt <= BigInt(Math.floor(Date.now() / 1000))) state = "expired";
  else if (issuerQuery.data !== true) state = "issuer-untrusted";
  else state = "active";

  return {
    state,
    record,
    issuerAuthorized: issuerQuery.data === true,
    error: query.error ?? roleQuery.error ?? issuerQuery.error,
    refetch: query.refetch,
    hasRegistry: Boolean(registry),
  };
}

export function useLendingCredentialIssuance() {
  const account = useWalletNetwork();
  const client = usePublicClient({ chainId: GIWA_CHAIN_ID });
  const writer = useWriteContract();
  const [transaction, setTransaction] = useState<TransactionLifecycle>({ state: "idle" });

  const issueCredential = useCallback(async (input: {
    wallet: Address;
    privateValue: string;
    expiresAt: bigint;
  }): Promise<DemoCredentialWitness> => {
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect the authorized lending issuer wallet first.");
    if (!account.isGiwaSepolia) throw new ProtocolError("WRONG_NETWORK", "Switch the issuer wallet to GIWA Sepolia.");
    const registry = projectContracts.credentialRegistry;
    const lendingPool = projectContracts.lendingPool;
    if (!registry || !lendingPool || !client) {
      throw new ProtocolError("LENDING_NOT_CONFIGURED", "Configure the deployed registry and lending pool before issuing a lending credential.");
    }
    if (!/^(0|[1-9][0-9]*)$/.test(input.privateValue)) {
      throw new ProtocolError("INVALID_CREDENTIAL", "The private eligibility value must be an unsigned decimal integer.");
    }
    if (BigInt(input.privateValue) < LENDING_ELIGIBILITY_THRESHOLD) {
      throw new ProtocolError("INVALID_CREDENTIAL", "The private value does not meet the lending policy threshold.");
    }
    if (
      input.expiresAt <= BigInt(Math.floor(Date.now() / 1000)) ||
      input.expiresAt > (1n << 64n) - 1n ||
      !Number.isSafeInteger(Number(input.expiresAt))
    ) {
      throw new ProtocolError("INVALID_CREDENTIAL", "Expiry must be a future timestamp supported by uint64 and JavaScript.");
    }

    let transactionHash: `0x${string}` | undefined;
    try {
      setTransaction({ state: "simulating" });
      const current = await client.readContract({
        address: registry,
        abi: credentialRegistryAbi,
        functionName: "getCredential",
        args: [input.wallet, LENDING_POLICY_ID],
      });
      const currentVersion = current.wallet === zeroAddress ? 0n : current.version;
      const expectedVersion = currentVersion + 1n;
      if (expectedVersion > (1n << 64n) - 1n) {
        throw new ProtocolError("INVALID_CREDENTIAL", "This lending credential reached the maximum supported version.");
      }

      const salt = generateFieldSalt();
      const commitment = await computeEligibilityCommitment({
        subject: input.wallet,
        privateValue: input.privateValue,
        salt,
        policyId: LENDING_POLICY_ID,
        policyVersion: LENDING_POLICY_VERSION,
        threshold: LENDING_ELIGIBILITY_THRESHOLD,
        credentialVersion: expectedVersion,
        expiresAt: input.expiresAt,
        chainId: BigInt(GIWA_CHAIN_ID),
        vault: lendingPool,
      });

      const simulation = await client.simulateContract({
        account: account.address,
        address: registry,
        abi: credentialRegistryAbi,
        functionName: "recordCredential",
        args: [input.wallet, LENDING_POLICY_ID, commitment, input.expiresAt, expectedVersion],
      });
      setTransaction({ state: "awaiting-signature" });
      transactionHash = await writer.writeContractAsync(simulation.request);
      const explorerUrl = `${GIWA_EXPLORER_URL}/tx/${transactionHash}`;
      setTransaction({ state: "submitted", hash: transactionHash, explorerUrl });
      setTransaction({ state: "confirming", hash: transactionHash, explorerUrl });
      const receipt = await client.waitForTransactionReceipt({ hash: transactionHash });
      if (receipt.status !== "success") {
        setTransaction({ state: "reverted", hash: transactionHash, explorerUrl, error: "The lending credential transaction reverted." });
        throw new ProtocolError("RPC_ERROR", "The lending credential transaction reverted.");
      }

      const confirmed = await client.readContract({
        address: registry,
        abi: credentialRegistryAbi,
        functionName: "getCredential",
        args: [input.wallet, LENDING_POLICY_ID],
      });
      if (
        confirmed.version !== expectedVersion ||
        confirmed.commitment.toLowerCase() !== commitment.toLowerCase() ||
        confirmed.expiresAt !== input.expiresAt ||
        confirmed.issuer.toLowerCase() !== account.address.toLowerCase() ||
        confirmed.revoked
      ) {
        setTransaction({
          state: "rpc-error",
          hash: transactionHash,
          explorerUrl,
          error: "The receipt succeeded, but the lending credential readback did not match the issued commitment.",
        });
        throw new ProtocolError("TRANSACTION_STATE_UNCONFIRMED", "The lending credential transaction is not confirmed by registry readback.");
      }

      setTransaction({ state: "confirmed", hash: transactionHash, explorerUrl });
      return {
        format: "giwa-demo-credential-v1",
        wallet: input.wallet,
        policyId: Number(LENDING_POLICY_ID),
        commitment,
        privateValue: input.privateValue,
        salt,
        expiresAt: Number(input.expiresAt),
      };
    } catch (error) {
      if (error instanceof ProtocolError && error.code === "TRANSACTION_STATE_UNCONFIRMED") throw error;
      const detail = explainProtocolError(error);
      const raw = error instanceof Error ? error.message.toLowerCase() : "";
      const rejected = raw.includes("user rejected") || raw.includes("user denied");
      const unauthorized = raw.includes("accesscontrolunauthorizedaccount") || raw.includes("missingrole");
      setTransaction({ state: rejected ? "rejected" : raw.includes("revert") ? "reverted" : "rpc-error", hash: transactionHash, error: detail });
      if (unauthorized) {
        throw new ProtocolError("ISSUER_NOT_AUTHORIZED", "This wallet does not have the registry issuer role.", error);
      }
      throw error;
    }
  }, [account.address, account.isGiwaSepolia, client, writer]);

  return {
    issueCredential,
    transaction,
    isSubmitting: ["simulating", "awaiting-signature", "submitted", "confirming"].includes(transaction.state),
  };
}
