import type { Metadata } from "next";
import Link from "next/link";
import { appEnv } from "@/lib/config/env";
import { DarkDaoNetworkStatus, DarkDaoPhase2Status } from "./live-status";
import "./dark-dao.css";

export const metadata: Metadata = {
  title: "DARK DAO · GYEVO",
  description: "GYEVO governance, backed by project credentials, verified participation, and on-chain state.",
  openGraph: {
    title: "DARK DAO · GYEVO",
    description: "Where project credentials, verified participation, and on-chain governance converge.",
  },
};

export default function DarkDaoPage() {
  return (
    <main className="page dark-dao-page">
      <section className="dark-dao-hero" aria-labelledby="dark-dao-title">
        <div className="dark-dao-hero__copy">
          <h1 id="dark-dao-title">DARK DAO<span aria-hidden="true">.</span></h1>
          <h2>Governance, backed by proof.</h2>
          <p>
            Where project credentials, verified participation, and on-chain governance converge.
            DARK DAO is GYEVO&apos;s governance layer; each release keeps its own eligibility rules and contract state.
          </p>
          <div className="dark-dao-actions">
            <Link className="btn btn--primary" href="#governance-model">Explore the model</Link>
            <Link className="dark-dao-text-link" href="/dao">Enter DARK DAO <span aria-hidden="true">→</span></Link>
          </div>
        </div>

        <ol className="dark-dao-flow" aria-label="Phase 1 governance path">
          <li><span>DOJANG</span><small>Project credential</small></li>
          <li><span>Policy 4</span><small>Public eligibility</small></li>
          <li><span>DARK DAO</span><small>Proposals and votes</small></li>
        </ol>
      </section>

      <section className="dark-dao-network" aria-labelledby="dark-dao-network-title">
        <div className="dark-dao-section-heading">
          <h2 id="dark-dao-network-title">Network and contract state</h2>
          <p>Visibility follows the selected network. Contract reads and wallet checks remain separate.</p>
        </div>
        <DarkDaoNetworkStatus mainnetVisible={appEnv.mainnetVisible} />
      </section>

      <section className="dark-dao-model" id="governance-model" aria-labelledby="dark-dao-model-title">
        <div className="dark-dao-section-heading">
          <h2 id="dark-dao-model-title">Two phases. Separate proof paths.</h2>
          <p>Each release has independent credentials, contracts, and voting rules.</p>
        </div>

        <article className="dark-dao-phase">
          <h3><span>Phase 1</span> · DOJANG → Policy 4 → DARK DAO</h3>
          <p>
            An active project-issued Policy 4 credential gates public proposals and wallet-based votes.
            This flow does not use a zero-knowledge membership proof; finalization and execution follow the selected contract&apos;s state.
          </p>
          <dl className="dark-dao-capabilities">
            <div><dt>Eligibility</dt><dd>Active Policy 4 project credential</dd></div>
            <div><dt>Proposal lifecycle</dt><dd>Propose, vote, finalize, then execute when the contract allows it</dd></div>
            <div><dt>Voting</dt><dd>Public and attributable to the wallet</dd></div>
          </dl>
        </article>

        {appEnv.daoPhase2Visible && (
          <article className="dark-dao-phase dark-dao-phase--phase2">
            <h3><span>Phase 2</span> · Genuine Lending evidence → reputation → Policy 5 → ZK membership → DARK DAO</h3>
            <p>
              Genuine Lending evidence is recorded by an authorized issuer as reputation. A matching Policy 5 credential
              and BOJAGI membership proof gate this separate workflow; voting uses a commit–reveal ballot.
            </p>
            <dl className="dark-dao-capabilities">
              <div><dt>Eligibility</dt><dd>Policy 5 credential and active reputation claim</dd></div>
              <div><dt>Membership</dt><dd>Zero-knowledge proof checked against on-chain state</dd></div>
              <div><dt>Voting</dt><dd>Commit–reveal; the later reveal is public and wallet-linked</dd></div>
            </dl>
          </article>
        )}
      </section>

      {appEnv.daoPhase2Visible && <DarkDaoPhase2Status />}

      <section className="dark-dao-entry" aria-labelledby="dark-dao-entry-title">
        <div>
          <h2 id="dark-dao-entry-title">Enter DARK DAO.</h2>
          <p>The existing workspace checks selected-chain contract state, wallet network, and eligibility before enabling actions.</p>
        </div>
        <Link className="btn btn--primary" href="/dao">Enter DARK DAO <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}
