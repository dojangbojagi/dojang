"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BrandMark } from "@/components/brand-mark";

/* Same destinations as the app header. Light over the white cover, dark glass after it. */
const LINKS = [
  ["Dojang", "/dojang"],
  ["Bojagi", "/bojagi"],
  ["Vault", "/vault"],
  ["Contracts", "/contracts"],
  ["Docs", "/docs"],
] as const;

function WalletPill() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        return (
          <div className="lp-wallet" data-pending={!mounted} aria-hidden={!mounted}>
            {!connected ? (
              <button type="button" className="lp-pill" onClick={openConnectModal}>
                <span className="lp-pill__long">Connect wallet</span>
                <span className="lp-pill__short">Connect</span>
              </button>
            ) : chain.unsupported ? (
              <button type="button" className="lp-pill lp-pill--warn" onClick={openChainModal}>Wrong network</button>
            ) : (
              <button type="button" className="lp-pill lp-pill--ok" onClick={openAccountModal}>
                <i aria-hidden="true" />
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

export function LandingNav({ appName }: { appName: string }) {
  const [open, setOpen] = useState(false);
  const linksRef = useRef<HTMLElement>(null);

  /* one highlight slides to whichever link is hovered or focused */
  const moveBead = (link: Element | null) => {
    const nav = linksRef.current;
    if (!nav) return;
    if (!(link instanceof HTMLElement)) {
      nav.dataset.hover = "false";
      return;
    }
    nav.style.setProperty("--bead-x", `${link.offsetLeft}px`);
    nav.style.setProperty("--bead-w", `${link.offsetWidth}px`);
    nav.dataset.hover = "true";
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 1120) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <header className="lp-nav" data-open={open}>
        <Link className="lp-brand" href="/" aria-label={`${appName} home`}>
          <BrandMark />
          <span>{appName}</span>
        </Link>

        <nav
          className="lp-nav__links"
          aria-label="Main navigation"
          ref={linksRef}
          onPointerOver={(e) => moveBead((e.target as Element).closest("a"))}
          onPointerLeave={() => moveBead(null)}
          onFocus={(e) => moveBead((e.target as Element).closest("a"))}
          onBlur={() => moveBead(null)}
        >
          <i className="lp-bead" aria-hidden="true" />
          {LINKS.map(([label, href]) => (
            <Link href={href} key={href}>{label}</Link>
          ))}
        </nav>

        <div className="lp-nav__right">
          <WalletPill />
          <button
            type="button"
            className="lp-menu-btn"
            aria-expanded={open}
            aria-controls="lp-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
          </button>
        </div>
      </header>

      <nav className="lp-menu" id="lp-menu" data-open={open} aria-label="Mobile navigation" hidden={!open}>
        {LINKS.map(([label, href]) => (
          <Link href={href} key={href} onClick={() => setOpen(false)}>{label}</Link>
        ))}
      </nav>
    </>
  );
}
