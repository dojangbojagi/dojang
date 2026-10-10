import Link from "next/link";
import { PageGlyphFigure } from "@/components/page-glyph";
import { WalletNetworkCard } from "@/components/wallet-network-card";
import { projectContracts } from "@/lib/config/contracts";

export default function DocsPage() {
  const configured = Object.values(projectContracts).filter(Boolean).length;
  const total = Object.keys(projectContracts).length;
  return (
    <main className="page">
      <header className="page-head">
        <PageGlyphFigure glyph={{ shape: "book", label: "An open book of lines of characters: the written trust model and its limits.", caption: "Written down, limits included", legend: ["public"] }} />
        <p className="eyebrow">Protocol documentation</p>
        <h1>Trust model and limitations</h1>
        <p className="page-lead">Official Dojang status and project-issued demo eligibility are separate trust paths. The demo issuer is not GIWA or an identity-verification provider.</p>
      </header>
      <WalletNetworkCard />
      <section className="panel">
        <h2>Current implementation boundary</h2>
        <ul>
          <li>Official Dojang Verified Address is a read-only EAS-backed check.</li>
          <li>Demo credentials are synthetic issuer-backed records, separate from official Dojang.</li>
          <li>The Noir circuit, browser proof generator and generated Solidity verifier have passed local conformance checks.</li>
          <li>The local Anvil end-to-end flow verified the proof in the browser, submitted it to the generated verifier and confirmed vault access.</li>
          <li>{configured === 0 ? "No project contract address is configured" : `${configured} of ${total} project contract addresses are configured`}; local results do not establish a GIWA testnet deployment or transaction.</li>
          <li>The vault contract checks wallet, commitment, policy, expiry, chain and vault binding, and does not custody funds.</li>
          <li>No audit, yield, interest or native Bojagi private transfer is claimed. The vault takes no deposits; the separate demo lending market takes controlled test tokens only.</li>
        </ul>
        <Link href="/contracts">Contract addresses and evidence</Link>
      </section>
      <section className="panel">
        <h2>The lending demo market</h2>
        <ul>
          <li>One market with two controlled test tokens, one lent and one posted as collateral. Transfers are real ERC-20 transfers and the accounting is on-chain.</li>
          <li>Supplying needs only a wallet. Borrowing needs deposited collateral and a private eligibility proof bound to the LendingPool.</li>
          <li>The proof shows eligibility and never sets an amount. Every loan is limited on-chain by collateral, the 50% loan-to-value cap, outstanding debt and unborrowed liquidity.</li>
          <li>Eligibility comes from a demo credential (policy 2) issued through the registry. It is not an official Dojang credential and says nothing about real funds.</li>
          <li>Fixed 1:1 demo price, zero interest, no supplier yield, no liquidation, no bad-debt handling and no price oracle.</li>
          <li>Testnet demonstration only. It is not audited and must not be used with real or volatile assets.</li>
        </ul>
        <Link href="/lending">Open the lending demo</Link>
      </section>
      <section className="panel">
        <h2>Reproducibility</h2>
        <p>Local setup and exact contract/test boundaries are documented in the frontend handoff.</p>
        <p>See <code>docs/FRONTEND_INTEGRATION_HANDOFF.md</code> in the repository.</p>
      </section>
    </main>
  );
}
