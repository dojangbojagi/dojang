"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useWriteContract } from "wagmi";
import { zeroAddress, type Address } from "viem";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { getLendingV2ContractSet } from "@/lib/config/network-registry";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "@/lib/config/robinhood-mainnet-demo";
import { credentialIssuerRoleAbi, credentialRegistryAbi, lendingPoolV2Abi } from "@/lib/contracts/abis";
import { LENDING_V2_ELIGIBILITY_THRESHOLD, LENDING_V2_POLICY_ID, LENDING_V2_POLICY_VERSION } from "@/lib/lending/v2-config";
import { robinhoodLendingV2CredentialQueryKey, type LendingV2ChainId } from "@/lib/lending/v2-network";
import { readLendingV2Deployment } from "@/lib/lending/v2-service";
import { mapLendingV2Error } from "@/lib/lending/v2-errors";
import { computeEligibilityCommitment, generateFieldSalt } from "@/lib/zk/commitment";
import { ProtocolError, type TransactionLifecycle } from "@/lib/protocol/types";
import { createGyevoCredentialWitness, type DemoCredentialWitness } from "@/lib/credential/witness";

export function useLendingV2CredentialIssuance(chainId: LendingV2ChainId = ROBINHOOD_TESTNET_CHAIN_ID): {
  credentialLabel: "GYEVO Project Credential";
  transaction: TransactionLifecycle;
  isSubmitting: boolean;
  issueCredential: (input: { wallet: Address; privateValue: string; expiresAt: bigint }) => Promise<DemoCredentialWitness>;
} {
  const account = useWalletNetwork(chainId);
  const client = usePublicClient({ chainId });
  const writer = useWriteContract();
  const queryClient = useQueryClient();
  const robinhood = getLendingV2ContractSet(chainId);
  const pool = robinhood?.pool;
  const configuredRegistry = robinhood?.credentialRegistry;
  const verifier = robinhood?.verifierAdapter;
  const honkVerifier = robinhood?.verifierDependencies[2];
  const oracle = robinhood?.oracle;
  const incompleteRobinhoodConfig = !robinhood || robinhood.invalidConfigNames.length > 0 || robinhood.missingRequiredConfigNames.length > 0;
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
      if (!account.isOnExpectedNetwork) throw new ProtocolError("WRONG_NETWORK", `Switch the issuer wallet to Robinhood Chain ${chainId === ROBINHOOD_MAINNET_CHAIN_ID ? "Mainnet" : "Testnet"}.`);
      if (!client || !pool || !configuredRegistry || !robinhood || incompleteRobinhoodConfig) {
        throw new ProtocolError("LENDING_NOT_CONFIGURED", "Configure the confirmed Robinhood V2 pool and all required project dependency addresses first.");
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
      const deployment = await readLendingV2Deployment(client, pool, configuredRegistry, undefined, chainId, verifier, oracle, honkVerifier, robinhood.configuredAssets);
      if (chainId === ROBINHOOD_MAINNET_CHAIN_ID) {
        const isDemoParticipant = await client.readContract({ address: pool, abi: lendingPoolV2Abi, functionName: "isDemoParticipant", args: [input.wallet] });
        if (!isDemoParticipant) throw new ProtocolError("CREDENTIAL_REQUIRED", "Mainnet Policy 3 credentials can only be prepared for an on-chain controlled-demo participant.");
      }
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
        chainId: BigInt(chainId),
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
      hash = await writer.writeContractAsync({
        ...simulation.request,
        chainId,
      } as Parameters<typeof writer.writeContractAsync>[0]);
      explorerUrl = `${robinhood.explorerUrl}/tx/${hash}`;
      setTransaction({ state: "submitted", hash, explorerUrl });
      setTransaction({ state: "confirming", hash, explorerUrl });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setTransaction({ state: "reverted", hash, explorerUrl, error: "The GYEVO Project Credential transaction reverted on-chain." });
        throw new ProtocolError("RPC_ERROR", "The GYEVO Project Credential transaction reverted on-chain.");
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
      await queryClient.invalidateQueries({ queryKey: robinhoodLendingV2CredentialQueryKey(deployment.credentialRegistry, input.wallet, chainId) });
      const witness = createGyevoCredentialWitness({
        wallet: input.wallet,
        policyId: Number(LENDING_V2_POLICY_ID),
        commitment,
        privateValue: input.privateValue,
        salt,
        expiresAt: Number(input.expiresAt),
      }, chainId);
      setTransaction({ state: "confirmed", hash, explorerUrl });
      return witness;
    } catch (error) {
      if (error instanceof ProtocolError && error.message === "The GYEVO Project Credential transaction reverted on-chain.") throw error;
      if (error instanceof ProtocolError && error.code === "TRANSACTION_STATE_UNCONFIRMED") {
        setTransaction({ state: "rpc-error", hash, explorerUrl, error: error.message });
        throw error;
      }
      const failure = mapLendingV2Error(error);
      const rejected = failure.category === "wallet";
      setTransaction({ state: rejected ? "rejected" : hash ? "rpc-error" : "rpc-error", hash, explorerUrl, error: failure.message });
      throw error instanceof ProtocolError ? error : new ProtocolError("RPC_ERROR", failure.message, error);
    }
  }, [account.address, account.isOnExpectedNetwork, chainId, client, configuredRegistry, honkVerifier, incompleteRobinhoodConfig, oracle, pool, queryClient, verifier, writer, robinhood]);

  return {
    credentialLabel: "GYEVO Project Credential",
    transaction,
    isSubmitting: ["simulating", "awaiting-signature", "submitted", "confirming"].includes(transaction.state),
    issueCredential,
  };
}
