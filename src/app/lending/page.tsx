import "@/components/lending/lending.css";
import { LendingWorkspace } from "@/components/lending/lending-workspace";
import { ProtocolPage } from "@/components/protocol-page";

export default function LendingPage() {
  return (
    <ProtocolPage
      page="lending"
      tone="vault"
      accent="gold"
      status="Proof-gated demo market"
      glyph={{ shape: "rings", label: "Two linked rings: supplying and borrowing, joined by a proof.", caption: "Supply and borrow, linked by a proof", legend: ["public", "private"] }}
      title="Lend, or borrow with a proof."
      lead="One demonstration market on GIWA Sepolia, built on real token transfers and on-chain accounting. Supplying needs only a wallet. Borrowing needs collateral and a private eligibility proof."
    >
      <div className="protocol-section">
        <LendingWorkspace />
      </div>
    </ProtocolPage>
  );
}
