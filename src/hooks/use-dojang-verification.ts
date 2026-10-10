"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { isAddressEqual, zeroHash } from "viem";
import { officialDojang } from "@/lib/config/contracts";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { dojangAttesterBookAbi, easAbi, dojangScrollAbi } from "@/lib/contracts/abis";
import { decodeVerifiedAddressContent } from "@/lib/protocol/dojang-content";
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
    // The official Dojang query flow requests a UID only after isVerified is true.
    // On GIWA Sepolia, asking for a missing UID can revert instead of returning zeroHash.
    query: { enabled: enabled && statusQuery.data === true, retry: 1 },
  });
  const trustedAttesterQuery = useReadContract({
    address: officialDojang.dojangAttesterBook,
    chainId: GIWA_CHAIN_ID,
    abi: dojangAttesterBookAbi,
    functionName: "getAttester",
    args: [officialDojang.upbitKoreaAttesterId],
    query: { retry: 1 },
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
    if (!attestation) return undefined;
    return decodeVerifiedAddressContent(attestation.data);
  }, [attestation]);

  const credential = useMemo<OfficialDojangCredential | undefined>(() => {
    const attestation = attestationQuery.data;
    if (!wallet || !uid || uid === zeroHash || !attestation) return undefined;
    if (contentVerified === undefined || validityQuery.data === undefined) return undefined;
    if (
      attestation.uid.toLowerCase() !== uid.toLowerCase() ||
      !isAddressEqual(attestation.recipient, wallet) ||
      !trustedAttesterQuery.data ||
      !isAddressEqual(attestation.attester, trustedAttesterQuery.data) ||
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
  }, [attestationQuery.data, contentVerified, statusQuery.data, trustedAttesterQuery.data, uid, validityQuery.data, wallet]);

  const metadataMismatch = Boolean(
    wallet && uid && uid !== zeroHash && attestation && (
      attestation.uid.toLowerCase() !== uid.toLowerCase() ||
      !isAddressEqual(attestation.recipient, wallet) ||
      Boolean(trustedAttesterQuery.data && !isAddressEqual(attestation.attester, trustedAttesterQuery.data)) ||
      attestation.schema.toLowerCase() !== officialDojang.verifiedAddressSchemaUid.toLowerCase()
    ),
  );

  let state: DojangState = "idle";
  if (enabled) {
    if (statusQuery.isError || metadataMismatch) state = "read-error";
    else if (statusQuery.isPending) state = "checking";
    else if (statusQuery.data === false) state = "no-official-credential";
    else if (statusQuery.data === true) {
      if (uidQuery.isError || trustedAttesterQuery.isError || attestationQuery.isError || validityQuery.isError) state = "read-error";
      else if (
        uidQuery.isPending || trustedAttesterQuery.isPending ||
        (uid && uid !== zeroHash && (attestationQuery.isPending || validityQuery.isPending))
      ) {
        state = "checking";
      } else if (!uid || uid === zeroHash) state = "read-error";
      else if (!trustedAttesterQuery.data || trustedAttesterQuery.data === "0x0000000000000000000000000000000000000000") state = "read-error";
      else if (attestation && contentVerified === undefined) state = "read-error";
      else state = credential?.state ?? "no-official-credential";
    } else state = "checking";
  }

  return {
    state,
    credential,
    trustedAttester: trustedAttesterQuery.data,
    isTrustedAttesterLoading: trustedAttesterQuery.isLoading,
    trustedAttesterError: trustedAttesterQuery.error,
    isLoading: state === "checking",
    error: statusQuery.error ?? uidQuery.error ?? trustedAttesterQuery.error ?? attestationQuery.error ?? validityQuery.error ??
      (attestation && contentVerified === undefined ? new Error("The Verified Address attestation data is not one ABI-encoded bool.") : undefined),
    refetch: async () => {
      const status = await statusQuery.refetch();
      if (status.data !== true) return status;
      const [uidResult] = await Promise.all([uidQuery.refetch(), trustedAttesterQuery.refetch()]);
      if (uidResult.data && uidResult.data !== zeroHash) {
        await Promise.all([attestationQuery.refetch(), validityQuery.refetch()]);
      }
      return uidResult;
    },
  };
}
