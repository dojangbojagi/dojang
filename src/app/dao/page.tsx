import "@/components/lending/lending.css";
import "@/components/lending-v2/lending-v2.css";
import "@/components/dao/dao.css";
import { DaoReleaseWorkspaces } from "@/components/dao/dao-release-workspaces";
import { ProtocolPage } from "@/components/protocol-page";
import { appEnv } from "@/lib/config/env";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DARK DAO · GYEVO",
  description: "GYEVO governance, backed by project credentials and verified on-chain state.",
};

export default function DaoPage() {
  return (
    <ProtocolPage
      page="dao"
      tone="dojang"
      accent="celadon"
      status="DARK DAO · Governance"
      glyph={{ shape: "assembly", label: "Tiered half-circle seating made of characters: a governing body voting in public.", caption: "Verified wallets, public votes", legend: ["public"] }}
      title="DARK DAO."
      lead={appEnv.daoPhase2Visible
        ? "GYEVO governance connects project credentials, verified participation, and on-chain proposals. Phase 1 uses a public Policy 4 credential; Phase 2 is a separate reputation-gated ZK membership workflow, each with its own contracts and voting mechanism."
        : "GYEVO governance uses an active project-issued Policy 4 credential to gate public proposals and votes. Contract state and wallet network checks determine whether member actions are available."}
    >
      <DaoReleaseWorkspaces phase2Visible={appEnv.daoPhase2Visible} />
    </ProtocolPage>
  );
}
