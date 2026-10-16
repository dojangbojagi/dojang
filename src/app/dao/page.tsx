import "@/components/lending/lending.css";
import "@/components/lending-v2/lending-v2.css";
import "@/components/dao/dao.css";
import { DaoWorkspace } from "@/components/dao/dao-workspace";
import { DaoPhase2Workspace } from "@/components/dao/dao-phase2-workspace";
import { ProtocolPage } from "@/components/protocol-page";

export default function DaoPage() {
  return (
    <ProtocolPage
      page="dao"
      tone="dojang"
      accent="celadon"
      status="DAO Governance"
      glyph={{ shape: "assembly", label: "Tiered half-circle seating made of characters: a governing body voting in public.", caption: "Verified wallets, public votes", legend: ["public"] }}
      title="Govern with verified membership and lending reputation."
      lead="Phase 2 uses a genuine Policy 5 zero-knowledge proof of private Lending V2 reputation, then a commit–reveal ballot. The wallet is public and each choice becomes public when revealed. Phase 1 remains available below, and Mainnet governance remains paused."
    >
      <div className="protocol-section">
        <DaoPhase2Workspace />
      </div>
      <div className="protocol-section">
        <DaoWorkspace />
      </div>
    </ProtocolPage>
  );
}
