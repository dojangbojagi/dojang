import "./contracts.css";
import type { Metadata } from "next";
import { PageGlyphFigure } from "@/components/page-glyph";
import { appEnv } from "@/lib/config/env";
import { invalidRobinhoodContractConfig, robinhoodContracts, robinhoodMainnetPhase2Contracts } from "@/lib/config/contracts";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { ROBINHOOD_MAINNET_CHAIN_ID, robinhoodMainnetDemoContracts } from "@/lib/config/robinhood-mainnet-demo";
import { RobinhoodEvidenceLookup } from "@/components/evidence/robinhood-evidence-lookup";
import { VerifiedDemoHistory } from "@/components/evidence/verified-demo-history";
import { ContractDirectory, type DirectoryRow } from "./contract-directory";
import { LazyDetails } from "./lazy-details";

export const metadata: Metadata = { title: `Contracts · ${appEnv.appName}` };

/* The deployed contracts, in the order a visitor meets them. Names are for people; the technical name
   sits under each one for anyone who wants to match it to source. */
const ROWS: Omit<DirectoryRow, "address" | "invalid">[] = [
  { key: "credentialRegistry", group: "Credentials and proofs", name: "Credential Registry", tech: "RobinhoodDemoCredentialRegistry", purpose: "Records project credentials: one sealed commitment per wallet and policy, with expiry and revocation." },
  { key: "honkVerifier", group: "Credentials and proofs", name: "Proof Verifier", tech: "HonkVerifier", purpose: "Checks zero-knowledge proofs on-chain. Generated from the project's eligibility circuit." },
  { key: "verifierAdapter", group: "Credentials and proofs", name: "Verifier Adapter", tech: "EligibilityVerifierAdapter", purpose: "Connects the Lending pool to the proof verifier." },
  { key: "zkTranscriptLib", group: "Credentials and proofs", name: "Verifier Library · Transcript", tech: "ZKTranscriptLib", purpose: "Library linked into the proof verifier." },
  { key: "relationsLib", group: "Credentials and proofs", name: "Verifier Library · Relations", tech: "RelationsLib", purpose: "Library linked into the proof verifier." },
  { key: "governance", group: "DAO Governance", name: "DAO Governance", tech: "RobinhoodGovernancePhase1", purpose: "Credential-gated proposals and public voting. Its first phase has one bounded action and holds no funds." },
  { key: "phase2ReputationRegistry", group: "DAO Governance Phase 2", name: "Lending Reputation Registry", tech: "RobinhoodLendingReputation", purpose: "Pins private reputation commitments to a canonical Lending V2 event range and evidence digest." },
  { key: "phase2Governance", group: "DAO Governance Phase 2", name: "Protected Governance", tech: "RobinhoodGovernancePhase2", purpose: "Verifies Policy 5 reputation proofs and runs commit–reveal ballots with proposal-scoped nullifiers." },
  { key: "lendingV2Pool", group: "Lending V2", name: "Lending Pool", tech: "LendingPoolV2", purpose: "The demonstration market: supply, collateral, borrow, repay, withdraw and liquidation, gated by proofs." },
  { key: "lendingV2Oracle", group: "Lending V2", name: "Test Price Oracle", tech: "ControlledTestOracle", purpose: "Operator-set synthetic prices for the demo assets. Not market data." },
  { key: "lendingV2Asset", group: "Lending V2", name: "Demo Lending Token", tech: "rUSD2", purpose: "Controlled test token that is lent. No real value." },
  { key: "lendingV2Collateral", group: "Lending V2", name: "Demo Collateral Token", tech: "rCOL2", purpose: "Controlled test token posted as collateral. No real value." },
];

