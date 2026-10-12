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
      lead="Supply assets, borrow against collateral, and manage your position. Eligibility is proven privately with a project test credential; amounts, positions and actions are public. Test tokens and a controlled test oracle only."
    >
      <div className="protocol-section">
        <LendingExperience />
      </div>
    </ProtocolPage>
  );
}
