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
      status="DAO Governance"
      glyph={{ shape: "assembly", label: "Tiered half-circle seating made of characters: a governing body voting in public.", caption: "Verified wallets, public votes", legend: ["public"] }}
      title="Govern with a project credential."
      lead="Holders of an active Policy 4 project credential propose and vote on Robinhood Testnet. Votes are public; approved proposals can execute their bounded action. Mainnet governance remains paused. An earlier GIWA Sepolia DAO uses separate official Dojang membership."
    >
      <div className="protocol-section">
        <DaoWorkspace />
      </div>
    </ProtocolPage>
  );
}
