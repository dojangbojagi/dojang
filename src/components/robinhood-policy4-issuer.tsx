"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { decodeEventLog, getAddress, isAddress, toHex, type Address, type Hex } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { robinhoodContracts } from "@/lib/config/contracts";
import { credentialIssuerRoleAbi, credentialRegistryAbi } from "@/lib/contracts/abis";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";

type IssuanceState = "idle" | "simulating" | "awaiting-signature" | "confirming" | "confirmed" | "reverted" | "unconfirmed" | "error";

function makeCommitment(): Hex {
  const bytes = new Uint8Array(32);
  do {
    crypto.getRandomValues(bytes);
  } while (bytes.every((value) => value === 0));
  return toHex(bytes);
}

function errorText(error: unknown): string {
  const visited = new Set<unknown>();
  const pending: unknown[] = [error];
  const messages: string[] = [];
  while (pending.length) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    const item = current as { message?: unknown; shortMessage?: unknown; cause?: unknown; code?: unknown };
    if (typeof item.shortMessage === "string") messages.push(item.shortMessage);
    else if (typeof item.message === "string") messages.push(item.message);
    if (item.code === 4001 || /user rejected|user denied/i.test(String(item.message ?? item.shortMessage ?? ""))) {
      return "The wallet request was rejected. No credential was issued.";
    }
    pending.push(item.cause);
  }
  const joined = messages.join(" ");
  if (/insufficient funds/i.test(joined)) return "This issuer wallet needs more Robinhood Testnet ETH for the network fee.";
  if (/wrong network|chain id|unsupportedchain/i.test(joined)) return "Switch the issuer wallet to Robinhood Testnet (chain 46630).";
  return "The credential request could not be confirmed. Refresh the registry status before trying again.";
}

