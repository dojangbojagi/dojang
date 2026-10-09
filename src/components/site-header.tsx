"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { appEnv } from "@/lib/config/env";

const links = [
  ["Dojang", "/dojang"],
  ["Bojagi", "/bojagi"],
  ["Vault", "/vault"],
  ["Contracts", "/contracts"],
  ["Docs", "/docs"],
];

export function SiteHeader() {
  const wallet = useWalletNetwork();
  const pathname = usePathname();
  /* The landing page has its own navigation (components/landing/landing-nav.tsx) */
  if (pathname === "/") return null;
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label={`${appEnv.appName} home`}>
        <span className="brand-mark" aria-hidden="true">⬚</span>
        <span>{appEnv.appName}</span>
      </Link>
      <nav aria-label="Main navigation">
        {links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
      </nav>
      <div className="header-actions">
        <span className={`network-pill ${wallet.state === "connected" ? "network-pill--ready" : ""}`}>
          {wallet.state === "wrong-network" ? "Wrong network" : "GIWA Sepolia"}
        </span>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </div>
    </header>
  );
}
