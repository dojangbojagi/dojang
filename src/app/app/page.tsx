import type { Metadata } from "next";
import Link from "next/link";
import { TestAssetAddresses } from "@/components/test-asset-addresses";
import { SelectedWalletNetworkCard } from "@/components/wallet-network-card";
import { appEnv } from "@/lib/config/env";
import "./app-home.css";

export const metadata: Metadata = { title: `App · ${appEnv.appName}` };

/* The way into the product. It organises the existing pages and shows the wallet; it does not own any
   Web3 logic: the wallet card, the chain check and every action live in the routes it links to. */
const SECTIONS = [
  {
    href: "/dao",
    name: "DAO Governance",
    tag: "Policy 4 · No private proof",
    text: "An active GYEVO project credential lets an eligible wallet create proposals and vote. Every vote is public.",
  },
  {
    href: "/lending",
    name: "Lending",
    tag: "Policy 3 · BOJAGI proof",
    text: "Use a matching private witness to prove eligibility in your browser, then interact with test assets in Lending V2.",
  },
  {
    href: "/docs",
    name: "Docs",
    tag: "Reference",
    text: "How GYEVO works, what stays private, what is public, and the protocol's limits.",
  },
  {
    href: "/contracts",
    name: "Contracts",
    tag: "Transparency",
    text: "Inspect contract addresses, deployment evidence, and source-verification status.",
  },
] as const;

export default function AppHomePage() {
  return (
    <main className="page app-home">
      <header className="page-head app-home__head">
        <p className="eyebrow">Application · GYEVO protocol</p>
        <h1>{appEnv.appName} app</h1>
        <p className="page-lead">
          GYEVO uses project-issued credentials to gate two paths: Policy 4 for public DAO governance, and Policy 3 plus a private BOJAGI proof for lending. The proof hides the private eligibility value; it does not hide public transactions or amounts.
        </p>
        <p className="app-home__back">
          <Link className="protocol-inline-link" href="/">← Back to the website</Link>
          <span aria-hidden="true">·</span>
          <Link className="protocol-inline-link" href="/dojang">DOJANG</Link>
          <Link className="protocol-inline-link" href="/bojagi">BOJAGI</Link>
        </p>
      </header>

      <section className="app-home__grid" aria-label="Choose how to begin">
        <Link className="app-card" href="/contracts#verified-history">
          <span className="app-card__idx" aria-hidden="true">00</span>
          <span className="app-card__tag">Read-only · No wallet needed</span>
          <strong className="app-card__name">Explore Verified Activity</strong>
          <span className="app-card__text">Review confirmed historical receipts and contract readbacks. Historical transactions are not active positions.</span>
          <span className="app-card__go" aria-hidden="true">Explore history →</span>
        </Link>
        <Link className="app-card" href="/dojang">
          <span className="app-card__idx" aria-hidden="true">01</span>
          <span className="app-card__tag">Connect wallet · GYEVO</span>
          <strong className="app-card__name">Use GYEVO</strong>
          <span className="app-card__text">Check your project credential first. The authorized project issuer must issue it; Policy 3 also needs a matching private witness.</span>
          <span className="app-card__go" aria-hidden="true">Check credential →</span>
        </Link>
      </section>

      <section className="app-home__grid" aria-label="Application sections">
        {SECTIONS.map((section, index) => (
          <Link className="app-card" href={section.href} key={section.href}>
            <span className="app-card__idx" aria-hidden="true">{`0${index + 1}`}</span>
            <span className="app-card__tag">{section.tag}</span>
            <strong className="app-card__name">{section.name}</strong>
            <span className="app-card__text">{section.text}</span>
            <span className="app-card__go" aria-hidden="true">Open →</span>
          </Link>
        ))}
      </section>

      <TestAssetAddresses />

      <SelectedWalletNetworkCard />

      <p className="callout callout--demo app-home__note">
        Credentials here are issued by this project. They are not official GIWA, Dojang or Upbit credentials.
      </p>
    </main>
  );
}
