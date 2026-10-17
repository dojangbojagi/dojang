"use client";

import Link from "next/link";
import { RobinhoodPolicy4Issuer } from "@/components/robinhood-policy4-issuer";
import { WalletNetworkCard } from "@/components/wallet-network-card";
import { StateChip } from "@/components/protocol-state";
import { useLendingV2EligibilityProof } from "@/hooks/use-lending-v2-eligibility-proof";
import { useRobinhoodDaoGovernance } from "@/hooks/use-robinhood-dao-governance";
import { useRobinhoodDaoPhase2 } from "@/hooks/use-robinhood-dao-phase2";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "@/lib/config/robinhood-mainnet-demo";
import { useProtocolNetworkSelection } from "@/components/protocol-network-selection";

function lendingCredentialState(state: ReturnType<typeof useLendingV2EligibilityProof>["state"], networkName: string) {
  switch (state) {
    case "disconnected": return ["disconnected", "Connect the wallet that should receive the credential."] as const;
    case "wrong-network": return ["wrong-network", `Switch to ${networkName} to check the Lending credential.`] as const;
    case "checking": return ["checking", `Reading policy 3 from the ${networkName} project registry.`] as const;
    case "unconfigured":
    case "unavailable": return ["unconfigured", "The Robinhood Lending V2 credential registry is unavailable."] as const;
    case "read-error": return ["read-error", "The policy-3 credential read failed; no absence is inferred."] as const;
    case "credential-required": return ["missing", "No policy-3 credential is recorded. An authorized project issuer must issue it and deliver the private witness."] as const;
    case "credential-expired": return ["credential-expired", "The project credential has expired."] as const;
    case "credential-revoked": return ["credential-revoked", "The project issuer revoked this credential."] as const;
    case "credential-not-yet-valid": return ["checking-credential", "The credential is not valid yet."] as const;
    case "issuer-untrusted": return ["issuer-untrusted", "The issuer is not currently authorized by the project registry."] as const;
    case "verifier-unavailable": return ["read-error", "The local proof passed, but the deployed verifier response could not be confirmed."] as const;
    case "witness-required": return ["active", "Policy-3 credential is active; its issuer-delivered witness is still required."] as const;
    case "witness-mismatch": return ["invalid", "The witness does not match the connected wallet's current credential."] as const;
    case "ready-to-prove": return ["ready-to-prove", "The credential and private witness are ready for browser proof generation."] as const;
    case "generating": return ["generating", "The proof is being generated and checked locally."] as const;
    case "proof-ready": return ["proof-ready", "A genuine proof passed the deployed read-only verifier check; Lending V2 checks it again in protected transactions."] as const;
    case "invalid": return ["invalid", "The witness or generated proof failed validation."] as const;
  }
}

