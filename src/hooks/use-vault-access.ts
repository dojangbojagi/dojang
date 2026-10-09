"use client";

import { useCallback, useState } from "react";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { projectContracts } from "@/lib/config/contracts";
import { restrictedVaultAbi } from "@/lib/contracts/abis";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { useDemoCredential } from "@/hooks/use-demo-credential";
import { useDemoWitness } from "@/components/witness-context";
import { explainProtocolError } from "@/lib/protocol/errors";
import { ProtocolError, type EligibilityProof, type TransactionLifecycle, type VaultState } from "@/lib/protocol/types";

export function useVaultAccess() {
  const account = useWalletNetwork();
  const client = usePublicClient({ chainId: GIWA_CHAIN_ID });
  const writer = useWriteContract();
  const credential = useDemoCredential();
  const { proof } = useDemoWitness();
  const [transaction, setTransaction] = useState<TransactionLifecycle>({ state: "idle" });
  const [enteredWallet, setEnteredWallet] = useState<string>();
  const vaultAddress = projectContracts.restrictedVault;
  const accessQuery = useReadContract({
    address: vaultAddress,
    abi: restrictedVaultAbi,
    functionName: "hasAccess",
    args: account.address ? [account.address] : undefined,
    query: { enabled: Boolean(vaultAddress && account.address), retry: 1 },
  });
  const thresholdQuery = useReadContract({
    address: vaultAddress,
    abi: restrictedVaultAbi,
    functionName: "threshold",
    query: { enabled: Boolean(vaultAddress), retry: 1 },
  });

  let state: VaultState;
  if (!vaultAddress) state = "unconfigured";
  else if (!account.address) state = "disconnected";
  else if (accessQuery.isError || thresholdQuery.isError) state = "read-error";
  else if (accessQuery.isPending || thresholdQuery.isPending) state = "checking";
  else if (accessQuery.data) state = enteredWallet?.toLowerCase() === account.address?.toLowerCase() ? "access-granted" : "previously-granted";
  else if (
    proof?.localVerification === "verified" &&
    account.address &&
    credential.state === "active" &&
    credential.record &&
    proof.publicContext.subject.toLowerCase() === account.address.toLowerCase() &&
    proof.publicContext.commitment.toLowerCase() === credential.record.commitment.toLowerCase() &&
    proof.publicContext.policyId === 1n &&
    proof.publicContext.policyVersion === 1n &&
    proof.publicContext.threshold === 1_000n &&
    proof.publicContext.credentialVersion === credential.record.version &&
    proof.publicContext.expiresAt === credential.record.expiresAt &&
    proof.publicContext.vault.toLowerCase() === vaultAddress?.toLowerCase() &&
    proof.publicContext.chainId === BigInt(GIWA_CHAIN_ID)
  ) state = "eligible";
  else state = "locked";

  const enterVault = useCallback(async (eligibilityProof: EligibilityProof) => {
    if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect the credential wallet to enter the vault.");
    if (!account.isGiwaSepolia) throw new ProtocolError("WRONG_NETWORK", "Switch to GIWA Sepolia before submitting a proof.");
    if (!vaultAddress || !client) throw new ProtocolError("CONTRACTS_UNCONFIGURED", "The vault contract or GIWA RPC client is not configured.");
    if (!eligibilityProof.proof || eligibilityProof.localVerification !== "verified" || eligibilityProof.publicInputs.length !== 9) {
      throw new ProtocolError("INVALID_PROOF", "The proof payload is incomplete or has the wrong public-input length.");
    }
    const expectedInputs = [
      BigInt(eligibilityProof.publicContext.subject),
      BigInt(eligibilityProof.publicContext.commitment),
      eligibilityProof.publicContext.policyId,
      eligibilityProof.publicContext.policyVersion,
      eligibilityProof.publicContext.threshold,
      eligibilityProof.publicContext.credentialVersion,
      eligibilityProof.publicContext.expiresAt,
      eligibilityProof.publicContext.chainId,
      BigInt(eligibilityProof.publicContext.vault),
    ];
    if (eligibilityProof.publicInputs.some((value, index) => value !== expectedInputs[index])) {
      throw new ProtocolError("INVALID_PROOF", "The public input tuple does not match its proof context.");
    }
    if (eligibilityProof.publicContext.subject.toLowerCase() !== account.address.toLowerCase()) {
      throw new ProtocolError("CREDENTIAL_MISMATCH", "This proof was prepared for a different wallet.");
    }
    if (eligibilityProof.publicContext.vault.toLowerCase() !== vaultAddress.toLowerCase()) {
      throw new ProtocolError("INVALID_PROOF", "This proof was prepared for a different Restricted Vault address.");
    }
    if (eligibilityProof.publicContext.chainId !== BigInt(GIWA_CHAIN_ID)) {
      throw new ProtocolError("WRONG_NETWORK", "This proof was prepared for a different chain.");
    }

    setTransaction({ state: "simulating" });
    try {
      const publicInputs = eligibilityProof.publicInputs;
      const simulation = await client.simulateContract({
        account: account.address,
        address: vaultAddress,
        abi: restrictedVaultAbi,
        functionName: "enterVault",
        args: [eligibilityProof.proof, publicInputs],
      });
      setTransaction({ state: "awaiting-signature" });
      const hash = await writer.writeContractAsync(simulation.request);
      setTransaction({ state: "submitted", hash, explorerUrl: `${GIWA_EXPLORER_URL}/tx/${hash}` });
      setTransaction({ state: "confirming", hash, explorerUrl: `${GIWA_EXPLORER_URL}/tx/${hash}` });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setTransaction({ state: "reverted", hash, explorerUrl: `${GIWA_EXPLORER_URL}/tx/${hash}`, error: "The contract reverted the vault entry." });
        return;
      }
      const readback = await accessQuery.refetch();
      if (readback.data !== true) {
        setTransaction({
          state: "confirmed",
          hash,
          explorerUrl: `${GIWA_EXPLORER_URL}/tx/${hash}`,
          error: "The transaction receipt succeeded, but the access state readback is not confirmed yet.",
        });
        return;
      }
      setEnteredWallet(account.address);
      setTransaction({ state: "confirmed", hash, explorerUrl: `${GIWA_EXPLORER_URL}/tx/${hash}` });
    } catch (error) {
      const detail = explainProtocolError(error);
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const rejected = message.includes("user rejected") || message.includes("user denied");
      setTransaction({ state: rejected ? "rejected" : "rpc-error", error: detail });
      throw error;
    }
  }, [account.address, account.isGiwaSepolia, accessQuery, client, vaultAddress, writer]);

  return {
    state,
    hasAccess: Boolean(accessQuery.data),
    threshold: thresholdQuery.data,
    transaction,
    enterVault,
    refetch: accessQuery.refetch,
    isSubmitting: ["simulating", "awaiting-signature", "submitted", "confirming"].includes(transaction.state),
  };
}
