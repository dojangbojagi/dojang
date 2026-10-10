import Link from "next/link";
import { ProofGenerationPanel } from "@/components/proof-generation-panel";
import { ProtocolPage } from "@/components/protocol-page";
import { WalletNetworkCard } from "@/components/wallet-network-card";

export default function BojagiPage() {
  return (
    <ProtocolPage
      page="bojagi"
      tone="bojagi"
      accent="periwinkle"
      status="Private eligibility · browser proof"
      glyph={{ shape: "seal", label: "An orange core sealed inside a blue ring: the value stays private and the proof is public.", caption: "Value sealed · proof public", legend: ["private", "public"] }}
      title="Prove it without showing it."
      lead="Your device checks the issuer-backed witness against the current on-chain commitment, then proves that it meets the policy. The exact value stays hidden; the wallet and proof remain public."
    >
      <div className="protocol-stack protocol-section">
        <WalletNetworkCard />
        <div className="protocol-grid protocol-grid--stretch">
          <ProofGenerationPanel />
          <section className="panel panel--ticks protocol-panel" aria-labelledby="cloth-heading">
            <div className="protocol-panel__head"><h2 id="cloth-heading">A sealed fact, opened only to a rule</h2></div>
            <div className="protocol-cloth" role="img" aria-label="Four stitched cloth panels surround a private proof window">
              <div className="protocol-cloth__square" aria-hidden="true">
                <span className="protocol-cloth__piece protocol-cloth__piece--one" />
                <span className="protocol-cloth__piece protocol-cloth__piece--two" />
                <span className="protocol-cloth__piece protocol-cloth__piece--three" />
                <span className="protocol-cloth__piece protocol-cloth__piece--four" />
                <span className="protocol-cloth__window"><strong>≥ 1,000</strong><span>Rule shown · value sealed</span></span>
              </div>
              <span className="protocol-cloth__caption">Bojagi-inspired · eligibility proof only</span>
            </div>
            <p className="protocol-copy">The patchwork is a visual metaphor for a private eligibility proof. It is not GIWA’s native Bojagi transfer, private balance or hidden sender flow.</p>
          </section>
        </div>

        <section className="protocol-section" aria-labelledby="public-private-heading">
          <header className="protocol-section__head">
            <p className="stub__num">PUBLIC / PRIVATE BOUNDARY</p>
            <h2 id="public-private-heading">What leaves the device?</h2>
            <p>The circuit runs in this browser. No server prover fallback uploads the witness.</p>
          </header>
          <div className="protocol-grid protocol-grid--even">
            <article className="panel panel--ticks protocol-panel">
              <div className="protocol-panel__head"><h2>Remains private</h2></div>
              <ul className="protocol-list"><li>Exact demo value</li><li>Random commitment salt</li><li>Imported witness JSON</li></ul>
              <div className="callout callout--demo protocol-notice">The witness is held in React memory for this session. Clearing it or refreshing removes it.</div>
            </article>
            <article className="panel panel--ticks protocol-panel">
              <div className="protocol-panel__head"><h2>Public to the verifier</h2></div>
              <ul className="protocol-list"><li>Wallet address and commitment</li><li>Policy ID/version and threshold</li><li>Credential version and expiry</li><li>Chain, vault address and proof</li></ul>
              <div className="callout callout--caution protocol-notice">Wallet activity and transaction metadata remain visible. This is eligibility privacy, not a private transfer.</div>
            </article>
          </div>
        </section>

        <div className="protocol-actions">
          <Link className="btn btn--secondary" href="/dojang">Check credential ↗</Link>
          <Link className="btn btn--secondary" href="/lending">Use it for lending ↗</Link>
          <Link className="btn btn--primary" href="/vault">Review vault action ↗</Link>
        </div>
      </div>
    </ProtocolPage>
  );
}
