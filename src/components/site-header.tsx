"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { appEnv } from "@/lib/config/env";
import { BrandMark } from "@/components/brand-mark";
import { WalletControl } from "@/components/wallet-control";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";

const LINKS = [
  ["home", "Home", "/"], ["dojang", "Dojang", "/dojang"], ["bojagi", "Bojagi", "/bojagi"],
  ["vault", "Vault", "/vault"], ["contracts", "Contracts", "/contracts"], ["docs", "Docs", "/docs"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const wallet = useWalletNetwork();
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
  const networkText = walletState === "wrong-network" ? "Wrong network" : "GIWA Sepolia";

  return (
    <header className="site-header" data-scrolled={scrolled}>
      <div className="container site-header__inner">
        <Link className="brand" href="/" aria-label={`${appEnv.appName}, home`}>
          <BrandMark size={28} />
          <span className="brand__name">{appEnv.appName}</span>
        </Link>
        <nav className="nav" aria-label="Primary">
          <ul className="nav__list">
            {LINKS.map(([key, label, href]) => (
              <li key={key}><Link className="nav__link" href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="site-header__actions">
          <span className="site-header__net">
            <span className="net-pill" title={`${networkText}, expected chain ID ${GIWA_CHAIN_ID}`}>
              <i className="net-pill__dot" aria-hidden="true" /><b>{networkText}</b><i>Testnet</i>
            </span>
          </span>
          <WalletControl />
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
            {LINKS.map(([key, label, href]) => (
              <li key={key}><Link href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setMenuOpen(false)}><span>{label}</span></Link></li>
            ))}
          </ul>
        </nav>
        <div className="mobile-nav__net"><span className="net-pill"><i className="net-pill__dot" aria-hidden="true" /><b>{networkText}</b><i>Testnet</i></span></div>
      </div>
    </header>
  );
}
