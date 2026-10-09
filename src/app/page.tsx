import Link from "next/link";
import { appEnv } from "@/lib/config/env";
import { WalletNetworkCard } from "@/components/wallet-network-card";

const destinations = [
  ["Dojang", "Inspect official GIWA Verified Address attestations and the separate project demo credential.", "/dojang"],
  ["Bojagi-inspired Protection", "Review the private eligibility policy and proof system readiness.", "/bojagi"],
  ["Restricted Vault", "Inspect on-chain access state and the proof-gated action.", "/vault"],
  ["Contracts", "See official GIWA references and project deployment status.", "/contracts"],
  ["Protocol Docs", "Read the trust model, data boundaries and current limitations.", "/docs"],
];

export default function HomePage() {
  return (
    <main className="page">
      <p className="eyebrow">GIWA Sepolia · Testnet demonstration</p>
      <h1>{appEnv.tagline}</h1>
      <p className="page-lead">Verify a trusted state, prove eligibility privately, then unlock an on-chain action. Exact private values are intended to remain off-chain; the proof and vault verifier are not yet configured in this checkpoint.</p>
      <WalletNetworkCard />
      <div className="route-grid">
        {destinations.map(([title, description, href]) => (
          <Link className="route-card" href={href} key={href}>
            <strong>{title}</strong><span>{description}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
