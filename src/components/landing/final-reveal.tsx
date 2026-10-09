"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { Arrow } from "./arrow";
import { BrandMark } from "./brand-mark";

/* The last section. A fixed footer sits under the opaque content (the curtain);
   a one-screen spacer after the content lets the curtain peel away and reveal it.
   While it is hidden behind the curtain it is inert, so keyboard focus and screen
   readers never land on something nobody can see. */

const GIWA_DOCS = "https://docs.giwa.io/giwa-chain/en/get-started/connect-to-giwa";
const DOJANG_DOCS = "https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts";

export function FinalReveal({ appName }: { appName: string }) {
  const spacerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const spacer = spacerRef.current;
    const footer = footerRef.current as (HTMLElement & { inert: boolean }) | null;
    if (!spacer || !footer) return;
    let spacerVisible = false;

    const sync = () => {
      /* when the curtain is off (short windows, reduced motion) the footer is ordinary content */
      const curtain = getComputedStyle(footer).position === "fixed";
      footer.inert = curtain ? !spacerVisible : false;
    };
    const io = new IntersectionObserver((entries) => {
      spacerVisible = entries[0]?.isIntersecting ?? false;
      sync();
    });
    io.observe(spacer);
    window.addEventListener("resize", sync);
    sync();
    return () => {
      io.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  return (
    <>
      <div className="lp-spacer" ref={spacerRef} aria-hidden="true" />
      <footer className="lp-final" ref={footerRef} aria-labelledby="final-title" inert>
        <div className="lp-final__main">
          <h2 className="lp-final__title" id="final-title">See what your wallet can <em>prove.</em></h2>
          <p className="lp-final__lead">Check a credential with Dojang, generate a private proof, then enter the vault.</p>
          <div className="lp-actions">
            <Link className="lp-btn lp-btn--primary" href="/dojang">Launch the demo <Arrow /></Link>
            <Link className="lp-btn lp-btn--ghost" href="/docs">Read the docs</Link>
          </div>
        </div>

        <div className="lp-final__foot">
          <div className="lp-cols">
            <div className="lp-cols__brand">
              <Link className="lp-brand" href="/" aria-label={`${appName} home`}>
                <BrandMark />
                <span>{appName}</span>
              </Link>
              <p>A testnet demonstration of private eligibility proofs on GIWA Sepolia. An independent project.</p>
            </div>
            <nav aria-label="Protocol">
              <h2>Protocol</h2>
              <ul>
                <li><Link href="/dojang">Dojang</Link></li>
                <li><Link href="/bojagi">Bojagi</Link></li>
                <li><Link href="/vault">Vault</Link></li>
              </ul>
            </nav>
            <nav aria-label="Transparency">
              <h2>Transparency</h2>
              <ul>
                <li><Link href="/contracts">Contracts</Link></li>
                <li><Link href="/docs">Docs</Link></li>
              </ul>
            </nav>
            <nav aria-label="GIWA">
              <h2>GIWA</h2>
              <ul>
                <li><a href={GIWA_DOCS} target="_blank" rel="noopener noreferrer">Network setup</a></li>
                <li><a href={DOJANG_DOCS} target="_blank" rel="noopener noreferrer">Dojang contracts</a></li>
                <li><a href={GIWA_EXPLORER_URL} target="_blank" rel="noopener noreferrer">Explorer</a></li>
              </ul>
            </nav>
          </div>
          <p className="lp-legal">
            <span>GIWA Sepolia demonstration</span>
            <span>Not audited · No funds held</span>
          </p>
          <span className="lp-word-out" aria-hidden="true">{appName}</span>
        </div>
      </footer>
    </>
  );
}
