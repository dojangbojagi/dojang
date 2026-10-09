import { VaultActionPanel } from "@/components/vault-action-panel";
import { WalletNetworkCard } from "@/components/wallet-network-card";

export default function VaultPage() {
  return (
    <main className="page">
      <p className="eyebrow">Execute · Restricted Vault</p>
      <h1>Proof-gated access</h1>
      <p className="page-lead">The Vault is an on-chain access gate, not a deposit product. Access should change only after the contract verifies an eligibility proof.</p>
      <WalletNetworkCard />
      <VaultActionPanel />
    </main>
  );
}
