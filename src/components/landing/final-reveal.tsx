"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { appEnv } from "@/lib/config/env";
import { Arrow } from "./arrow";
import { BrandLogo } from "@/components/brand-logo";

/* The last section. A fixed footer sits under the opaque content (the curtain);
   a one-screen spacer after the content lets the curtain peel away and reveal it.
   While it is hidden behind the curtain it is inert, so keyboard focus and screen
   readers never land on something nobody can see. */

const GIWA_DOCS =
  "https://docs.giwa.io/giwa-chain/en/get-started/connect-to-giwa";
const DOJANG_DOCS =
  "https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts";

export function FinalReveal({ appName }: { appName: string }) {
  const spacerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const spacer = spacerRef.current;
    const footer = footerRef.current as
      | (HTMLElement & { inert: boolean })
      | null;
    if (!spacer || !footer) return;
    let spacerVisible = false;

    let curtain = getComputedStyle(footer).position === "fixed";
    const sync = () => {
      /* when the curtain is off (short windows, reduced motion) the footer is ordinary content */
      curtain = getComputedStyle(footer).position === "fixed";
      footer.inert = curtain ? !spacerVisible : false;
    };
    const io = new IntersectionObserver((entries) => {
      spacerVisible = entries[0]?.isIntersecting ?? false;
      sync();
    });
    io.observe(spacer);

    /* the footer rises into place as the curtain lifts: --fr runs 0 -> 1 across the spacer */
    let raf = 0;
    const rise = () => {
      raf = 0;
      if (!curtain) {
        footer.style.setProperty("--fr", "1");
        return;
      }
      const top = spacer.getBoundingClientRect().top;
      const fr = Math.min(
        1,
        Math.max(0, (window.innerHeight - top) / window.innerHeight),
      );
      footer.style.setProperty("--fr", fr.toFixed(3));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(rise);
    };
    const onResize = () => {
      sync();
      schedule();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    sync();
    rise();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      <div className="lp-spacer" ref={spacerRef} aria-hidden="true" />
      <footer
        className="lp-final"
        ref={footerRef}
        aria-labelledby="final-title"
        inert
      >
        <div className="lp-final__main">
          <h2 className="lp-final__title" id="final-title">
            See what your wallet can <em>prove.</em>
          </h2>
          <p className="lp-final__lead">
            Check your GYEVO project credential for DARK DAO governance, or prove
            eligibility privately with BOJAGI for Lending.
          </p>
          <div className="lp-actions">
            <Link className="lp-btn lp-btn--primary" href="/dojang">
              Launch App <Arrow />
            </Link>
            <Link className="lp-btn lp-btn--ghost" href="/docs">
              Read the docs
            </Link>
          </div>
        </div>

        <div className="lp-final__foot">
          <div className="lp-cols">
            <div className="lp-cols__brand">
              <Link
                className="lp-brand"
                href="/"
                aria-label={`${appName} home`}
              >
                <BrandLogo size={40} />
                <span>{appName}</span>
              </Link>
              <p>
                GYEVO protocol. {appEnv.mainnetVisible && "Mainnet DAO and Lending remain paused. "}
                Synthetic assets: no redemption. Independent of Robinhood, GIWA or Upbit.
              </p>
            </div>
            <nav aria-label="Protocol">
              <h2>Protocol</h2>
              <ul>
                <li>
                  <Link href="/dojang">Dojang</Link>
                </li>
                <li>
                  <Link href="/dark-dao">DARK DAO</Link>
                </li>
                <li>
                  <Link href="/bojagi">Bojagi</Link>
                </li>
                <li>
                  <Link href="/lending">Lending</Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Transparency">
              <h2>Transparency</h2>
              <ul>
                <li>
                  <Link href="/contracts">Contracts</Link>
                </li>
                <li>
                  <Link href="/docs">Docs</Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="GIWA references">
              <h2>GIWA · external</h2>
              <ul>
                <li>
                  <a href={GIWA_DOCS} target="_blank" rel="noopener noreferrer">
                    GIWA network setup
                    <span className="arr" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href={DOJANG_DOCS}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Dojang contracts
                    <span className="arr" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href={GIWA_EXPLORER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GIWA explorer
                    <span className="arr" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                </li>
              </ul>
            </nav>
          </div>
          <p className="lp-legal">
            <span>Contract evidence · See Contracts</span>
            <span>Unaudited · Not public production-ready</span>
          </p>
          <span
            className="lp-word-out"
            aria-hidden="true"
            style={{ ["--chars" as string]: appName.length }}
          >
            {appName}
          </span>
        </div>
      </footer>
    </>
  );
}
