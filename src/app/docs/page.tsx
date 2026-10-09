import Link from "next/link";
import { WalletNetworkCard } from "@/components/wallet-network-card";

export default function DocsPage() {
  return (
    <main className="page">
      <p className="eyebrow">Protocol documentation</p>
      <h1>Trust model and limitations</h1>
      <p className="page-lead">Official Dojang status and project-issued demo eligibility are separate trust paths. The demo issuer is not GIWA or an identity-verification provider.</p>
      <WalletNetworkCard />
      <section className="panel">
        <h2>Current implementation boundary</h2>
        <ul>
          <li>Official Dojang Verified Address is a read-only EAS-backed check.</li>
          <li>Demo credentials are synthetic issuer-backed records, separate from official Dojang.</li>
          <li>No circuit-backed proof generator or generated Solidity verifier is configured.</li>
          <li>The vault contract requires a verifier contract and checks wallet, commitment, policy, expiry, chain and vault binding.</li>
          <li>No deployment, testnet transaction, audit, deposit, yield or native Bojagi private transfer is claimed.</li>
        </ul>
        <Link href="/contracts">Contract addresses and evidence</Link>
      </section>
      <section className="panel">
        <h2>Reproducibility</h2>
        <p>Local setup and exact contract/test boundaries are documented in the frontend handoff.</p>
        <p>See <code>docs/FRONTEND_INTEGRATION_HANDOFF.md</code> in the repository.</p>
      </section>
    </main>
  );
}
