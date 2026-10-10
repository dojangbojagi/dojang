"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBalance } from "wagmi";
import { CreateProposal } from "@/components/dao/create-proposal";
import { GovernanceNotice, GovernanceOverview } from "@/components/dao/dao-panels";
import { explainGovernanceFailure } from "@/components/dao/errors";
import { ProposalDetail } from "@/components/dao/proposal-detail";
import { ProposalFeed } from "@/components/dao/proposal-feed";
import type { GovRunner } from "@/components/dao/types";
import { useProjectEvidence } from "@/components/evidence/use-project-evidence";
import { TransactionPanel, type EvidenceEntry } from "@/components/lending/lending-panels";
import { WalletNetworkCard } from "@/components/wallet-network-card";
import { useDaoGovernance } from "@/hooks/use-dao-governance";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import type { GovernanceProposal } from "@/lib/protocol/types";

/**
 * The governance page. Every number and every state comes from the existing governance hooks and the contract behind
 * them; this component arranges them, gates the buttons from what the hooks report and shows what happened.
 */
export function DaoWorkspace() {
  const wallet = useWalletNetwork();
  const evidence = useProjectEvidence();
  const [selectedId, setSelectedId] = useState<bigint | undefined>();
  const [fallback, setFallback] = useState<GovernanceProposal | undefined>(); /* the list's copy, shown while the detail is read */
  /* No proposal ID is passed to the hook: it would go into the hook's query key as a bigint, which cannot be hashed.
     One proposal is read through the feed interface instead (see ProposalDetail). */
  const gov = useDaoGovernance();
  const queryClient = useQueryClient();
  const gas = useBalance({
    address: wallet.address,
    chainId: GIWA_CHAIN_ID,
    query: { enabled: Boolean(wallet.address && wallet.isGiwaSepolia) },
  });

  const [action, setAction] = useState("");
  const [banner, setBanner] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirmed, setConfirmed] = useState<EvidenceEntry[]>([]);
  const seen = useRef(new Set<string>());
  const lastAction = useRef("");
  const detailRef = useRef<HTMLDivElement>(null);

  /* the session list of confirmed transactions, built only from the hook's own confirmed lifecycle */
  const tx = gov.transaction;
  useEffect(() => {
    if (tx.state !== "confirmed" || !tx.hash || seen.current.has(tx.hash)) return;
    seen.current.add(tx.hash);
    setConfirmed((current) => [{ label: lastAction.current || "Transaction", hash: tx.hash!, explorerUrl: tx.explorerUrl }, ...current]);
  }, [tx.state, tx.hash, tx.explorerUrl]);

  const gasBalance = gas.data?.value;
  const codeState = evidence.contract("daoGovernance")?.codeState;

  let block: string | null = null;
  if (gov.state === "unconfigured") block = "The DAO governance contract is not configured, so nothing can be submitted.";
  else if (codeState === "no-code") block = "There is no contract code at the configured governance address.";
  else if (!wallet.address) block = "Connect a wallet first.";
  else if (!wallet.isGiwaSepolia) block = "Switch to GIWA Sepolia first.";
  else if (gov.state === "checking") block = "Reading the governance contract…";
  else if (gov.state === "read-error") block = "The governance contract could not be read. Refresh and try again.";
  else if (gov.isSubmitting) block = "A transaction is already in progress.";
  else if (gasBalance === 0n) block = "This wallet has no GIWA Sepolia ETH to pay the network fee.";

  const memberBlock =
    gov.isVerifiedMember === false ? "This wallet is not an official Dojang-verified member, so it cannot create proposals or vote."
    : gov.isVerifiedMember === undefined ? "Checking whether this wallet is a member…"
    : null;

  const runner: GovRunner = {
    busy: gov.isSubmitting,
    block,
    memberBlock,
    run: async (label, fn, success) => {
      lastAction.current = label;
      setAction(label);
      setBanner(null);
      try {
        const result = await fn();
        if (result === undefined) {
          setBanner({ tone: "error", text: "Not confirmed. The transaction status explains what the chain reported; nothing is assumed to have happened." });
          return false;
        }
        setBanner({ tone: "ok", text: success });
        return true;
      } catch (error) {
        setBanner({ tone: "error", text: explainGovernanceFailure(error) });
        return false;
      }
    },
  };

  function select(proposal: GovernanceProposal) {
    setSelectedId(proposal.id);
    setFallback(proposal);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }), 60);
  }

  return (
    <div className="lend dao">
      <GovernanceNotice />
      <WalletNetworkCard />
      <div className="dao-banner-slot" aria-live="polite">
        {banner && <p className={`callout ${banner.tone === "ok" ? "callout--demo" : "callout--caution"} lend-banner`} role={banner.tone === "error" ? "alert" : "status"}>{banner.text}</p>}
      </div>
      <div className="lend-layout">
        <div className="lend-main">
          <GovernanceOverview gov={gov} runner={runner} gasBalance={gasBalance} />
          <ProposalFeed selectedId={selectedId} onSelect={select} />
          <div ref={detailRef} className="dao-anchor">
            <ProposalDetail gov={gov} runner={runner} selectedId={selectedId} fallback={fallback} />
          </div>
          <CreateProposal gov={gov} runner={runner} onCreated={(id) => { setSelectedId(id); setFallback(undefined); }} />
        </div>

        <aside className="lend-side" aria-label="Transaction status">
          <TransactionPanel transaction={gov.transaction} action={action} evidence={confirmed} />
          <div className="protocol-actions">
            <button className="btn btn--secondary btn--sm" type="button" onClick={() => void Promise.all([gov.refetch(), queryClient.invalidateQueries({ queryKey: ["dao-proposal-feed"] }), queryClient.invalidateQueries({ queryKey: ["project-evidence"] })])} disabled={gov.state === "unconfigured"}>Refresh governance</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
