"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useWriteContract } from "wagmi";
import { zeroAddress, type Address } from "viem";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { projectContracts } from "@/lib/config/contracts";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { credentialIssuerRoleAbi, credentialRegistryAbi } from "@/lib/contracts/abis";
import { LENDING_V2_ELIGIBILITY_THRESHOLD, LENDING_V2_POLICY_ID, LENDING_V2_POLICY_VERSION, lendingV2CredentialQueryKey } from "@/lib/lending/v2-config";
import { readLendingV2Deployment } from "@/lib/lending/v2-service";
import { mapLendingV2Error } from "@/lib/lending/v2-errors";
import { computeEligibilityCommitment, generateFieldSalt } from "@/lib/zk/commitment";
import { ProtocolError, type TransactionLifecycle } from "@/lib/protocol/types";
import type { DemoCredentialWitness } from "@/lib/credential/witness";

export function useLendingV2CredentialIssuance(): {
  credentialLabel: "Project Test Credential";
  transaction: TransactionLifecycle;
  isSubmitting: boolean;
  issueCredential: (input: { wallet: Address; privateValue: string; expiresAt: bigint }) => Promise<DemoCredentialWitness>;
} {
  const account = useWalletNetwork();
  const client = usePublicClient({ chainId: GIWA_CHAIN_ID });
  const writer = useWriteContract();
  const queryClient = useQueryClient();
  const pool = projectContracts.lendingPoolV2;
  const configuredRegistry = projectContracts.credentialRegistry;
  const [transaction, setTransaction] = useState<TransactionLifecycle>({ state: "idle" });

  const issueCredential = useCallback(async (input: {
    wallet: Address;
    privateValue: string;
    expiresAt: bigint;
  }): Promise<DemoCredentialWitness> => {
    let hash: `0x${string}` | undefined;
    let explorerUrl: string | undefined;
    try {
      setTransaction({ state: "simulating" });
      if (!account.address) throw new ProtocolError("WALLET_REQUIRED", "Connect the authorized project issuer wallet first.");
      if (!account.isGiwaSepolia) throw new ProtocolError("WRONG_NETWORK", "Switch the issuer wallet to GIWA Sepolia.");
      if (!client || !pool || !configuredRegistry) {
        throw new ProtocolError("LENDING_NOT_CONFIGURED", "Configure a compatible V2 pool and its project credential registry first.");
      }
      if (!/^(0|[1-9][0-9]*)$/.test(input.privateValue)) {
        throw new ProtocolError("INVALID_CREDENTIAL", "The private eligibility value must be an unsigned decimal integer.");
      }
      if (BigInt(input.privateValue) < LENDING_V2_ELIGIBILITY_THRESHOLD) {
        throw new ProtocolError("INVALID_CREDENTIAL", "The private project test value does not meet policy 3's threshold.");
      }
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (input.expiresAt <= now || input.expiresAt > (1n << 64n) - 1n || !Number.isSafeInteger(Number(input.expiresAt))) {
        throw new ProtocolError("INVALID_CREDENTIAL", "Expiry must be a future uint64 timestamp representable by the witness format.");
      }
      const deployment = await readLendingV2Deployment(client, pool, configuredRegistry);
      const [role, current] = await Promise.all([
        client.readContract({ address: deployment.credentialRegistry, abi: credentialIssuerRoleAbi, functionName: "ISSUER_ROLE" }),
        client.readContract({ address: deployment.credentialRegistry, abi: credentialRegistryAbi, functionName: "getCredential", args: [input.wallet, LENDING_V2_POLICY_ID] }),
      ]);
      const authorized = await client.readContract({
        address: deployment.credentialRegistry,
        abi: credentialIssuerRoleAbi,
        functionName: "hasRole",
        args: [role, account.address],
      });
      if (!authorized) throw new ProtocolError("ISSUER_NOT_AUTHORIZED", "This wallet does not hold the project credential registry issuer role.");
      const currentVersion = current.wallet === zeroAddress ? 0n : current.version;
      const version = currentVersion + 1n;
      if (version > (1n << 64n) - 1n) throw new ProtocolError("INVALID_CREDENTIAL", "This credential reached the maximum supported version.");

      const salt = generateFieldSalt();
      const commitment = await computeEligibilityCommitment({
        subject: input.wallet,
        privateValue: input.privateValue,
        salt,
        policyId: LENDING_V2_POLICY_ID,
        policyVersion: LENDING_V2_POLICY_VERSION,
        threshold: LENDING_V2_ELIGIBILITY_THRESHOLD,
        credentialVersion: version,
        expiresAt: input.expiresAt,
        chainId: BigInt(GIWA_CHAIN_ID),
        vault: pool,
      });
      const simulation = await client.simulateContract({
        account: account.address,
        address: deployment.credentialRegistry,
        abi: credentialRegistryAbi,
        functionName: "recordCredential",
        args: [input.wallet, LENDING_V2_POLICY_ID, commitment, input.expiresAt, version],
      });
      setTransaction({ state: "awaiting-signature" });
      hash = await writer.writeContractAsync(simulation.request as Parameters<typeof writer.writeContractAsync>[0]);
      explorerUrl = `${GIWA_EXPLORER_URL}/tx/${hash}`;
      setTransaction({ state: "submitted", hash, explorerUrl });
      setTransaction({ state: "confirming", hash, explorerUrl });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setTransaction({ state: "reverted", hash, explorerUrl, error: "The Project Test Credential transaction reverted on-chain." });
        throw new ProtocolError("RPC_ERROR", "The Project Test Credential transaction reverted on-chain.");
      }
      const confirmed = await client.readContract({
        address: deployment.credentialRegistry,
        abi: credentialRegistryAbi,
        functionName: "getCredential",
        args: [input.wallet, LENDING_V2_POLICY_ID],
      });
      if (
        confirmed.wallet.toLowerCase() !== input.wallet.toLowerCase() ||
        confirmed.issuer.toLowerCase() !== account.address.toLowerCase() ||
        confirmed.commitment.toLowerCase() !== commitment.toLowerCase() ||
        confirmed.version !== version || confirmed.expiresAt !== input.expiresAt || confirmed.revoked
      ) {
        throw new ProtocolError("TRANSACTION_STATE_UNCONFIRMED", "The transaction receipt succeeded, but the policy-3 credential readback did not match.");
      }
      await queryClient.invalidateQueries({ queryKey: lendingV2CredentialQueryKey(deployment.credentialRegistry, input.wallet) });
      const witness: DemoCredentialWitness = {
        format: "giwa-demo-credential-v1",
        wallet: input.wallet,
        policyId: Number(LENDING_V2_POLICY_ID),
        commitment,
        privateValue: input.privateValue,
        salt,
        expiresAt: Number(input.expiresAt),
      };
      setTransaction({ state: "confirmed", hash, explorerUrl });
      return witness;
    } catch (error) {
      if (error instanceof ProtocolError && error.message === "The Project Test Credential transaction reverted on-chain.") throw error;
      if (error instanceof ProtocolError && error.code === "TRANSACTION_STATE_UNCONFIRMED") {
        setTransaction({ state: "rpc-error", hash, explorerUrl, error: error.message });
        throw error;
      }
      const failure = mapLendingV2Error(error);
      const rejected = failure.category === "wallet";
      setTransaction({ state: rejected ? "rejected" : hash ? "rpc-error" : "rpc-error", hash, explorerUrl, error: failure.message });
      throw error instanceof ProtocolError ? error : new ProtocolError("RPC_ERROR", failure.message, error);
    }
  }, [account.address, account.isGiwaSepolia, client, configuredRegistry, pool, queryClient, writer]);

  return {
    credentialLabel: "Project Test Credential",
    transaction,
    isSubmitting: ["simulating", "awaiting-signature", "submitted", "confirming"].includes(transaction.state),
    issueCredential,
  };
}