export default function ContractsPage() {
  const rows: DirectoryRow[] = ROWS.map((row) => ({
    ...row,
    address: robinhoodContracts[row.key] ?? undefined,
    invalid: invalidRobinhoodContractConfig.includes(row.key),
  }));
  const mainnetRows: DirectoryRow[] = appEnv.mainnetVisible ? ROWS.flatMap((row): DirectoryRow[] => {
    const mainnet = ({
      credentialRegistry: ["RobinhoodMainnetDemoCredentialRegistry", robinhoodMainnetDemoContracts.credentialRegistry],
      honkVerifier: ["HonkVerifier", robinhoodMainnetDemoContracts.honkVerifier],
      verifierAdapter: ["EligibilityVerifierAdapter", robinhoodMainnetDemoContracts.verifierAdapter],
      zkTranscriptLib: ["ZKTranscriptLib", robinhoodMainnetDemoContracts.zkTranscriptLib],
      relationsLib: ["RelationsLib", robinhoodMainnetDemoContracts.relationsLib],
      governance: ["RobinhoodMainnetDemoGovernancePhase1", robinhoodMainnetDemoContracts.governance],
      phase2ReputationRegistry: ["RobinhoodLendingReputationPhase2", robinhoodMainnetPhase2Contracts.reputationRegistry],
      phase2Governance: ["RobinhoodGovernancePhase2", robinhoodMainnetPhase2Contracts.governance],
      lendingV2Pool: ["RobinhoodMainnetDemoLendingPool", robinhoodMainnetDemoContracts.lendingPool],
      lendingV2Oracle: ["RobinhoodMainnetDemoOracle", robinhoodMainnetDemoContracts.oracle],
      lendingV2Asset: ["RobinhoodMainnetDemoToken · dUSD", robinhoodMainnetDemoContracts.loanToken],
      lendingV2Collateral: ["RobinhoodMainnetDemoToken · dCOL", robinhoodMainnetDemoContracts.collateralToken],
    } as Partial<Record<DirectoryRow["key"], readonly [string, string | undefined]>>)[row.key];
    if (!mainnet) return [];
    const purpose = row.key === "lendingV2Asset" || row.key === "lendingV2Collateral"
      ? "Synthetic demo asset with no redemption value."
      : row.key === "lendingV2Pool"
        ? "Proof-gated Lending V2 pool. Paused on Mainnet; not available for public production use."
        : row.key === "governance"
          ? "Credential-gated governance contract. Paused on Mainnet."
          : row.key === "phase2ReputationRegistry"
            ? "Mainnet Phase 2 reputation registry. Activation state is checked live below; it is separate from Testnet."
            : row.key === "phase2Governance"
              ? "Mainnet Phase 2 commit–reveal governance. Activation state is checked live below; it is separate from Testnet."
          : row.purpose;
    return [{ ...row, tech: mainnet[0], address: mainnet[1], purpose }];
  }) : [];

  return (
    <main className="page page--compact">
      <header className="page-head">
        <PageGlyphFigure glyph={{ shape: "stack", label: "The project's contracts, layer by layer, on Robinhood Chain.", caption: "Evidence, layer by layer", legend: ["public"] }} />
        <p className="eyebrow">Contract Explorer</p>
        <h1>Contracts</h1>
        <p className="page-lead">
          {appEnv.mainnetVisible
            ? <>{appEnv.appName} has deployed contracts on Robinhood Mainnet (chain {ROBINHOOD_MAINNET_CHAIN_ID}). Mainnet Phase 2 governance is separately deployed and its activation state is checked live; the interactive Lending journey remains on Robinhood Testnet (chain {ROBINHOOD_TESTNET_CHAIN_ID}). Select a network to inspect contract evidence.</>
            : <>{appEnv.appName} publishes its interactive contracts on Robinhood Testnet (chain {ROBINHOOD_TESTNET_CHAIN_ID}). Inspect their addresses and independently checked contract evidence below.</>}
        </p>
      </header>

      <section className="panel cdir__panel" aria-labelledby="contracts-heading">
        <ContractDirectory rows={rows} mainnetRows={mainnetRows} />
      </section>

      <VerifiedDemoHistory />

      <section className="panel" aria-labelledby="legacy-heading">
        <details className="cdir__more">
          <summary id="legacy-heading">Earlier GIWA Sepolia prototype contracts</summary>
          <p className="muted">
            The first prototype ran on GIWA Sepolia with its own credential registry, lending pool and DAO. Those contracts are separate from
            the Robinhood deployments above. GIWA&apos;s own Dojang and attestation contracts are external
            infrastructure, and {appEnv.appName} credentials are never to be read as official GIWA or Upbit credentials.
          </p>
        </details>
      </section>

      <section className="panel" aria-labelledby="tools-heading">
        <h2 id="tools-heading">On-chain activity</h2>
        <p className="muted">Look up a transaction receipt or scan project events directly from the network.</p>
        <LazyDetails summary="Open the lookup tools">
          <RobinhoodEvidenceLookup />
        </LazyDetails>
      </section>
    </main>
  );
}
