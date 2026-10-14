"use client";

import Link from "next/link";
import { RobinhoodPolicy4Issuer } from "@/components/robinhood-policy4-issuer";
import { WalletNetworkCard } from "@/components/wallet-network-card";
import { StateChip } from "@/components/protocol-state";
import { useLendingV2EligibilityProof } from "@/hooks/use-lending-v2-eligibility-proof";
import { useRobinhoodDaoGovernance } from "@/hooks/use-robinhood-dao-governance";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";

function lendingCredentialState(state: ReturnType<typeof useLendingV2EligibilityProof>["state"]) {
  switch (state) {
    case "disconnected": return ["disconnected", "Connect the wallet that should receive the credential."] as const;
    case "wrong-network": return ["wrong-network", "Switch to Robinhood Testnet to check the Lending credential."] as const;
    case "checking": return ["checking", "Reading policy 3 from the Robinhood project registry."] as const;
    case "unconfigured":
    case "unavailable": return ["unconfigured", "The Robinhood Lending V2 credential registry is unavailable."] as const;
    case "read-error": return ["read-error", "The policy-3 credential read failed; no absence is inferred."] as const;
    case "credential-required": return ["missing", "No policy-3 credential is recorded. An authorized project issuer must issue it and deliver the private witness."] as const;
    case "credential-expired": return ["credential-expired", "The project credential has expired."] as const;
    case "credential-revoked": return ["credential-revoked", "The project issuer revoked this credential."] as const;
    case "credential-not-yet-valid": return ["checking-credential", "The credential is not valid yet."] as const;
    case "issuer-untrusted": return ["issuer-untrusted", "The issuer is not currently authorized by the project registry."] as const;
    case "witness-required": return ["active", "Policy-3 credential is active; its issuer-delivered witness is still required."] as const;
    case "witness-mismatch": return ["invalid", "The witness does not match the connected wallet's current credential."] as const;
    case "ready-to-prove": return ["ready-to-prove", "The credential and private witness are ready for browser proof generation."] as const;
    case "generating": return ["generating", "The proof is being generated and checked locally."] as const;
    case "proof-ready": return ["proof-ready", "A genuine proof is verified locally; Lending V2 will verify it again on-chain."] as const;
    case "invalid": return ["invalid", "The witness or generated proof failed validation."] as const;
  }
}

export function RobinhoodProjectCredentialStatus() {
  const wallet = useWalletNetwork(ROBINHOOD_TESTNET_CHAIN_ID);
  const lending = useLendingV2EligibilityProof();
  const dao = useRobinhoodDaoGovernance();
  const [lendingState, lendingText] = lendingCredentialState(lending.state);
  const daoState = !wallet.address
    ? "disconnected"
    : dao.state === "checking"
      ? "checking"
      : dao.state === "unconfigured" || dao.state === "no-code" || dao.state === "dependency-mismatch"
        ? "unconfigured"
        : dao.state === "read-error"
          ? "read-error"
          : dao.isVerifiedMember === true
            ? "active"
            : dao.isVerifiedMember === false
              ? "missing"
              : "checking";
  const daoText = dao.state === "read-error"
    ? "The policy-4 membership read failed; no absence is inferred."
    : dao.state !== "ready"
      ? "Robinhood DAO membership could not be confirmed yet."
      : dao.isVerifiedMember
        ? "Policy-4 project credential is active for this wallet."
        : "No active policy-4 credential is recorded. An authorized project issuer must issue one.";

  return (
    <section className="protocol-section" aria-labelledby="project-credential-heading">
      <header className="protocol-section__head">
        <p className="stub__num">ROBINHOOD TESTNET · PROJECT CREDENTIALS</p>
        <h2 id="project-credential-heading">Your project credentials</h2>
        <p>These credentials are issued by the project's authorized issuer. They are not official GIWA Dojang or Upbit credentials.</p>
      </header>
      <WalletNetworkCard expectedChainId={ROBINHOOD_TESTNET_CHAIN_ID} />
      <RobinhoodPolicy4Issuer />
      <div className="protocol-grid protocol-grid--even">
        <section className="panel panel--ticks protocol-panel" aria-labelledby="project-policy-3-heading">
          <div className="protocol-panel__head"><h3 id="project-policy-3-heading">Lending <span className="protocol-policy">Policy 3</span></h3><StateChip state={lendingState}>{lendingState === "active" ? "Credential active" : lendingState === "missing" ? "Credential missing" : lendingState.replaceAll("-", " ")}</StateChip></div>
          <p className="protocol-copy">{lendingText}</p>
          {lending.credential && <p className="small muted">Credential version {lending.credential.version.toString()} · expires {new Date(Number(lending.credential.expiresAt) * 1000).toLocaleString()}</p>}
          <Link className="btn btn--secondary" href="/bojagi">Open private proof ↗</Link>
        </section>
        <section className="panel panel--ticks protocol-panel" aria-labelledby="project-policy-4-heading">
          <div className="protocol-panel__head"><h3 id="project-policy-4-heading">DAO Governance <span className="protocol-policy">Policy 4</span></h3><StateChip state={daoState}>{daoState === "active" ? "Credential active" : daoState === "missing" ? "Credential missing" : daoState.replaceAll("-", " ")}</StateChip></div>
          <p className="protocol-copy">{daoText}</p>
          <Link className="btn btn--secondary" href="/dao">Open Robinhood governance ↗</Link>
        </section>
      </div>
    </section>
  );
}
