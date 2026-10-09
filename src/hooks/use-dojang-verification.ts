"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { decodeAbiParameters, isAddressEqual, parseAbiParameters, zeroHash } from "viem";
import { officialDojang } from "@/lib/config/contracts";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { easAbi, dojangScrollAbi } from "@/lib/contracts/abis";
import type { DojangState, OfficialDojangCredential } from "@/lib/protocol/types";

export function useDojangVerification(wallet?: `0x${string}`) {
  const enabled = Boolean(wallet);
  const statusQuery = useReadContract({
    address: officialDojang.dojangScroll,
    chainId: GIWA_CHAIN_ID,
    abi: dojangScrollAbi,
    functionName: "isVerified",
    args: wallet ? [wallet, officialDojang.upbitKoreaAttesterId] : undefined,
    query: { enabled, retry: 1 },
  });
  const uidQuery = useReadContract({
    address: officialDojang.dojangScroll,
    chainId: GIWA_CHAIN_ID,
    abi: dojangScrollAbi,
    functionName: "getVerifiedAddressAttestationUid",
    args: wallet ? [wallet, officialDojang.upbitKoreaAttesterId] : undefined,
    query: { enabled, retry: 1 },
  });
  const uid = uidQuery.data;
  const attestationQuery = useReadContract({
    address: officialDojang.eas,
    chainId: GIWA_CHAIN_ID,
    abi: easAbi,
    functionName: "getAttestation",
    args: uid && uid !== zeroHash ? [uid] : undefined,
    query: { enabled: Boolean(uid && uid !== zeroHash), retry: 1 },
  });
  const validityQuery = useReadContract({
    address: officialDojang.eas,
    chainId: GIWA_CHAIN_ID,
    abi: easAbi,
    functionName: "isAttestationValid",
    args: uid && uid !== zeroHash ? [uid] : undefined,
    query: { enabled: Boolean(uid && uid !== zeroHash), retry: 1 },
  });

  const attestation = attestationQuery.data;
  const contentVerified = useMemo(() => {
    if (!attestation || !/^0x[0-9a-fA-F]{64}$/.test(attestation.data)) return undefined;
    try {
      return decodeAbiParameters(parseAbiParameters("bool"), attestation.data)[0];
    } catch {
      return undefined;
    }
  }, [attestation]);

  const credential = useMemo<OfficialDojangCredential | undefined>(() => {
    const attestation = attestationQuery.data;
    if (!wallet || !uid || uid === zeroHash || !attestation) return undefined;
    if (contentVerified === undefined || validityQuery.data === undefined) return undefined;
    if (
      attestation.uid.toLowerCase() !== uid.toLowerCase() ||
      !isAddressEqual(attestation.recipient, wallet) ||
      !isAddressEqual(attestation.attester, officialDojang.upbitKoreaAttester) ||
      attestation.schema.toLowerCase() !== officialDojang.verifiedAddressSchemaUid.toLowerCase()
    ) return undefined;
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    let state: OfficialDojangCredential["state"] = "no-official-credential";
    if (attestation.revocationTime > BigInt(0)) state = "revoked";
    else if (attestation.expirationTime > BigInt(0) && attestation.expirationTime <= nowSeconds) state = "expired";
    else if (!validityQuery.data) state = "invalid";
    else if (contentVerified && statusQuery.data) state = "official-verified";
    else state = "no-official-credential";
    return {
      state,
      wallet,
      issuer: attestation.attester,
      attestationUid: attestation.uid,
      issuedAt: attestation.time,
      expirationTime: attestation.expirationTime,
      revocationTime: attestation.revocationTime,
      schemaUid: attestation.schema,
      isValid: validityQuery.data,
      isVerified: contentVerified,
    };
  }, [attestationQuery.data, contentVerified, statusQuery.data, uid, validityQuery.data, wallet]);

  const metadataMismatch = Boolean(
    wallet && uid && uid !== zeroHash && attestation && (
      attestation.uid.toLowerCase() !== uid.toLowerCase() ||
      !isAddressEqual(attestation.recipient, wallet) ||
      !isAddressEqual(attestation.attester, officialDojang.upbitKoreaAttester) ||
      attestation.schema.toLowerCase() !== officialDojang.verifiedAddressSchemaUid.toLowerCase()
    ),
  );

  let state: DojangState = "idle";
  if (enabled) {
    if (statusQuery.isError || uidQuery.isError || attestationQuery.isError || validityQuery.isError || metadataMismatch) state = "read-error";
    else if (statusQuery.isPending || uidQuery.isPending || (uid && uid !== zeroHash && attestationQuery.isPending)) {
      state = "checking";
    } else if (uid && uid !== zeroHash && validityQuery.isPending) {
      state = "checking";
    } else if (!uid || uid === zeroHash) state = statusQuery.data ? "read-error" : "no-official-credential";
    else if (attestation && contentVerified === undefined) state = "read-error";
    else state = credential?.state ?? "no-official-credential";
  }

  return {
    state,
    credential,
    isLoading: state === "checking",
    error: statusQuery.error ?? uidQuery.error ?? attestationQuery.error ?? validityQuery.error ??
      (attestation && contentVerified === undefined ? new Error("The Verified Address attestation data is not one ABI-encoded bool.") : undefined),
    refetch: async () => Promise.all([
      statusQuery.refetch(),
      uidQuery.refetch(),
      attestationQuery.refetch(),
      validityQuery.refetch(),
    ]),
  };
}
