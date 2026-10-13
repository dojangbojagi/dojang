"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { appEnv } from "@/lib/config/env";
import { BrandLogo } from "@/components/brand-logo";
import { WalletControl } from "@/components/wallet-control";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";

/* The application bar: its own sections, a way back to the website, the network and the wallet. The public
   website (the landing) has its own bar with the introductions and "Launch App". */
const APP_LINKS = [
  ["app", "App", "/app"], ["lending", "Lending", "/lending"], ["dao", "DAO", "/dao"],
  ["docs", "Docs", "/docs"], ["contracts", "Contracts", "/contracts"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const wallet = useWalletNetwork(ROBINHOOD_TESTNET_CHAIN_ID);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (pathname === "/") return;
    const onScroll = () => setScrolled(window.scrollY > 18);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onResize = () => { if (window.innerWidth >= 960) setMenuOpen(false); };
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
  const walletState = wallet.state;
  const networkText = walletState === "wrong-network" ? "Switch to Robinhood Testnet" : "Robinhood Testnet";

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
          <span className="site-header__net">
            <span className="net-pill" title={`${networkText}, expected chain ID ${ROBINHOOD_TESTNET_CHAIN_ID}`}>
              <i className="net-pill__dot" aria-hidden="true" /><b>{networkText}</b><i>Testnet</i>
            </span>
          </span>
          <WalletControl expectedChainId={ROBINHOOD_TESTNET_CHAIN_ID} showRecoveryAction />
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
        <nav aria-label="Primary mobile">
          <ul>
            {APP_LINKS.map(([key, label, href]) => (
              <li key={key}><Link href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setMenuOpen(false)}><span>{label}</span></Link></li>
            ))}
            <li><Link href="/" onClick={() => setMenuOpen(false)}><span>← Website</span></Link></li>
          </ul>
        </nav>
        <div className="mobile-nav__net"><span className="net-pill"><i className="net-pill__dot" aria-hidden="true" /><b>{networkText}</b><i>Testnet</i></span></div>
      </div>
    </header>
  );
}
