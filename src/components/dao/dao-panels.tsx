"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GovernanceDependencies } from "@/components/evidence/project-contract-rows";
import { useProjectEvidence } from "@/components/evidence/use-project-evidence";
import { formatDuration, formatTimestamp, shortAddress } from "@/components/dao/format";
import type { GovRunner, Governance } from "@/components/dao/types";
import { StateChip } from "@/components/protocol-state";
import { useDojangVerification } from "@/hooks/use-dojang-verification";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";
import { invalidContractConfig, invalidRobinhoodContractConfig, projectContracts, robinhoodContracts } from "@/lib/config/contracts";
import type { ProtocolChainId } from "@/hooks/use-wallet-network";
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
export function GovernanceNotice({ chainId = GIWA_CHAIN_ID }: { chainId?: ProtocolChainId }) {
  const isRobinhood = chainId === ROBINHOOD_TESTNET_CHAIN_ID;
  return (
    <section className="callout callout--caution dao-notice" aria-labelledby="dao-notice-title">
      <h2 className="dao-notice__title" id="dao-notice-title">What this governance is, and is not</h2>
      <ul className="dao-notice__list">
        <li><strong>Public votes.</strong> A vote is a public wallet action. It is not private, not anonymous, and counts one eligible wallet, not one person.</li>
        <li><strong>{isRobinhood ? "Project credential membership." : "Official Dojang membership."}</strong> {isRobinhood
          ? "Creating a proposal and voting need a current BOJOGAY project-issued policy-4 credential, checked by the Robinhood DAO contract. This is not official Dojang verification; policy-3 Lending credentials do not count."
          : "Creating a proposal and voting need a wallet with an official Dojang Verified Address credential, checked by the contract each time. ZK proofs and project-issued demo credentials play no part."}</li>
        <li><strong>One narrow power.</strong> An approved proposal changes only this contract&apos;s own minimum remaining credential validity. It does not change the LendingPool, the RestrictedVault or any other project contract.</li>
        <li><strong>Plain rules.</strong> Voting opens one minute after a proposal is created. Quorum counts For, Against and Abstain together; approval needs more For than Against. Anyone may finalize and execute.</li>
      </ul>
      <p className="small muted">
        Using Lending or the Vault does not require any governance step, and governance does not require a ZK proof.{" "}
        <Link href="/lending">Lending</Link> · <Link href="/vault">Vault</Link> · <Link href="/dojang">{isRobinhood ? "Credential tools" : "Check your Dojang credential"}</Link>
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
function GiwaDeploymentStatus() {
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

function RobinhoodDeploymentStatus({ state }: { state: Governance["state"] }) {
  const address = robinhoodContracts.governance;
  const registryAddress = robinhoodContracts.credentialRegistry;
  const invalid = invalidRobinhoodContractConfig.includes("governance") || invalidRobinhoodContractConfig.includes("credentialRegistry");
  let pill: { tone: Tone; label: string };
  let detail: string;
  if (invalid) {
    pill = { tone: "invalid", label: "Invalid address" };
    detail = "The configured Robinhood DAO value is not a valid address, so it is ignored.";
  } else if (!address) {
    pill = { tone: "warn", label: "Not configured" };
    detail = "No Robinhood governance deployment is configured. No deployment is claimed and nothing can be read or submitted.";
  } else if (!registryAddress) {
    pill = { tone: "warn", label: "Registry not configured" };
    detail = "The Robinhood governance address is configured, but the matching project credential registry is not.";
  } else if (state === "checking") {
    pill = { tone: "pending", label: "Reading code…" };
    detail = "Checking the DAO bytecode, project registry bytecode, and the registry address stored by the DAO on Robinhood Testnet.";
  } else if (state === "ready") {
    pill = { tone: "valid", label: "Code and registry match" };
    detail = "The configured DAO and project credential registry have code on Robinhood Testnet and the DAO references that registry.";
  } else if (state === "no-code") {
    pill = { tone: "invalid", label: "No code at this address" };
    detail = "No Robinhood DAO runtime code exists at the configured address.";
  } else if (state === "dependency-mismatch") {
    pill = { tone: "invalid", label: "Registry mismatch" };
    detail = "The configured registry is missing code or differs from the registry stored in the DAO contract.";
  } else if (state === "read-error") {
    pill = { tone: "warn", label: "Code not read" };
    detail = "The Robinhood RPC read failed. This is not evidence either way.";
  } else {
    pill = { tone: "warn", label: "Not checked" };
    detail = "Configure a confirmed Robinhood deployment before using this DAO.";
  }
  return (
    <div className="dao-deploy">
      <div className="kv__row"><dt>Robinhood governance contract</dt><dd><Pill tone={pill.tone}>{pill.label}</Pill></dd></div>
      <p className="small muted">{detail}</p>
      {address && !invalid && <p className="small"><a className="addr" href={`${ROBINHOOD_TESTNET_EXPLORER_URL}/address/${address}`} target="_blank" rel="noopener noreferrer">{address}<span className="visually-hidden"> (opens in a new tab)</span></a></p>}
      <p className="small muted">This is BOJOGAY project governance on Robinhood Testnet. It does not use official GIWA Dojang infrastructure. Local Anvil results are not public chain evidence.</p>
    </div>
  );
}

/* ---------------------------------------------------------------- overview */
export function GovernanceOverview({ gov, runner, gasBalance, chainId = GIWA_CHAIN_ID }: { gov: Governance; runner: GovRunner; gasBalance?: bigint; chainId?: ProtocolChainId }) {
  const wallet = useWalletNetwork(chainId);
  const isRobinhood = chainId === ROBINHOOD_TESTNET_CHAIN_ID;
  const snap = gov.snapshot;
  const [count, setCount] = useState<bigint | undefined>();
  useEffect(() => { setCount(snap?.protectedActionCount); }, [snap?.protectedActionCount]);

  const member =
    !wallet.address ? { tone: "neutral" as Tone, label: "No wallet", text: "Connect a wallet to see whether it can take part." }
    : gov.state === "unconfigured" ? { tone: "neutral" as Tone, label: "Not available", text: "Membership is read from the governance contract, which is not configured." }
    : gov.state === "no-code" || gov.state === "dependency-mismatch" ? { tone: "neutral" as Tone, label: "Not available", text: "The configured DAO deployment or its registry dependency is not ready." }
    : gov.isVerifiedMember === undefined ? { tone: "pending" as Tone, label: "Checking", text: "Asking the governance contract." }
    : gov.isVerifiedMember ? { tone: "valid" as Tone, label: "Member", text: "The contract recognises this wallet: it can create proposals and vote." }
    : { tone: "warn" as Tone, label: "Not a member", text: isRobinhood
      ? "The contract does not recognise a current project-issued policy-4 credential for this wallet. It can still finalize and execute, and read everything."
      : "The contract does not recognise this wallet as an official Dojang-verified member. It can still finalize and execute, and read everything." };

  const chipState = gov.state === "unconfigured" ? "unconfigured"
    : gov.state === "read-error" || gov.state === "no-code" || gov.state === "dependency-mismatch" ? "read-error"
    : gov.state === "checking" ? "checking" : "ready";

  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="dao-overview-heading">
      <div className="protocol-panel__head">
        <h2 id="dao-overview-heading">Governance overview</h2>
        <StateChip state={chipState} />
      </div>

      <div className="dao-grid-2">
        <div>
          <h3 className="lend-subhead">Your wallet</h3>
          <dl className="kv protocol-kv">
            <div className="kv__row"><dt>Wallet</dt><dd className="addr">{wallet.address ? shortAddress(wallet.address) : "Not connected"}</dd></div>
            {isRobinhood ? <RobinhoodCredentialStatus wallet={wallet.address} gov={gov} /> : <OfficialDojangStatus wallet={wallet.address} />}
            <div className="kv__row"><dt>Governance membership</dt><dd><Pill tone={member.tone}>{member.label}</Pill></dd></div>
          </dl>
          <p className="small muted">{isRobinhood
            ? "The contract checks policy-4 project credential eligibility again on every write; official Dojang credentials are not used on this network."
            : wallet.address ? "Official Dojang status is read for the connected wallet." : "Official Dojang status is read for the connected wallet."} The contract checks membership again on every write, and only its answer counts.</p>
          <p className="small muted">{member.text}</p>
          {gasBalance === 0n && <p className="callout callout--caution" role="status">This wallet has no {isRobinhood ? "Robinhood Testnet" : "GIWA Sepolia"} ETH to pay the network fee.</p>}
        </div>
        <div>
          <h3 className="lend-subhead">Policy and settings</h3>
          {snap ? (
            <dl className="kv protocol-kv">
              {snap.paused !== undefined && <div className="kv__row"><dt>Contract status</dt><dd><Pill tone={snap.paused ? "warn" : "valid"}>{snap.paused ? "Paused" : "Active"}</Pill></dd></div>}
              <div className="kv__row"><dt>Voting period</dt><dd>{formatDuration(snap.votingPeriod)}</dd></div>
              <div className="kv__row"><dt>Quorum</dt><dd>{snap.quorum.toString()} {snap.quorum === 1n ? "vote" : "votes"} in total</dd></div>
              <div className="kv__row"><dt>Execution window</dt><dd>{formatDuration(snap.executionWindow)}</dd></div>
              <div className="kv__row"><dt>Minimum remaining validity</dt><dd data-strong="true">{formatDuration(snap.minimumRemainingValidity)}</dd></div>
              <div className="kv__row"><dt>Proposals created</dt><dd>{(snap.nextProposalId > 0n ? snap.nextProposalId - 1n : 0n).toString()}</dd></div>
              {count !== undefined && <div className="kv__row"><dt>Your protected actions</dt><dd>{count.toString()}</dd></div>}
            </dl>
          ) : (
            <p className="protocol-empty">
              {gov.state === "unconfigured" ? `Unavailable until the ${isRobinhood ? "NEXT_PUBLIC_ROBINHOOD_GOVERNANCE_CONTRACT" : "NEXT_PUBLIC_DAO_GOVERNANCE_CONTRACT"} address is configured.`
                : gov.state === "no-code" ? "The configured DAO address has no contract code on this network."
                : gov.state === "dependency-mismatch" ? "The configured project credential registry does not match the DAO deployment."
                : gov.state === "read-error" ? "The governance settings could not be read. Refresh to try again."
                : "Reading the governance settings…"}
            </p>
          )}
          <p className="small muted">The minimum remaining validity is the one value a proposal can change: how much longer {isRobinhood ? "a project-issued policy-4 credential" : "an official Dojang credential"} must remain valid for a member to perform the protected action.</p>
        </div>
      </div>

      <ProtectedAction gov={gov} runner={runner} chainId={chainId} />
      {isRobinhood ? <RobinhoodDeploymentStatus state={gov.state} /> : <GiwaDeploymentStatus />}
    </section>
  );
}

/* ---------------------------------------------------------------- the policy in use */
function OfficialDojangStatus({ wallet }: { wallet?: `0x${string}` }) {
  const dojang = useDojangVerification(wallet);
  return <div className="kv__row"><dt>Official Dojang record</dt><dd>{wallet ? <StateChip state={dojang.state} /> : "—"}</dd></div>;
}

function RobinhoodCredentialStatus({ wallet, gov }: { wallet?: `0x${string}`; gov: Governance }) {
  const state = wallet ? gov.snapshot?.credentialState : undefined;
  const stateChip = state === "active" ? "active" : state === "expired" ? "expired" : state === "revoked" ? "revoked"
    : state === "issuer-untrusted" ? "issuer-untrusted" : state === "invalid" ? "invalid"
      : state === "read-error" ? "read-error" : state === "missing" ? "missing"
        : wallet && gov.state === "read-error" ? "read-error"
          : wallet && (gov.state === "unconfigured" || gov.state === "no-code" || gov.state === "dependency-mismatch") ? "unconfigured"
            : wallet ? "checking" : "disconnected";
  const label = state === "active" ? "Active · policy 4" : state === "expired" ? "Expired · policy 4"
    : state === "revoked" ? "Revoked · policy 4" : state === "issuer-untrusted" ? "Issuer not authorized"
      : state === "invalid" ? "Invalid credential" : state === "missing" ? "Missing · policy 4"
        : state === "read-error" || gov.state === "read-error" ? "Read error"
          : gov.state === "unconfigured" ? "DAO not configured"
            : gov.state === "no-code" ? "DAO code not found"
              : gov.state === "dependency-mismatch" ? "Registry mismatch"
                : wallet ? "Checking" : "—";
  const credential = gov.snapshot?.credential;
  return <>
    <div className="kv__row"><dt>Project DAO credential</dt><dd><StateChip state={stateChip}>{label}</StateChip></dd></div>
    {credential && <>
      <div className="kv__row"><dt>Credential issuer</dt><dd className="addr">{shortAddress(credential.issuer)}</dd></div>
      <div className="kv__row"><dt>Credential expires</dt><dd>{formatTimestamp(credential.expiresAt)}</dd></div>
    </>}
  </>;
}

function ProtectedAction({ gov, runner, chainId }: { gov: Governance; runner: GovRunner; chainId: ProtocolChainId }) {
  const reason = runner.block ?? runner.memberBlock;
  const policy = gov.snapshot?.minimumRemainingValidity;
  const credentialDescription = chainId === ROBINHOOD_TESTNET_CHAIN_ID ? "project-issued policy-4 credential" : "official Dojang credential";
  return (
    <div className="dao-protected">
      <h3 className="lend-subhead">The policy in use: protected action</h3>
      <p className="small muted">
        {policy === undefined ? `A member can perform the protected action only while their ${credentialDescription} has the minimum remaining validity.`
          : `A member can perform the protected action only while their ${credentialDescription} is valid for at least ${formatDuration(policy)} more. This is the policy a proposal can change; it is the only thing governance controls here.`}
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
