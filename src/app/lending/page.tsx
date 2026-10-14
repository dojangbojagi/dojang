import "@/components/lending/lending.css";
import "@/components/lending-v2/lending-v2.css";
import { LendingExperience } from "@/components/lending-v2/lending-experience";
import { ProtocolPage } from "@/components/protocol-page";

export default function LendingPage() {
  return (
    <ProtocolPage
      page="lending"
      tone="vault"
      accent="gold"
      status="Testnet · Lending V2"
      glyph={{ shape: "rings", label: "Two linked rings: supplying and borrowing, joined by a proof.", caption: "Supply and borrow, linked by a proof", legend: ["public", "private"] }}
      title="Lending & borrowing."
      lead="The interactive Robinhood Testnet journey covers supply, collateral, BOJAGI proof, borrow, repay and withdraw. Policy 3 proofs gate supply, collateral activation and borrow; amounts, positions and actions are public. Test tokens and synthetic prices only. Mainnet Lending remains paused."
    >
      <div className="protocol-section">
        <LendingExperience />
      </div>
    </ProtocolPage>
  );
}
