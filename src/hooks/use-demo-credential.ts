"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { projectContracts } from "@/lib/config/contracts";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { credentialRegistryAbi } from "@/lib/contracts/abis";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import type { DemoCredentialRecord, DemoCredentialState } from "@/lib/protocol/types";

export const DEMO_POLICY_ID = BigInt(1);
export const DEMO_POLICY_THRESHOLD = BigInt(1_000);

export function useDemoCredential(walletOverride?: `0x${string}`) {
  const account = useWalletNetwork();
  const wallet = walletOverride ?? account.address;
  const address = projectContracts.credentialRegistry;
  const query = useReadContract({
    address,
    chainId: GIWA_CHAIN_ID,
    abi: credentialRegistryAbi,
    functionName: "getCredential",
    args: wallet ? [wallet, DEMO_POLICY_ID] : undefined,
    query: { enabled: Boolean(address && wallet), retry: 1 },
  });

  const record = useMemo<DemoCredentialRecord | undefined>(() => {
    const value = query.data;
    if (!value || !value.wallet || value.wallet === "0x0000000000000000000000000000000000000000") return undefined;
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

  let state: DemoCredentialState;
  if (!wallet) state = "disconnected";
  else if (!address) state = "unconfigured";
  else if (query.isError) state = "read-error";
  else if (query.isPending) state = "checking";
  else if (!record) state = "missing";
  else if (record.revoked) state = "revoked";
  else if (record.expiresAt <= BigInt(Math.floor(Date.now() / 1000))) state = "expired";
  else state = "active";

  return {
    state,
    record,
    error: query.error,
    refetch: query.refetch,
    hasRegistry: Boolean(address),
  };
}
