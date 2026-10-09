"use client";

import { useCallback, useState } from "react";
import type { Address } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { useDemoCredential } from "@/hooks/use-demo-credential";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { projectContracts } from "@/lib/config/contracts";
import { credentialRegistryAbi } from "@/lib/contracts/abis";
import { explainProtocolError } from "@/lib/protocol/errors";
import { ProtocolError, type TransactionLifecycle } from "@/lib/protocol/types";

export function useDemoCredentialRevocation(walletOverride?: Address) {
  const account = useWalletNetwork();
  const wallet = walletOverride ?? account.address;
  const credential = useDemoCredential(walletOverride);
  const client = usePublicClient({ chainId: GIWA_CHAIN_ID });
  const writer = useWriteContract();
  const [transaction, setTransaction] = useState<TransactionLifecycle>({ state: "idle" });

  const revokeCredential = useCallback(async (): Promise<void> => {
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect the issuing or admin wallet first.");
    if (!account.isGiwaSepolia) throw new ProtocolError("WRONG_NETWORK", "Switch to GIWA Sepolia before revoking.");
    const registry = projectContracts.credentialRegistry;
    if (!registry || !client) throw new ProtocolError("CONTRACTS_UNCONFIGURED", "The demo registry address is not configured.");
    if (!wallet || !credential.record) throw new ProtocolError("CREDENTIAL_REQUIRED", "No project demo credential is available to revoke.");
    if (credential.record.revoked) throw new ProtocolError("CREDENTIAL_REVOKED", "This demo credential is already revoked.");

    let transactionHash: `0x${string}` | undefined;
    try {
      setTransaction({ state: "simulating" });
      const simulation = await client.simulateContract({
        account: account.address,
        address: registry,
        abi: credentialRegistryAbi,
        functionName: "revokeCredential",
        args: [wallet, 1n],
      });
      setTransaction({ state: "awaiting-signature" });
      transactionHash = await writer.writeContractAsync(simulation.request);
      const explorerUrl = `${GIWA_EXPLORER_URL}/tx/${transactionHash}`;
      setTransaction({ state: "submitted", hash: transactionHash, explorerUrl });
      setTransaction({ state: "confirming", hash: transactionHash, explorerUrl });
      const receipt = await client.waitForTransactionReceipt({ hash: transactionHash });
      if (receipt.status !== "success") {
        setTransaction({ state: "reverted", hash: transactionHash, explorerUrl, error: "The revocation transaction reverted." });
        throw new ProtocolError("RPC_ERROR", "The credential revocation transaction reverted.");
      }

      const readback = await client.readContract({
        address: registry,
        abi: credentialRegistryAbi,
        functionName: "getCredential",
        args: [wallet, 1n],
      });
      if (!readback.revoked) {
        setTransaction({
          state: "confirmed",
          hash: transactionHash,
          explorerUrl,
          error: "The transaction receipt succeeded, but the revocation readback is not confirmed yet.",
        });
        throw new ProtocolError("RPC_ERROR", "The revocation transaction confirmed, but registry readback has not updated.");
      }
      await credential.refetch();
      setTransaction({ state: "confirmed", hash: transactionHash, explorerUrl });
    } catch (error) {
      const detail = explainProtocolError(error);
      const raw = error instanceof Error ? error.message.toLowerCase() : "";
      const rejected = raw.includes("user rejected") || raw.includes("user denied");
      const errorState = rejected ? "rejected" : raw.includes("revert") ? "reverted" : "rpc-error";
      setTransaction({ state: errorState, hash: transactionHash, error: detail });
      if (raw.includes("accesscontrolunauthorizedaccount") || raw.includes("notcredentialissuer") || raw.includes("missingrole")) {
        throw new ProtocolError("ISSUER_NOT_AUTHORIZED", "This wallet is not the credential issuer or registry admin.", error);
      }
      throw error;
    }
  }, [account.address, account.isGiwaSepolia, client, credential, wallet, writer]);

  return {
    state: credential.state,
    record: credential.record,
    revokeCredential,
    transaction,
    isSubmitting: ["simulating", "awaiting-signature", "submitted", "confirming"].includes(transaction.state),
    refetch: credential.refetch,
  };
}
