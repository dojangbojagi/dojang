import "@/components/lending/lending.css";
import "@/components/lending-v2/lending-v2.css";
import { LendingExperience } from "@/components/lending-v2/lending-experience";
import { ProtocolPage } from "@/components/protocol-page";
import { appEnv } from "@/lib/config/env";

export default function LendingPage() {
  return (
    <ProtocolPage
      page="lending"
      tone="vault"
      accent="gold"
      status="Robinhood · Lending V2"
      glyph={{ shape: "rings", label: "Two linked rings: supplying and borrowing, joined by a proof.", caption: "Supply and borrow, linked by a proof", legend: ["public", "private"] }}
      title="Lending & borrowing."
      lead={appEnv.mainnetVisible
        ? "Supply, deposit collateral, prove private eligibility, borrow, repay and withdraw in GYEVO. Policy 3 proofs gate risk-increasing actions; amounts, positions and transactions are public. Mainnet uses allowlisted synthetic assets and is not public production lending."
        : "Supply, deposit collateral, prove private eligibility, borrow, repay and withdraw in GYEVO. Policy 3 proofs gate risk-increasing actions; amounts, positions and transactions are public. Assets are synthetic and have no redemption value."}
    >
      <div className="protocol-section">
        <LendingExperience />
      </div>
    </ProtocolPage>
  );
}
