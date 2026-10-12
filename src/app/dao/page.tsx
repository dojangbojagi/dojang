import "@/components/lending/lending.css";
import "@/components/dao/dao.css";
import { DaoWorkspace } from "@/components/dao/dao-workspace";
import { ProtocolPage } from "@/components/protocol-page";

export default function DaoPage() {
  return (
    <ProtocolPage
      page="dao"
      tone="dojang"
      accent="celadon"
      status="Verified DAO governance"
      glyph={{ shape: "assembly", label: "Tiered half-circle seating made of characters: a governing body voting in public.", caption: "Verified wallets, public votes", legend: ["public"] }}
      title="Govern with a verified wallet."
      lead="Choose the governance network. GIWA Sepolia uses official Dojang Verified Address membership; Robinhood Testnet uses BOJOGAY project-issued policy-4 credentials, not official Dojang verification. Votes are public on either network."
    >
      <div className="protocol-section">
        <DaoWorkspace />
      </div>
    </ProtocolPage>
  );
}
