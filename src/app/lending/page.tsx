import "@/components/lending/lending.css";
import { LendingWorkspace } from "@/components/lending/lending-workspace";
import { ProtocolPage } from "@/components/protocol-page";

export default function LendingPage() {
  return (
    <ProtocolPage
      index={5}
      tone="vault"
      accent="gold"
      status="Proof-gated demo market"
      title="Lend, or borrow with a proof."
      lead="One demonstration market on GIWA Sepolia, built on real token transfers and on-chain accounting. Supplying needs only a wallet. Borrowing needs collateral and a private eligibility proof."
    >
      <div className="protocol-section">
        <LendingWorkspace />
      </div>
    </ProtocolPage>
  );
}
