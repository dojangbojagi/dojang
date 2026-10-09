import { invalidContractConfig, officialDojang, projectContracts } from "@/lib/config/contracts";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";

const envNameByProjectContract = {
  credentialRegistry: "NEXT_PUBLIC_DEMO_CREDENTIAL_REGISTRY_CONTRACT",
  proofVerifier: "NEXT_PUBLIC_PROOF_VERIFIER_CONTRACT",
  restrictedVault: "NEXT_PUBLIC_RESTRICTED_VAULT_CONTRACT",
} as const;

function AddressRow({ label, address, official = false, invalid = false }: { label: string; address?: string; official?: boolean; invalid?: boolean }) {
  return <div><dt>{label}{official ? " · Official GIWA" : " · Project"}</dt><dd>{invalid ? "Invalid address configuration" : address ? <a href={`${GIWA_EXPLORER_URL}/address/${address}`} target="_blank" rel="noreferrer"><code>{address}</code></a> : "Not configured / not deployed"}</dd></div>;
}

export default function ContractsPage() {
  return (
    <main className="page">
      <p className="eyebrow">Evidence · Addresses and deployment status</p>
      <h1>Contract evidence</h1>
      <p className="page-lead">Network: GIWA Sepolia · Chain ID {GIWA_CHAIN_ID}. Project addresses remain unset until deployment is completed and independently checked.</p>
      <section className="panel">
        <h2>Official GIWA infrastructure</h2>
        <dl className="data-list">
          <AddressRow label="DojangScroll" address={officialDojang.dojangScroll} official />
          <AddressRow label="EAS" address={officialDojang.eas} official />
        </dl>
      </section>
      <section className="panel">
        <h2>Project contracts</h2>
        <dl className="data-list">
          <AddressRow label="DemoCredentialRegistry" address={projectContracts.credentialRegistry} invalid={invalidContractConfig.includes("credentialRegistry")} />
          <AddressRow label="EligibilityVerifier" address={projectContracts.proofVerifier} invalid={invalidContractConfig.includes("proofVerifier")} />
          <AddressRow label="RestrictedVault" address={projectContracts.restrictedVault} invalid={invalidContractConfig.includes("restrictedVault")} />
        </dl>
        {invalidContractConfig.length > 0 && <p className="notice">Invalid address format in: {invalidContractConfig.map((key) => envNameByProjectContract[key as keyof typeof envNameByProjectContract]).join(", ")}. Project addresses remain unset until valid deployment addresses are supplied.</p>}
        <p className="notice">No project deployment or transaction evidence is configured. The Foundry vault tests use a local test-only verifier fixture, not a cryptographic ZK verifier.</p>
      </section>
    </main>
  );
}
