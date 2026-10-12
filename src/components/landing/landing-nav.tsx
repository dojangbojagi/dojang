"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWalletNetwork } from "@/hooks/use-wallet-network";

/* Same destinations as the app header. Light over the white cover, dark glass after it. */
const LINKS = [
  ["Dojang", "/dojang"],
  ["DAO", "/dao"],
  ["Bojagi", "/bojagi"],
  ["Lending", "/lending"],
  ["Contracts", "/contracts"],
  ["Docs", "/docs"],
  ["Vault", "/vault"],
] as const;

function WalletPill() {
  const wallet = useWalletNetwork();
  return (
    <ConnectButton.Custom>
      {({
        account,
        openAccountModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = mounted && account && wallet.isConnected;
        const wrongNetwork = connected && wallet.state === "wrong-network";
        const label = wallet.isSwitching ? "Switching…" : wallet.switchError ? "Switch failed" : "Wrong network";
        return (
          <div
            className="lp-wallet"
            data-pending={!mounted}
            aria-hidden={!mounted}
          >
            {!connected ? (
              <button
                type="button"
                className="lp-pill"
                onClick={openConnectModal}
              >
                <span className="lp-pill__long">Connect wallet</span>
                <span className="lp-pill__short">Connect</span>
              </button>
            ) : wrongNetwork ? (
              <button
                type="button"
                className="lp-pill lp-pill--warn"
                onClick={() => void wallet.switchToExpectedNetwork()}
                title={wallet.switchError ?? `Switch to Robinhood Chain Testnet · chain ${wallet.expectedChainId}`}
                aria-label={wallet.switchError ?? `Switch to Robinhood Chain Testnet · chain ${wallet.expectedChainId}`}
              >
                {label}
              </button>
            ) : (
              <button
                type="button"
                className="lp-pill lp-pill--ok"
                onClick={openAccountModal}
              >
                <i aria-hidden="true" />
                {account.displayName}
              </button>
            )}
            {wallet.switchError && <span className="visually-hidden" role="alert">{wallet.switchError}</span>}
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
          <Image src="/logo.svg" alt="" width={38} height={38} priority />
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
            <Link
              href={href}
              key={href}
              data-flagship={href === "/dao" ? "" : undefined}
            >
              {label}
            </Link>
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

      <nav
        className="lp-menu"
        id="lp-menu"
        data-open={open}
        aria-label="Mobile navigation"
        hidden={!open}
      >
        {LINKS.map(([label, href]) => (
          <Link href={href} key={href} onClick={() => setOpen(false)}>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
