"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { FEATURES, FeaturesMenu } from "@/components/features-menu";

/* The public bar: the logo, one Features menu (DOJANG and BOJAGI) and the way into the product.
   Lending, governance, docs and contracts are inside the app, behind "Launch App"; connecting a wallet
   happens there too. Light over the white cover, dark glass after it. */
export function LandingNav({ appName }: { appName: string }) {
  const [open, setOpen] = useState(false);

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
          <BrandLogo size={40} priority />
          <span>{appName}</span>
        </Link>

        <nav className="lp-nav__links" aria-label="Main navigation">
          <FeaturesMenu />
        </nav>

        <div className="lp-nav__right">
          <div className="lp-launch">
            <Link className="lp-pill lp-pill--launch" href="/app" aria-describedby="lp-launch-hint">
              Launch App
            </Link>
            <span className="lp-launch__hint" id="lp-launch-hint" role="tooltip">
              <b>Opens the application</b>
              <span>Lending · DAO · Docs · Contracts</span>
            </span>
          </div>
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
        <p className="lp-menu__label">Features</p>
        {FEATURES.map((f) => (
          <Link href={f.href} key={f.href} onClick={() => setOpen(false)}>
            <span className="lp-menu__name">{f.name}</span>
            <span className="lp-menu__desc">{f.desc}</span>
          </Link>
        ))}
        <Link className="lp-menu__launch" href="/app" onClick={() => setOpen(false)}>
          Launch App
        </Link>
        <p className="lp-menu__hint">Opens the application: Lending, DAO, Docs and Contracts.</p>
      </nav>
    </>
  );
}
