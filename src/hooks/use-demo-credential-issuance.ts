"use client";

import { useCallback, useState } from "react";
import { zeroAddress, type Address } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { projectContracts } from "@/lib/config/contracts";
import { credentialRegistryAbi } from "@/lib/contracts/abis";
import { explainProtocolError } from "@/lib/protocol/errors";
import { ProtocolError, type TransactionLifecycle } from "@/lib/protocol/types";
import type { DemoCredentialWitness } from "@/lib/credential/witness";
import { computeEligibilityCommitment, generateFieldSalt } from "@/lib/zk/commitment";

export function useDemoCredentialIssuance() {
  const account = useWalletNetwork();
  const client = usePublicClient({ chainId: GIWA_CHAIN_ID });
  const writer = useWriteContract();
  const [transaction, setTransaction] = useState<TransactionLifecycle>({ state: "idle" });

  const issueCredential = useCallback(async (input: {
    wallet: Address;
    privateValue: string;
    expiresAt: bigint;
  }): Promise<DemoCredentialWitness> => {
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect an issuer wallet first.");
    if (!account.isGiwaSepolia) throw new ProtocolError("WRONG_NETWORK", "Switch the issuer wallet to GIWA Sepolia.");
    const registry = projectContracts.credentialRegistry;
    const vault = projectContracts.restrictedVault;
    if (!registry || !vault || !client) {
      throw new ProtocolError("CONTRACTS_UNCONFIGURED", "Configure the deployed registry and Restricted Vault addresses first.");
    }
    if (input.expiresAt <= BigInt(Math.floor(Date.now() / 1000)) || input.expiresAt > (1n << 64n) - 1n) {
      throw new ProtocolError("INVALID_CREDENTIAL", "Expiry must be a future timestamp that fits in uint64.");
    }
    if (!Number.isSafeInteger(Number(input.expiresAt))) {
      throw new ProtocolError("INVALID_CREDENTIAL", "Expiry is outside the supported timestamp range.");
    }

    let transactionHash: `0x${string}` | undefined;
    try {
      setTransaction({ state: "simulating" });
      const current = await client.readContract({
        address: registry,
        abi: credentialRegistryAbi,
        functionName: "getCredential",
        args: [input.wallet, 1n],
      });
      const currentVersion = current.wallet === zeroAddress ? 0n : current.version;
      const expectedVersion = currentVersion + 1n;
      if (expectedVersion > (1n << 64n) - 1n) {
        throw new ProtocolError("INVALID_CREDENTIAL", "This credential has reached the maximum supported version.");
      }

      const salt = generateFieldSalt();
      const commitment = await computeEligibilityCommitment({
        subject: input.wallet,
        privateValue: input.privateValue,
        salt,
        policyId: 1n,
        policyVersion: 1n,
        threshold: 1_000n,
        credentialVersion: expectedVersion,
        expiresAt: input.expiresAt,
        chainId: BigInt(GIWA_CHAIN_ID),
        vault,
      });

      const simulation = await client.simulateContract({
        account: account.address,
        address: registry,
        abi: credentialRegistryAbi,
        functionName: "recordCredential",
        args: [input.wallet, 1n, commitment, input.expiresAt, expectedVersion],
      });
      setTransaction({ state: "awaiting-signature" });
      transactionHash = await writer.writeContractAsync(simulation.request);
      const explorerUrl = `${GIWA_EXPLORER_URL}/tx/${transactionHash}`;
      setTransaction({ state: "submitted", hash: transactionHash, explorerUrl });
      setTransaction({ state: "confirming", hash: transactionHash, explorerUrl });
      const receipt = await client.waitForTransactionReceipt({ hash: transactionHash });
      if (receipt.status !== "success") {
        setTransaction({ state: "reverted", hash: transactionHash, explorerUrl, error: "The issuer transaction reverted." });
        throw new ProtocolError("RPC_ERROR", "The credential issuance transaction reverted.");
      }

      const confirmed = await client.readContract({
        address: registry,
        abi: credentialRegistryAbi,
        functionName: "getCredential",
        args: [input.wallet, 1n],
      });
      if (
        confirmed.version !== expectedVersion ||
        confirmed.commitment.toLowerCase() !== commitment.toLowerCase() ||
        confirmed.expiresAt !== input.expiresAt
      ) {
        setTransaction({
          state: "confirmed",
          hash: transactionHash,
          explorerUrl,
          error: "The transaction confirmed, but the active credential changed before readback.",
        });
        throw new ProtocolError("CREDENTIAL_VERSION_CHANGED", "The credential changed after issuance. Do not distribute this witness; issue a new credential.");
      }

      setTransaction({ state: "confirmed", hash: transactionHash, explorerUrl });
      const witness: DemoCredentialWitness = {
        format: "giwa-demo-credential-v1",
        wallet: input.wallet,
        policyId: 1,
        commitment,
        privateValue: input.privateValue,
        salt,
        expiresAt: Number(input.expiresAt),
      };
      return witness;
    } catch (error) {
      const detail = explainProtocolError(error);
      if (!(error instanceof ProtocolError && error.code === "CREDENTIAL_VERSION_CHANGED")) {
        const raw = error instanceof Error ? error.message.toLowerCase() : "";
        const rejected = raw.includes("user rejected") || raw.includes("user denied");
        const unauthorized = raw.includes("accesscontrolunauthorizedaccount") || raw.includes("missingrole");
        const errorState = rejected ? "rejected" : raw.includes("revert") ? "reverted" : "rpc-error";
        setTransaction({ state: errorState, hash: transactionHash, error: detail });
        if (unauthorized) {
          throw new ProtocolError("ISSUER_NOT_AUTHORIZED", "This wallet does not have the registry issuer role.", error);
        }
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
