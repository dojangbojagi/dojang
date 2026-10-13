import "@/components/lending/lending.css";
import "@/components/lending-v2/lending-v2.css";
import Link from "next/link";
import { LendingWorkspace } from "@/components/lending/lending-workspace";
import { ProtocolPage } from "@/components/protocol-page";

export default function LegacyLendingPage() {
  return (
    <ProtocolPage
      page="lending"
      tone="vault"
      accent="gold"
      status="Legacy · GIWA Sepolia · Lending V1"
      glyph={{ shape: "rings", label: "Two linked rings: legacy lending pool", caption: "Legacy GIWA Sepolia demonstration", legend: ["private", "public"] }}
      title="Legacy Lending V1."
      lead="This separate GIWA Sepolia demonstration uses its original policy-2 credential flow. It does not use Robinhood Testnet Lending V2 credentials, proofs, reserves or positions."
    >
      <div className="protocol-section">
        <p className="callout callout--caution" role="note">
          This route is retained for the legacy GIWA V1 flow. The primary <Link className="protocol-inline-link" href="/lending">Robinhood Testnet Lending V2 experience</Link> is separate.
        </p>
        <LendingWorkspace />
      </div>
    </ProtocolPage>
  );
}
