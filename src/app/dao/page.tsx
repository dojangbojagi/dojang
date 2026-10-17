import "@/components/lending/lending.css";
import "@/components/lending-v2/lending-v2.css";
import "@/components/dao/dao.css";
import { DaoReleaseWorkspaces } from "@/components/dao/dao-release-workspaces";
import { ProtocolPage } from "@/components/protocol-page";
import { appEnv } from "@/lib/config/env";

export default function DaoPage() {
  return (
    <ProtocolPage
      page="dao"
      tone="dojang"
      accent="celadon"
      status="DAO Governance"
      glyph={{ shape: "assembly", label: "Tiered half-circle seating made of characters: a governing body voting in public.", caption: "Verified wallets, public votes", legend: ["public"] }}
      title="Govern with verified membership."
      lead={appEnv.daoPhase2Visible
        ? "Choose between the original Phase 1 governance flow and the separate Phase 2 reputation-gated workflow. Each release uses its own contracts, credentials, and voting mechanism."
        : "Create proposals and vote through the existing Phase 1 governance flow. The page checks the selected governance contract and your Policy 4 membership before enabling member actions."}
    >
      <DaoReleaseWorkspaces phase2Visible={appEnv.daoPhase2Visible} />
    </ProtocolPage>
  );
}
