"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appEnv } from "@/lib/config/env";
import { BrandLogo } from "@/components/brand-logo";
import { GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import { ROBINHOOD_MAINNET_CHAIN_ID } from "@/lib/config/robinhood-mainnet-demo";

const GIWA_DOCS = "https://docs.giwa.io/giwa-chain/en/get-started/connect-to-giwa";
const DOJANG_DOCS = "https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <Link className="brand" href="/" aria-label={`${appEnv.appName}, home`}><BrandLogo size={34} /><span className="brand__name">{appEnv.appName}</span></Link>
            <p>Prove more. Reveal less. Verify trusted state, prove eligibility privately and unlock an on-chain action.</p>
          </div>
          <nav aria-label="Protocol"><h2>Protocol</h2><ul><li><Link href="/dojang">Dojang</Link></li><li><Link href="/dao">DAO governance</Link></li><li><Link href="/bojagi">Bojagi</Link></li><li><Link href="/lending">Lending</Link></li></ul></nav>
          <nav aria-label="Resources"><h2>Resources</h2><ul><li><Link href="/contracts">Contracts</Link></li><li><Link href="/docs">Docs</Link></li></ul></nav>
          <nav aria-label="GIWA references"><h2>GIWA · external</h2><ul>
            <li><a href={GIWA_DOCS} target="_blank" rel="noopener noreferrer">GIWA network setup<span className="visually-hidden"> (opens in a new tab)</span></a></li>
            <li><a href={DOJANG_DOCS} target="_blank" rel="noopener noreferrer">Dojang contracts<span className="visually-hidden"> (opens in a new tab)</span></a></li>
            <li><a href={GIWA_EXPLORER_URL} target="_blank" rel="noopener noreferrer">GIWA Sepolia explorer<span className="visually-hidden"> (opens in a new tab)</span></a></li>
          </ul></nav>
        </div>
        <div className="site-footer__legal">
          <div><span className="net-pill"><i className="net-pill__dot" aria-hidden="true" /><b>{appEnv.mainnetVisible ? "Mainnet + Testnet" : "Testnet"}</b><i>{appEnv.mainnetVisible ? `${ROBINHOOD_MAINNET_CHAIN_ID} · ` : ""}{ROBINHOOD_TESTNET_CHAIN_ID}</i></span></div>
          <p>{appEnv.mainnetVisible ? "Robinhood Mainnet: ten deployed contracts; DAO and Lending remain paused. Robinhood Testnet: verified interactive user journeys." : "Robinhood Testnet: verified interactive user journeys."}</p>
          <p>Synthetic assets have no redemption value. Not audited or public production-ready. Independent project, not affiliated with Robinhood, GIWA or Upbit. DOJANG and BOJAGI are project layers, separate from GIWA&apos;s.</p>
        </div>
      </div>
    </footer>
  );
}
