"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GovernanceDependencies } from "@/components/evidence/project-contract-rows";
import { useProjectEvidence } from "@/components/evidence/use-project-evidence";
import { formatDuration, shortAddress } from "@/components/dao/format";
import type { GovRunner, Governance } from "@/components/dao/types";
import { StateChip } from "@/components/protocol-state";
import { useDojangVerification } from "@/hooks/use-dojang-verification";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { invalidContractConfig, projectContracts } from "@/lib/config/contracts";
import type { GovernanceProposalState } from "@/lib/protocol/types";

type Tone = "valid" | "pending" | "invalid" | "warn" | "demo" | "neutral";

export function Pill({ tone, children }: { tone: Tone; children: string }) {
  return <span className="status" data-state={tone}><i className="status__dot" aria-hidden="true" />{children}</span>;
}

export const PROPOSAL_LABEL: Record<GovernanceProposalState, { label: string; tone: Tone }> = {
  pending: { label: "Opens soon", tone: "pending" },
  active: { label: "Voting open", tone: "valid" },
  succeeded: { label: "Approved", tone: "valid" },
  rejected: { label: "Rejected", tone: "invalid" },
  expired: { label: "Approved, window closed", tone: "warn" },
  executed: { label: "Executed", tone: "demo" },
};

/* ---------------------------------------------------------------- what this governance is and is not */
export function GovernanceNotice() {
  return (
    <section className="callout callout--caution dao-notice" aria-labelledby="dao-notice-title">
      <h2 className="dao-notice__title" id="dao-notice-title">What this governance is, and is not</h2>
      <ul className="dao-notice__list">
        <li><strong>Public votes.</strong> A vote is a public wallet action. It is not private, not anonymous, and counts one eligible wallet, not one person.</li>
        <li><strong>Official Dojang membership.</strong> Creating a proposal and voting need a wallet with an official Dojang Verified Address credential, checked by the contract each time. ZK proofs, demo credentials and lending credentials play no part.</li>
        <li><strong>One narrow power.</strong> An approved proposal changes only this contract&apos;s own minimum remaining credential validity. It does not change the LendingPool, the RestrictedVault or any other project contract.</li>
        <li><strong>Plain rules.</strong> Voting opens one minute after a proposal is created. Quorum counts For, Against and Abstain together; approval needs more For than Against. Anyone may finalize and execute.</li>
      </ul>
      <p className="small muted">
        Using Lending or the Vault does not require any governance step, and governance does not require a ZK proof.{" "}
        <Link href="/lending">Lending</Link> · <Link href="/vault">Vault</Link> · <Link href="/dojang">Check your Dojang credential</Link>
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- how a proposal moves */
const STAGES = [
  { key: "pending", name: "Created", text: "Voting opens one minute after creation." },
  { key: "active", name: "Voting", text: "Verified wallets vote For, Against or Abstain until the deadline." },
  { key: "decided", name: "Outcome", text: "After the deadline anyone finalizes it: approved if quorum is met and For beats Against." },
  { key: "executed", name: "Executed", text: "Anyone executes an approved proposal inside the execution window; the policy then changes." },
] as const;

export function LifecycleStrip({ state }: { state?: GovernanceProposalState }) {
  const at = !state ? -1 : state === "pending" ? 0 : state === "active" ? 1 : state === "executed" ? 3 : 2;
  return (
    <ol className="dao-stages" aria-label="How a proposal moves">
      {STAGES.map((stage, index) => (
        <li key={stage.key} data-state={at === index ? "current" : at > index ? "done" : "idle"}>
          <b>{stage.name}</b>
          <span>{stage.text}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------------------------------------------------------------- deployment status */
function DeploymentStatus() {
  const evidence = useProjectEvidence();
  const address = projectContracts.daoGovernance;
  const invalid = invalidContractConfig.includes("daoGovernance");
  const found = evidence.contract("daoGovernance");

  let pill: { tone: Tone; label: string };
  let detail: string;
  if (invalid) {
    pill = { tone: "invalid", label: "Invalid address" };
    detail = "The configured value is not a valid address, so it is ignored.";
  } else if (!address) {
    pill = { tone: "warn", label: "Not configured" };
    detail = "No governance address is configured, so no deployment is claimed and nothing below can be read or submitted.";
  } else if (evidence.state === "checking") {
    pill = { tone: "pending", label: "Reading code…" };
    detail = "The address is configured. Checking whether contract code exists there.";
  } else if (evidence.state === "read-error") {
    pill = { tone: "warn", label: "Code not read" };
    detail = "The address is configured, but the code check failed. This is not evidence either way.";
  } else if (found?.codeState === "present") {
    pill = { tone: "valid", label: "Code present" };
    detail = "Runtime code exists at the configured address on GIWA Sepolia. That is not source verification.";
  } else {
    pill = { tone: "invalid", label: "No code at this address" };
    detail = "The configured address has no contract code, so governance cannot be used.";
  }

  return (
    <div className="dao-deploy">
      <div className="kv__row">
        <dt>Governance contract</dt>
        <dd><Pill tone={pill.tone}>{pill.label}</Pill></dd>
      </div>
      <p className="small muted">{detail}</p>
      {address && !invalid && (
        <p className="small"><a className="addr" href={found?.explorerUrl ?? `${GIWA_EXPLORER_URL}/address/${address}`} target="_blank" rel="noopener noreferrer">{address}<span className="visually-hidden"> (opens in a new tab)</span></a></p>
      )}
      {address && found?.codeState === "present" && <GovernanceDependencies />}
      <p className="small muted">Source verification is not established for any project contract. Local Foundry and Anvil results are not GIWA Sepolia evidence.</p>
    </div>
  );
}

/* ---------------------------------------------------------------- overview */
const DOJANG_COPY = {
  idle: "Not checked yet.",
  checking: "Reading the official Dojang record…",
  "official-verified": "An official Dojang Verified Address credential is on record for this wallet.",
  "no-official-credential": "No official Verified Address credential was found for this wallet.",
  invalid: "A record exists but is not valid.",
  expired: "The official credential has expired.",
  revoked: "The official credential was revoked.",
  "read-error": "The official record could not be read. This does not mean the wallet has none.",
} as const;

export function GovernanceOverview({ gov, runner, gasBalance }: { gov: Governance; runner: GovRunner; gasBalance?: bigint }) {
  const wallet = useWalletNetwork();
  const dojang = useDojangVerification(wallet.address);
  const snap = gov.snapshot;
  const [count, setCount] = useState<bigint | undefined>();
  useEffect(() => { setCount(snap?.protectedActionCount); }, [snap?.protectedActionCount]);

  const member =
    !wallet.address ? { tone: "neutral" as Tone, label: "No wallet", text: "Connect a wallet to see whether it can take part." }
    : gov.state === "unconfigured" ? { tone: "neutral" as Tone, label: "Not available", text: "Membership is read from the governance contract, which is not configured." }
    : gov.isVerifiedMember === undefined ? { tone: "pending" as Tone, label: "Checking", text: "Asking the governance contract." }
    : gov.isVerifiedMember ? { tone: "valid" as Tone, label: "Member", text: "The contract recognises this wallet: it can create proposals and vote." }
    : { tone: "warn" as Tone, label: "Not a member", text: "The contract does not recognise this wallet as an official Dojang-verified member. It can still finalize and execute, and read everything." };

  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="dao-overview-heading">
      <div className="protocol-panel__head">
        <h2 id="dao-overview-heading">Governance overview</h2>
        <StateChip state={gov.state === "unconfigured" ? "unconfigured" : gov.state === "read-error" ? "read-error" : gov.state === "checking" ? "checking" : "ready"} />
      </div>

      <div className="dao-grid-2">
        <div>
          <h3 className="lend-subhead">Your wallet</h3>
          <dl className="kv protocol-kv">
            <div className="kv__row"><dt>Wallet</dt><dd className="addr">{wallet.address ? shortAddress(wallet.address) : "Not connected"}</dd></div>
            <div className="kv__row"><dt>Official Dojang record</dt><dd>{wallet.address ? <StateChip state={dojang.state} /> : "—"}</dd></div>
            <div className="kv__row"><dt>Governance membership</dt><dd><Pill tone={member.tone}>{member.label}</Pill></dd></div>
          </dl>
          <p className="small muted">{wallet.address ? DOJANG_COPY[dojang.state] : "Official Dojang status is read for the connected wallet."} The contract checks membership again on every write, and only its answer counts.</p>
          <p className="small muted">{member.text}</p>
          {gasBalance === 0n && <p className="callout callout--caution" role="status">This wallet has no GIWA Sepolia ETH to pay the network fee.</p>}
        </div>
        <div>
          <h3 className="lend-subhead">Policy and settings</h3>
          {snap ? (
            <dl className="kv protocol-kv">
              <div className="kv__row"><dt>Voting period</dt><dd>{formatDuration(snap.votingPeriod)}</dd></div>
              <div className="kv__row"><dt>Quorum</dt><dd>{snap.quorum.toString()} {snap.quorum === 1n ? "vote" : "votes"} in total</dd></div>
              <div className="kv__row"><dt>Execution window</dt><dd>{formatDuration(snap.executionWindow)}</dd></div>
              <div className="kv__row"><dt>Minimum remaining validity</dt><dd data-strong="true">{formatDuration(snap.minimumRemainingValidity)}</dd></div>
              <div className="kv__row"><dt>Proposals created</dt><dd>{(snap.nextProposalId > 0n ? snap.nextProposalId - 1n : 0n).toString()}</dd></div>
              {count !== undefined && <div className="kv__row"><dt>Your protected actions</dt><dd>{count.toString()}</dd></div>}
            </dl>
          ) : (
            <p className="protocol-empty">
              {gov.state === "unconfigured" ? "Unavailable until the governance contract address is configured (NEXT_PUBLIC_DAO_GOVERNANCE_CONTRACT)."
                : gov.state === "read-error" ? "The governance settings could not be read. Refresh to try again."
                : "Reading the governance settings…"}
            </p>
          )}
          <p className="small muted">The minimum remaining validity is the one value a proposal can change: how much longer an official credential must still be valid for a member to perform the protected action.</p>
        </div>
      </div>

      <ProtectedAction gov={gov} runner={runner} />
      <DeploymentStatus />
    </section>
  );
}

/* ---------------------------------------------------------------- the policy in use */
function ProtectedAction({ gov, runner }: { gov: Governance; runner: GovRunner }) {
  const reason = runner.block ?? runner.memberBlock;
  const policy = gov.snapshot?.minimumRemainingValidity;
  return (
    <div className="dao-protected">
      <h3 className="lend-subhead">The policy in use: protected action</h3>
      <p className="small muted">
        {policy === undefined ? "A member can perform the protected action only while their official credential has the minimum remaining validity."
          : `A member can perform the protected action only while their official credential is valid for at least ${formatDuration(policy)} more. This is the policy a proposal can change; it is the only thing governance controls here.`}
      </p>
      <div className="protocol-actions">
        <button
          className="btn btn--secondary btn--sm"
          type="button"
          disabled={Boolean(reason) || runner.busy}
          onClick={() => void runner.run("Perform the protected action", () => gov.performProtectedAction(), "Protected action confirmed: the contract's counter for this wallet went up by one.")}
        >
          Perform protected action
        </button>
        {reason && <span className="lend-reason">{reason}</span>}
      </div>
    </div>
  );
}
