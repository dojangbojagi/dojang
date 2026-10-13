import type { Metadata } from "next";
import Link from "next/link";
import { TestAssetAddresses } from "@/components/test-asset-addresses";
import { WalletNetworkCard } from "@/components/wallet-network-card";
import { appEnv } from "@/lib/config/env";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import "./app-home.css";

export const metadata: Metadata = { title: `App · ${appEnv.appName}` };

/* The way into the product. It organises the existing pages and shows the wallet; it does not own any
   Web3 logic: the wallet card, the chain check and every action live in the routes it links to. */
const SECTIONS = [
  {
    href: "/lending",
    name: "Lending",
    tag: "Private proof · Policy 3",
    text: "Prove eligibility with a private proof built in your browser, then supply and borrow test assets in Lending V2.",
  },
  {
    href: "/dao",
    name: "DAO Governance",
    tag: "DAO Governance · Policy 4",
    text: "Hold an active project credential to create proposals and vote on Robinhood Testnet. Votes are public.",
  },
  {
    href: "/docs",
    name: "Docs",
    tag: "Reference",
    text: "How GYEVO works, what is private and what is public, and the limits of this testnet demonstration.",
  },
  {
    href: "/contracts",
    name: "Contracts",
    tag: "Transparency",
    text: "The deployed contracts, their purpose and status on the Robinhood Testnet explorer.",
  },
] as const;

export default function AppHomePage() {
  return (
    <main className="page app-home">
      <header className="page-head app-home__head">
        <p className="eyebrow">Application · Robinhood Testnet · chain {ROBINHOOD_TESTNET_CHAIN_ID}</p>
        <h1>{appEnv.appName} app</h1>
        <p className="page-lead">
          Use project-issued credentials and private proofs on a test network. Connect a wallet when you are ready;
          nothing is connected for you, and no real funds are involved.
        </p>
        <p className="app-home__back">
          <Link className="protocol-inline-link" href="/">← Back to the website</Link>
          <span aria-hidden="true">·</span>
          <Link className="protocol-inline-link" href="/dojang">DOJANG</Link>
          <Link className="protocol-inline-link" href="/bojagi">BOJAGI</Link>
        </p>
      </header>

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

      <WalletNetworkCard expectedChainId={ROBINHOOD_TESTNET_CHAIN_ID} />

      <p className="callout callout--demo app-home__note">
        Credentials here are issued by this project. They are not official GIWA, Dojang or Upbit credentials.
      </p>
    </main>
  );
}
