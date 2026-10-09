import Link from "next/link";
import { ProofGenerationPanel } from "@/components/proof-generation-panel";
import { WalletNetworkCard } from "@/components/wallet-network-card";

export default function BojagiPage() {
  return (
    <main className="page">
      <p className="eyebrow">Prove · Bojagi-inspired Protection</p>
      <h1>Private eligibility proof</h1>
      <p className="page-lead">The planned policy is at least 1,000 issuer-backed project demo test units. This is an eligibility privacy concept, not a native GIWA Bojagi private transfer.</p>
      <WalletNetworkCard />
      <ProofGenerationPanel />
      <section className="panel">
        <h2>Public and private data</h2>
        <p>Intended private witness: the test value and salt. Intended public inputs: wallet, commitment, policy, threshold, credential version and expiry, chain ID, and vault address. The exact value must not be sent in calldata or events.</p>
        <p className="muted">The browser prover creates and locally verifies a proof. Submitting it remains unavailable until registry, verifier, and vault addresses are configured for a deployment.</p>
        <Link href="/vault">Review the restricted action</Link>
      </section>
    </main>
  );
}
