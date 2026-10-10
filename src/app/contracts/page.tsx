import "./contracts.css";
import { PageGlyphFigure } from "@/components/page-glyph";
import { ChainEvidenceLookup } from "@/components/evidence/chain-evidence-lookup";
import { GovernanceDependencies, ProjectContractRows, type ContractRow } from "@/components/evidence/project-contract-rows";
import { LendingAssetRows } from "@/components/lending/lending-asset-rows";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { invalidContractConfig, officialDojang, projectContracts } from "@/lib/config/contracts";

/* The contracts this project owns. Status comes from configuration only: a configured address is not proof of
   a verified deployment, and an unset one is shown as unset, never filled in. */
const PROJECT_CONTRACTS = [
  {
    key: "credentialRegistry",
    name: "DemoCredentialRegistry",
    role: "Issuer-managed commitments for demo credentials: policy 1 for the vault, policy 2 for lending",
    env: "NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT",
  },
  {
    key: "proofVerifier",
    name: "EligibilityVerifierAdapter",
    role: "Adapter in front of the generated UltraHonk verifier; the vault and the pool are wired to it when they are deployed",
    env: "NEXT_PUBLIC_PROOF_VERIFIER_CONTRACT",
  },
  {
    key: "restrictedVault",
    name: "RestrictedVault",
    role: "Proof-gated access flag. It holds no funds",
    env: "NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT",
  },
  {
    key: "lendingPool",
    name: "LendingPool",
    role: "The demo lending market: supplier principal, collateral and debt, with proof-gated borrowing",
    env: "NEXT_PUBLIC_LENDING_POOL_CONTRACT",
  },
  {
    key: "daoGovernance",
    name: "GovernedDojangAccess (DAO governance)",
    role: "Verified governance: official Dojang membership, public votes, and one policy it controls itself (minimum remaining credential validity). It does not govern the pool or the vault",
    env: "NEXT_PUBLIC_DAO_GOVERNANCE_CONTRACT",
  },
] as const;

export default function ContractsPage() {
  const rows: ContractRow[] = PROJECT_CONTRACTS.map((contract) => {
    const address = projectContracts[contract.key];
    const config = invalidContractConfig.includes(contract.key) ? "invalid" : address ? "configured" : "unset";
    return { ...contract, config, address } as const;
  });
  const configured = rows.filter((row) => row.config === "configured").length;

  return (
    <main className="page">
      <header className="page-head">
        <PageGlyphFigure glyph={{ shape: "stack", label: "Four stacked slabs of characters: the project's contracts, each to be checked on the explorer.", caption: "Evidence, layer by layer", legend: ["public"] }} />
        <p className="eyebrow">Evidence · Project contracts and deployment status</p>
        <h1>Contract evidence</h1>
        <p className="page-lead">
          Network: GIWA Sepolia · Chain ID {GIWA_CHAIN_ID}. These are the contracts this project owns, and whether an address is configured for each.
          A configured address is not proof of a verified deployment: check it on the explorer.
        </p>
      </header>

      <section className="panel" aria-labelledby="project-contracts-heading">
        <h2 id="project-contracts-heading">Project contracts</h2>
        <p className="contract-summary">{configured} of {rows.length} addresses configured</p>
        <dl className="contract-list">
          <ProjectContractRows rows={rows.slice(0, 2)} />
          <ProjectContractRows
            rows={[{ key: "honkVerifier", name: "HonkVerifier (generated)", role: "The generated UltraHonk verifier behind the adapter, found on-chain from it, with two linked libraries (ZKTranscriptLib, RelationsLib) that are not configured separately" }]}
          />
          <ProjectContractRows rows={rows.slice(2)} />
          <LendingAssetRows />
        </dl>
        {configured === 0 ? (
          <p className="notice">
            No GIWA Sepolia deployment or transaction evidence is configured for this project. Local Foundry tests and local Anvil runs exist; they
            are not deployments, and no local address or transaction hash is shown here as if it were one.
          </p>
        ) : (
          <p className="notice">
            Addresses come from configuration. A chip says what the chain returned for each: code present, or no code. Code present is not source
            verification, and source verification is not established for any project contract. Local Foundry and Anvil results are not GIWA Sepolia evidence.
          </p>
        )}
        <p className="notice">
          The vault tests use a local test-only verifier fixture, which is not a cryptographic ZK verifier. The lending pool is a demonstration market:
          controlled test tokens, a fixed 1:1 price, zero interest, no liquidation and no oracle. Governance changes only its own policy; it does not
          control the pool or the vault.
        </p>
        <GovernanceDependencies />
      </section>

      <ChainEvidenceLookup />

      <section className="panel" aria-labelledby="official-heading">
        <h2 id="official-heading">Official GIWA references (not project-owned)</h2>
        <p className="muted">These belong to GIWA. The app only reads them, to show an official Dojang Verified Address record. Nothing here is deployed or controlled by this project.</p>
        <dl className="contract-list">
          <div className="contract-row">
            <dt><strong>DojangScroll</strong><span className="xsmall muted">Official GIWA Dojang registry</span></dt>
            <dd><a href={`${GIWA_EXPLORER_URL}/address/${officialDojang.dojangScroll}`} target="_blank" rel="noopener noreferrer"><code>{officialDojang.dojangScroll}</code><span className="visually-hidden"> (opens in a new tab)</span></a></dd>
          </div>
          <div className="contract-row">
            <dt><strong>EAS</strong><span className="xsmall muted">Official GIWA attestation service</span></dt>
            <dd><a href={`${GIWA_EXPLORER_URL}/address/${officialDojang.eas}`} target="_blank" rel="noopener noreferrer"><code>{officialDojang.eas}</code><span className="visually-hidden"> (opens in a new tab)</span></a></dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
