import { PageGlyphFigure } from "@/components/page-glyph";
import { VaultActionPanel } from "@/components/vault-action-panel";
import { WalletNetworkCard } from "@/components/wallet-network-card";

export default function VaultPage() {
  return (
    <main className="page">
      <header className="page-head">
        <PageGlyphFigure glyph={{ shape: "cube", label: "A closed cube of sealed cells: the vault stays shut until a verified proof opens access.", caption: "A closed gate, not a deposit box", legend: ["sealed"] }} />
        <p className="eyebrow">Execute · Restricted Vault</p>
        <h1>Proof-gated access</h1>
        <p className="page-lead">The Vault is an on-chain access gate, not a deposit product. Access should change only after the contract verifies an eligibility proof.</p>
      </header>
      <WalletNetworkCard />
      <VaultActionPanel />
    </main>
  );
}
