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
        <h2>Two separate authorization paths</h2>
        <ul>
          <li><strong>Dojang to governance.</strong> The DAO checks an official Dojang Verified Address credential, read live from GIWA&apos;s own contracts. No ZK proof is used.</li>
          <li><strong>ZK eligibility to the vault and lending.</strong> A project demo credential and a proof made in your browser, verified again by the contract. Dojang is not used.</li>
          <li>The paths are independent: lending needs no governance step, and governance needs no proof.</li>
          <li>No anonymous wallets, anonymous transactions or private voting are provided. Wallet activity and votes are public; the proof hides only the private eligibility value.</li>
        </ul>
        <p><Link href="/dojang">Dojang</Link> · <Link href="/bojagi">Bojagi proof</Link> · <Link href="/dao">DAO governance</Link></p>
      </section>
      <section className="panel">
        <h2>Verified DAO governance</h2>
        <ul>
          <li>Creating a proposal and voting need an official Dojang-verified wallet; the contract checks it each time. Finalizing and executing are open to any wallet.</li>
          <li>The votes are public wallet votes: one eligible wallet counts once per proposal, not one person. There is no membership snapshot.</li>
          <li>Voting opens one minute after creation. Quorum counts For, Against and Abstain together; approval needs more For than Against.</li>
          <li>An approved proposal changes only the governance contract&apos;s own minimum remaining credential validity. It does not change the LendingPool, the RestrictedVault or any other contract.</li>
          <li>The governance contract is implemented and tested locally. {projectContracts.daoGovernance ? "An address is configured; the page reads what the chain returns for it." : "No address is configured, so the page lists no proposals and submits nothing."}</li>
        </ul>
        <Link href="/dao">Open governance</Link>
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
        <h2>Roadmap status</h2>
        <ul>
          <li><strong>Protocol foundation: locally validated.</strong> Foundry suites and local Anvil runs pass. No GIWA deployment is recorded.</li>
          <li><strong>GIWA testnet launch: pending deployment.</strong> Deploy and verify the project contracts, record addresses and receipts, then complete the wallet procedure.</li>
          <li><strong>Public beta: planned.</strong> Needs a verified testnet deployment and a reviewed scope.</li>
          <li><strong>Security and risk infrastructure: planned.</strong> No audit or review is claimed.</li>
          <li><strong>Ecosystem expansion: future.</strong> No integrations, partnerships or grants are claimed.</li>
        </ul>
      </section>
      <section className="panel">
        <h2>Validation checkpoint</h2>
        <ul>
          <li>Foundry: 60 tests pass locally, including 16 governance tests. Typecheck and the production build pass.</li>
          <li>These are local results. They are not GIWA Sepolia deployment or transaction evidence, and not an audit.</li>
        </ul>
      </section>
      <section className="panel">
        <h2>Reproducibility</h2>
        <p>Local setup and exact contract and test boundaries are documented in the repository.</p>
        <p>See <code>docs/FRONTEND_FINAL_INTEGRATION_MAP.md</code>, <code>docs/DAO_FRONTEND_HANDOFF.md</code>, <code>docs/DEPLOYMENT_READINESS.md</code> and <code>docs/PROTOCOL_ROADMAP.md</code>.</p>
      </section>
    </main>
  );
}
