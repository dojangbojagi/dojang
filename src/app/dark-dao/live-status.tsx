"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProtocolNetworkSelection } from "@/components/protocol-network-selection";
import { useRobinhoodDaoPhase2 } from "@/hooks/use-robinhood-dao-phase2";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "@/lib/config/robinhood-mainnet-demo";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";

export function DarkDaoNetworkStatus({ mainnetVisible }: { mainnetVisible: boolean }) {
  const { selectedChainId } = useProtocolNetworkSelection();
  const wallet = useWalletNetwork(selectedChainId);
  const networkName = selectedChainId === ROBINHOOD_MAINNET_CHAIN_ID
    ? "Robinhood Mainnet"
    : "Robinhood Testnet";
  const walletState = !wallet.isConnected
    ? "No wallet connected"
    : wallet.providerChainPending
      ? "Verifying wallet network"
      : wallet.isOnExpectedNetwork
        ? "Verified on the selected network"
        : "Wallet network mismatch; transactions remain gated";

  return (
    <dl className="dark-dao-network__readout">
      <div>
        <dt>Selected network</dt>
        <dd>{networkName} · {selectedChainId}</dd>
      </div>
      <div>
        <dt>Wallet</dt>
        <dd aria-live="polite">{walletState}</dd>
      </div>
      {mainnetVisible && (
        <div>
          <dt>Phase 1 Mainnet state</dt>
          <dd><Link href="/contracts#mainnet-protocol-state-heading">Check Phase 1 Mainnet state</Link></dd>
        </div>
      )}
    </dl>
  );
}

const phase2StateLabel: Record<string, string> = {
  "deployment-pending": "Contract addresses not configured",
  unconfigured: "No Phase 2 deployment configured for this network",
  checking: "Reading Phase 2 contract state",
  "read-error": "Live contract read unavailable",
  "no-code": "No contract code found at a configured address",
  "dependency-mismatch": "Configured contracts do not match their dependencies",
  ready: "Live contract state read",
};

export function DarkDaoPhase2Status() {
  const { selectedChainId } = useProtocolNetworkSelection();
  const wallet = useWalletNetwork(selectedChainId);
  const [proposalId, setProposalId] = useState<bigint>();
  const dao = useRobinhoodDaoPhase2(proposalId, selectedChainId);
  const snapshot = dao.snapshot;

  useEffect(() => {
    setProposalId(undefined);
  }, [selectedChainId]);

  useEffect(() => {
    if (proposalId === undefined && snapshot && snapshot.nextProposalId > 1n) {
      setProposalId(snapshot.nextProposalId - 1n);
    }
  }, [proposalId, snapshot?.nextProposalId]);

  const proposalStatus = !snapshot
    ? "Not available until the contract read completes"
    : snapshot.proposal
      ? `Proposal ${snapshot.proposal.id.toString()} · ${snapshot.proposal.state}`
      : snapshot.nextProposalId <= 1n
        ? "No proposals recorded"
        : "Latest proposal state unavailable";
  const eligibilityStatus = !wallet.isConnected
    ? "Connect a wallet to read its eligibility"
    : !wallet.isOnExpectedNetwork
      ? "Verify the wallet on the selected network to read eligibility"
      : !snapshot
        ? "Eligibility read unavailable"
        : undefined;

  return (
    <section className="dark-dao-live" role="region" aria-label="Phase 2 live status">
      <div className="dark-dao-section-heading">
        <h2>Phase 2 live governance status</h2>
        <p>Read-only contract and eligibility state for the selected network.</p>
      </div>
      <p className="dark-dao-live__state" data-status={dao.state} aria-live="polite">
        <span aria-hidden="true" />{phase2StateLabel[dao.state] ?? "Phase 2 state unavailable"}
      </p>
      <dl className="dark-dao-network__readout dark-dao-network__readout--live">
        {snapshot && (
          <>
            <div>
              <dt>Governance</dt>
              <dd>{snapshot.paused ? "Paused" : "Unpaused"}</dd>
            </div>
            <div>
              <dt>Reputation registry</dt>
              <dd>{snapshot.reputationPaused ? "Paused" : "Unpaused"}</dd>
            </div>
            <div>
              <dt>Minimum reputation threshold</dt>
              <dd>{snapshot.minimumReputation.toString()}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Latest proposal</dt>
          <dd>{proposalStatus}</dd>
        </div>
        {eligibilityStatus ? (
          <div>
            <dt>Wallet eligibility</dt>
            <dd>{eligibilityStatus}</dd>
          </div>
        ) : snapshot && (
          <>
            <div>
              <dt>Policy 5 credential</dt>
              <dd>{snapshot.credentialActive ? "Active" : "No active credential"}</dd>
            </div>
            <div>
              <dt>Reputation claim</dt>
              <dd>{snapshot.reputation ? snapshot.reputation.active ? "Active" : "Inactive" : "No claim recorded"}</dd>
            </div>
            <div>
              <dt>ZK membership</dt>
              <dd>{snapshot.membership?.active ? "Active" : "No active membership"}</dd>
            </div>
          </>
        )}
      </dl>
      {dao.deployment?.governance && (
        <p className="dark-dao-live__contract">
          <a href={`${dao.deployment.explorerUrl}/address/${dao.deployment.governance}`} target="_blank" rel="noopener noreferrer">
            View Phase 2 governance contract<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </p>
      )}
    </section>
  );
}
