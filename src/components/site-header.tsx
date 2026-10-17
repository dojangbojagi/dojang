"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { appEnv } from "@/lib/config/env";
import { BrandLogo } from "@/components/brand-logo";
import { useProtocolNetworkSelection } from "@/components/protocol-network-selection";
import { ProtocolNetworkPicker } from "@/components/protocol-network-picker";
import { WalletControl } from "@/components/wallet-control";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { supportedProtocolChains } from "@/lib/config/network-registry";

/* The application bar: its own sections, a way back to the website, the network and the wallet. The public
   website (the landing) has its own bar with the introductions and "Launch App". */
const APP_LINKS = [
  ["app", "App", "/app"], ["lending", "Lending", "/lending"], ["dao", "DAO", "/dao"],
  ["docs", "Docs", "/docs"], ["contracts", "Contracts", "/contracts"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { selectedChainId, selectChain } = useProtocolNetworkSelection();
  const headerChainId = selectedChainId;
  const wallet = useWalletNetwork(headerChainId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (pathname === "/") return;
    const onScroll = () => setScrolled(window.scrollY > 18);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onResize = () => { if (window.innerWidth >= 1440) setMenuOpen(false); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [pathname]);

  if (pathname === "/") return null;
  const selectedNetwork = supportedProtocolChains.find((chain) => chain.id === headerChainId);
  const activeNetwork = supportedProtocolChains.find((chain) => chain.id === wallet.providerChainId);
  const networkName = selectedNetwork?.name ?? "Robinhood network";
  const connectedNetwork = wallet.isConnected
    ? wallet.providerChainPending
      ? "Verifying wallet network…"
      : wallet.providerChainReadError
        ? "Wallet network could not be verified"
        : wallet.providerChainId === undefined
          ? "Wallet network not verified"
          : `${activeNetwork?.name ?? "Unsupported network"} · chain ${wallet.providerChainId}`
    : wallet.status === "connecting" || wallet.status === "reconnecting"
      ? "Checking wallet connection…"
      : "Wallet disconnected";

  return (
    <header className="site-header site-header--app" data-scrolled={scrolled}>
      <div className="container site-header__inner">
        <Link className="brand" href="/app" aria-label={`${appEnv.appName}, app home`}>
          <BrandLogo size={34} />
          <span className="brand__name">{appEnv.appName}</span>
        </Link>
        <nav className="nav" aria-label="Primary">
          <ul className="nav__list">
            {APP_LINKS.map(([key, label, href]) => (
              <li key={key}><Link className="nav__link" href={href} data-flagship={key === "dao" ? "" : undefined} aria-current={pathname === href ? "page" : undefined}>{label}</Link></li>
            ))}
            <li className="nav__sep" aria-hidden="true" />
            <li><Link className="nav__link nav__link--site" href="/">← Website</Link></li>
          </ul>
        </nav>
        <div className="site-header__actions">
          <ProtocolNetworkPicker selectedChainId={headerChainId} onSelect={selectChain} />
          <span className="site-header__current-chain" title={`Actual wallet network: ${connectedNetwork}`} aria-live="polite">
            {connectedNetwork}
          </span>
          <button
            className="site-header__social"
            type="button"
            disabled
            title="The official GYEVO X URL has not been configured."
            aria-label="GYEVO X account unavailable until the official URL is configured"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.6 22H2.4l7.3-8.4L1.9 2h6.5l4.5 6.9L18.9 2Zm-1.1 18h1.7L7.4 3.9H5.6L17.8 20Z" />
            </svg>
          </button>
          <WalletControl expectedChainId={headerChainId} showRecoveryAction />
          <button
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((value) => !value)}
          ><span className="menu-toggle__bars" /></button>
        </div>
      </div>
      <div className="mobile-nav" id="mobile-nav" hidden={!menuOpen}>
        <div className="mobile-nav__network">
          <p className="small muted">App network: {networkName} · chain {headerChainId}</p>
          <p className="small muted" aria-live="polite">Actual wallet network: {connectedNetwork}</p>
          {wallet.isConnected && wallet.providerChainId !== undefined && wallet.providerChainId !== headerChainId && (
            <p className="small muted">Use the wallet control in the header to switch networks. Transactions stay disabled until the wallet is verified on the selected chain.</p>
          )}
        </div>
        <nav aria-label="Primary mobile">
          <ul>
            {APP_LINKS.map(([key, label, href]) => (
              <li key={key}><Link href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setMenuOpen(false)}><span>{label}</span></Link></li>
            ))}
            <li><Link href="/" onClick={() => setMenuOpen(false)}><span>← Website</span></Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