/** Issuer-only browser flow for the no-witness Policy 4 DAO credential. */
export function RobinhoodPolicy4Issuer() {
  const wallet = useWalletNetwork(ROBINHOOD_TESTNET_CHAIN_ID);
  const client = usePublicClient({ chainId: ROBINHOOD_TESTNET_CHAIN_ID });
  const writer = useWriteContract();
  const queryClient = useQueryClient();
  const registry = robinhoodContracts.credentialRegistry;
  const [recipientText, setRecipientText] = useState("");
  const [expiryDaysText, setExpiryDaysText] = useState("30");
  const [issuanceState, setIssuanceState] = useState<IssuanceState>("idle");
  const [hash, setHash] = useState<`0x${string}`>();
  const [message, setMessage] = useState("");

  const recipient = useMemo<Address | undefined>(() => {
    const value = recipientText.trim();
    if (!isAddress(value, { strict: false })) return undefined;
    try { return getAddress(value); } catch { return undefined; }
  }, [recipientText]);
  const days = Number(expiryDaysText);
  const validDays = Number.isInteger(days) && days >= 1 && days <= 365;

  const roleQuery = useReadContract({
    address: registry,
    chainId: ROBINHOOD_TESTNET_CHAIN_ID,
    abi: credentialIssuerRoleAbi,
    functionName: "ISSUER_ROLE",
    query: { enabled: Boolean(registry && wallet.address), retry: 1 },
  });
  const authorizationQuery = useReadContract({
    address: registry,
    chainId: ROBINHOOD_TESTNET_CHAIN_ID,
    abi: credentialIssuerRoleAbi,
    functionName: "hasRole",
    args: roleQuery.data && wallet.address ? [roleQuery.data, wallet.address] : undefined,
    query: { enabled: Boolean(registry && wallet.address && roleQuery.data), retry: 1 },
  });
  const recordQuery = useReadContract({
    address: registry,
    chainId: ROBINHOOD_TESTNET_CHAIN_ID,
    abi: credentialRegistryAbi,
    functionName: "getCredential",
    args: recipient ? [recipient, 4n] : undefined,
    query: { enabled: Boolean(registry && recipient), retry: 1 },
  });

  const record = recordQuery.data;
  const hasRecord = Boolean(record && record.version > 0n);
  const authorized = authorizationQuery.data === true;
  const canIssue = Boolean(
    wallet.address && wallet.isRobinhoodTestnet && registry && client && authorized && recipient && validDays &&
    !hasRecord && !recordQuery.isPending && !recordQuery.isError &&
    !roleQuery.isError && !authorizationQuery.isError &&
    !["simulating", "awaiting-signature", "confirming", "confirmed", "unconfirmed"].includes(issuanceState),
  );

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!canIssue || !wallet.address || !registry || !client || !recipient) return;

    const issuerAddress = wallet.address;
    let submittedHash: `0x${string}` | undefined;
    try {
      setIssuanceState("simulating");
      if (await client.getChainId() !== ROBINHOOD_TESTNET_CHAIN_ID) {
        throw new Error("Wrong network: the RPC did not report chain 46630.");
      }
      const code = await client.getBytecode({ address: registry });
      if (!code || code === "0x") throw new Error("The configured project credential registry has no contract code.");

      const current = await client.readContract({
        address: registry,
        abi: credentialRegistryAbi,
        functionName: "getCredential",
        args: [recipient, 4n],
      });
      if (current.version !== 0n) throw new Error(`A policy-4 record already exists at version ${current.version}. Refresh the recipient status; this tool does not overwrite credentials.`);

      const latest = await client.getBlock({ blockTag: "latest" });
      const expiresAt = latest.timestamp + BigInt(days * 86_400);
      const commitment = makeCommitment();
      const args = [recipient, 4n, commitment, expiresAt, 1n] as const;
      const simulation = await client.simulateContract({
        account: issuerAddress,
        address: registry,
        abi: credentialRegistryAbi,
        functionName: "recordCredential",
        args,
      });

      setIssuanceState("awaiting-signature");
      const txHash = await writer.writeContractAsync({
        ...simulation.request,
        chainId: ROBINHOOD_TESTNET_CHAIN_ID,
      } as Parameters<typeof writer.writeContractAsync>[0]);
      submittedHash = txHash;
      setHash(txHash);
      setIssuanceState("confirming");

      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        setIssuanceState("reverted");
        setMessage("The credential transaction reverted on Robinhood Testnet.");
        return;
      }

      const expectedEvent = receipt.logs.some((log) => {
        if (log.address.toLowerCase() !== registry.toLowerCase()) return false;
        try {
          const decoded = decodeEventLog({ abi: credentialRegistryAbi, data: log.data, topics: log.topics, strict: false });
          if (decoded.eventName !== "CredentialCommitted") return false;
          const args = decoded.args as { wallet?: Address; policyId?: bigint; version?: bigint; commitment?: Hex; issuer?: Address; expiresAt?: bigint };
          return typeof args.wallet === "string" && typeof args.commitment === "string" && typeof args.issuer === "string" &&
            args.wallet.toLowerCase() === recipient.toLowerCase() && args.policyId === 4n &&
            args.version === 1n && args.commitment.toLowerCase() === commitment.toLowerCase() &&
            args.issuer.toLowerCase() === issuerAddress.toLowerCase() && args.expiresAt === expiresAt;
        } catch { return false; }
      });
      if (!expectedEvent) {
        setIssuanceState("unconfirmed");
        setMessage("The receipt succeeded, but the expected credential event was not found. Check the receipt before taking any further action.");
        return;
      }

      const after = await client.readContract({
        address: registry,
        abi: credentialRegistryAbi,
        functionName: "getCredential",
        args: [recipient, 4n],
      });
      if (
        after.wallet.toLowerCase() !== recipient.toLowerCase() ||
        after.issuer.toLowerCase() !== issuerAddress.toLowerCase() ||
        after.commitment.toLowerCase() !== commitment.toLowerCase() ||
        after.version !== 1n || after.expiresAt !== expiresAt || after.revoked
      ) {
        setIssuanceState("unconfirmed");
        setMessage("The receipt succeeded, but the registry readback is not confirmed. Do not retry until the explorer and registry are checked.");
        return;
      }

      setIssuanceState("confirmed");
      setMessage(`Policy 4 is active for ${recipient}. The DAO checks this project-issued record; no private witness is required.`);
      await recordQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["dao-governance"] });
      await queryClient.invalidateQueries({ queryKey: ["dao-proposal-feed"] });
    } catch (error) {
      setIssuanceState(submittedHash ? "unconfirmed" : "error");
      if (submittedHash) setHash(submittedHash);
      setMessage(submittedHash
        ? "A transaction hash exists, but its final state could not be verified. Check the receipt before retrying."
        : errorText(error));
    }
  }

  const accessText = !wallet.address
    ? "Connect the authorized project issuer wallet to use this control."
    : !wallet.isRobinhoodTestnet
      ? "Switch the issuer wallet to Robinhood Testnet (chain 46630)."
      : roleQuery.isError || authorizationQuery.isError
        ? "The issuer role could not be read; issuance is disabled until the registry can be checked."
        : roleQuery.isPending || authorizationQuery.isPending
          ? "Checking the connected wallet's issuer role…"
          : authorized
            ? "The connected wallet has the project issuer role. Each issuance still requires an explicit wallet signature."
            : "This wallet does not hold the project issuer role. An authorized issuer must create credentials.";

  return (
    <details className="protocol-panel panel panel--ticks">
      <summary className="protocol-inline-link">Authorized issuer tools · Policy 4 DAO credential</summary>
      <div className="protocol-stack">
        <p className="protocol-copy">Policy 4 is a GYEVO project credential, separate from official GIWA Dojang. The issuer chooses the recipient after the project&apos;s eligibility decision. No witness or private value is created by this policy.</p>
        <p className="small muted" role="status">{accessText}</p>
        <label className="protocol-field" htmlFor="policy4-recipient"><span>Recipient wallet</span>
          <input id="policy4-recipient" inputMode="text" autoComplete="off" spellCheck={false} value={recipientText} onChange={(event) => { setRecipientText(event.currentTarget.value); setIssuanceState("idle"); setMessage(""); }} placeholder="0x…" />
        </label>
        {recipientText.trim() && !recipient && <p className="callout callout--caution" role="alert">Enter a valid EVM wallet address.</p>}
        {recipient && recordQuery.isPending && <p className="small muted" role="status">Reading the recipient&apos;s policy-4 record…</p>}
        {recipient && recordQuery.isError && <p className="callout callout--caution" role="alert">The recipient credential could not be checked. Issuance is disabled; refresh before retrying.</p>}
        {recipient && record && hasRecord && <p className="small muted" role="status">A policy-4 record already exists at version {record.version.toString()}. This control does not overwrite or renew it.</p>}
        {recipient && record && !hasRecord && !recordQuery.isPending && !recordQuery.isError && <p className="small muted" role="status">No policy-4 record is present for this recipient.</p>}
        <form className="protocol-form" onSubmit={(event) => void issue(event)}>
          <label className="protocol-field" htmlFor="policy4-expiry-days"><span>Credential duration in days (1–365)</span>
            <input id="policy4-expiry-days" type="number" min="1" max="365" step="1" value={expiryDaysText} onChange={(event) => { setExpiryDaysText(event.currentTarget.value); setIssuanceState("idle"); setMessage(""); }} />
          </label>
          <p className="xsmall muted">The app simulates the registry call first, then asks the connected authorized issuer to sign. The credential is reported active only after a successful receipt, matching event, and registry readback.</p>
          <button className="btn btn--secondary" type="submit" disabled={!canIssue}>
            {issuanceState === "simulating" ? "Simulating issuance…" : issuanceState === "awaiting-signature" ? "Confirm in wallet…" : issuanceState === "confirming" ? "Confirming receipt…" : "Issue Policy 4 credential"}
          </button>
        </form>
        {issuanceState === "reverted" && <p className="callout callout--caution" role="alert">{message}</p>}
        {issuanceState === "error" && <p className="callout callout--caution" role="alert">{message}</p>}
        {issuanceState === "unconfirmed" && <p className="callout callout--caution" role="alert">{message}</p>}
        {issuanceState === "confirmed" && <p className="callout callout--demo" role="status" aria-live="polite">{message}</p>}
        {hash && <p className="small muted">Most recent issuer transaction: <a href={`${ROBINHOOD_TESTNET_EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noopener noreferrer">{hash}<span className="visually-hidden"> (opens in a new tab)</span></a></p>}
      </div>
    </details>
  );
}