export function RobinhoodProjectCredentialStatus() {
  const { selectedChainId } = useProtocolNetworkSelection();
  const isMainnet = selectedChainId === ROBINHOOD_MAINNET_CHAIN_ID;
  const networkName = isMainnet ? "Robinhood Mainnet" : "Robinhood Testnet";
  const wallet = useWalletNetwork(selectedChainId);
  const lending = useLendingV2EligibilityProof(undefined, selectedChainId);
  const phase1Dao = useRobinhoodDaoGovernance(!isMainnet);
  const phase2Dao = useRobinhoodDaoPhase2(undefined, selectedChainId);
  const [lendingState, lendingText] = lendingCredentialState(lending.state, networkName);
  const daoState = !wallet.address
    ? "disconnected"
    : isMainnet && phase2Dao.state === "checking" || !isMainnet && phase1Dao.state === "checking"
      ? "checking"
      : isMainnet && ["unconfigured", "no-code", "dependency-mismatch", "deployment-pending"].includes(phase2Dao.state) || !isMainnet && ["unconfigured", "no-code", "dependency-mismatch"].includes(phase1Dao.state)
        ? "unconfigured"
        : isMainnet && phase2Dao.state === "read-error" || !isMainnet && phase1Dao.state === "read-error"
          ? "read-error"
          : isMainnet ? phase2Dao.snapshot?.membership?.active ? "active" : "missing"
          : phase1Dao.isVerifiedMember === true
            ? "active"
            : phase1Dao.isVerifiedMember === false
              ? "missing"
              : "checking";
  const daoText = isMainnet
    ? phase2Dao.state === "read-error"
      ? "The Mainnet Policy 5 membership read failed; no absence is inferred."
      : phase2Dao.state !== "ready"
        ? "Mainnet Policy 5 credential and DAO membership could not be confirmed yet."
        : phase2Dao.snapshot?.membership?.active
          ? "Policy 5 proof-backed DAO membership is active on Robinhood Mainnet."
          : phase2Dao.snapshot?.credentialActive
            ? phase2Dao.snapshot.reputation?.active
              ? "Policy 5 and Lending reputation are active. Generate the matching proof and register membership in the DAO workspace."
              : "A Policy 5 credential is active. An active canonical Lending reputation claim is also required before proof-backed membership can be registered."
            : "No active Mainnet Policy 5 credential is recorded. It must be issued by the authorized project issuer."
    : phase1Dao.state === "read-error"
      ? "The Testnet Policy 4 membership read failed; no absence is inferred."
      : phase1Dao.state !== "ready"
        ? "Robinhood Testnet Policy 4 membership could not be confirmed yet."
        : phase1Dao.isVerifiedMember
          ? "Policy 4 project credential is active for this wallet."
          : "No active Policy 4 credential is recorded. An authorized project issuer must issue one.";

  return (
    <section className="protocol-section" aria-labelledby="project-credential-heading">
      <header className="protocol-section__head">
        <p className="stub__num">{networkName.toUpperCase()} · PROJECT CREDENTIALS</p>
        <h2 id="project-credential-heading">Your project credentials</h2>
        <p>For Lending, an active Policy 3 credential and its matching private witness are required. {isMainnet ? "For DAO, Policy 5 and a genuine reputation proof are required before membership registration." : "For DAO, Policy 4 is required."} These are GYEVO-issued credentials, separate from official GIWA Dojang and Upbit credentials.</p>
      </header>
      <WalletNetworkCard expectedChainId={selectedChainId} />
      {!isMainnet && <RobinhoodPolicy4Issuer />}
      <div className="protocol-grid protocol-grid--even">
        <section className="panel panel--ticks protocol-panel" aria-labelledby="project-policy-3-heading">
          <div className="protocol-panel__head"><h3 id="project-policy-3-heading">Lending <span className="protocol-policy">Policy 3</span></h3><StateChip state={lendingState}>{lendingState === "active" ? "Credential active" : lendingState === "missing" ? "Credential missing" : lendingState.replaceAll("-", " ")}</StateChip></div>
          <p className="protocol-copy">{lendingText}</p>
          {lending.credential && <p className="small muted">Credential version {lending.credential.version.toString()} · expires {new Date(Number(lending.credential.expiresAt) * 1000).toLocaleString()}</p>}
          <Link className="btn btn--secondary" href="/bojagi">Open private proof ↗</Link>
        </section>
        <section className="panel panel--ticks protocol-panel" aria-labelledby="project-policy-4-heading">
          <div className="protocol-panel__head"><h3 id="project-policy-4-heading">DAO Governance <span className="protocol-policy">Policy {isMainnet ? "5" : "4"}</span></h3><StateChip state={daoState}>{daoState === "active" ? isMainnet ? "Membership active" : "Credential active" : daoState === "missing" ? isMainnet ? "Membership required" : "Credential missing" : daoState.replaceAll("-", " ")}</StateChip></div>
          <p className="protocol-copy">{daoText}</p>
          <Link className="btn btn--secondary" href="/dao">Open Robinhood governance ↗</Link>
        </section>
      </div>
    </section>
  );
}
