"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { appEnv } from "@/lib/config/env";
import { BrandLogo } from "@/components/brand-logo";
import { FEATURES, FeaturesMenu } from "@/components/features-menu";
import { WalletControl } from "@/components/wallet-control";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";

/* Two bars. The public website (the landing and the two feature pages) shows the logo, the Features menu and
   "Launch App". The application shows its own sections, a way back to the website, the network and the wallet. */
const APP_LINKS = [
  ["app", "App", "/app"], ["lending", "Lending", "/lending"], ["dao", "DAO", "/dao"],
  ["docs", "Docs", "/docs"], ["contracts", "Contracts", "/contracts"],
] as const;
const PUBLIC_ROUTES = ["/dojang", "/bojagi"];

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
  const isPublic = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const walletState = wallet.state;
  const networkText = walletState === "wrong-network" ? "Wrong network" : "Robinhood Testnet";

  if (isPublic) {
    return (
      <header className="site-header site-header--public" data-scrolled={scrolled}>
        <div className="container site-header__inner">
          <Link className="brand" href="/" aria-label={`${appEnv.appName}, home`}>
            <BrandLogo size={34} />
            <span className="brand__name">{appEnv.appName}</span>
          </Link>
          <nav className="nav nav--features" aria-label="Primary">
            <FeaturesMenu />
          </nav>
          <div className="site-header__actions">
            <Link className="btn btn--primary btn--sm" href="/app">Launch App</Link>
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
              {FEATURES.map((feature) => (
                <li key={feature.key}>
                  <Link href={feature.href} aria-current={pathname === feature.href ? "page" : undefined} onClick={() => setMenuOpen(false)}>
                    <span>{feature.name}</span><small>{feature.desc}</small>
                  </Link>
                </li>
              ))}
              <li><Link href="/app" onClick={() => setMenuOpen(false)}><span>Launch App</span></Link></li>
            </ul>
          </nav>
        </div>
      </header>
    );
  }

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
          <span className="site-header__net">
            <span className="net-pill" title={`${networkText}, expected chain ID ${ROBINHOOD_TESTNET_CHAIN_ID}`}>
              <i className="net-pill__dot" aria-hidden="true" /><b>{networkText}</b><i>Testnet</i>
            </span>
          </span>
          <WalletControl expectedChainId={ROBINHOOD_TESTNET_CHAIN_ID} />
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
