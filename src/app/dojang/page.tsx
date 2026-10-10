"use client";

import Link from "next/link";
import { useState } from "react";
import { CredentialWitnessImporter } from "@/components/credential-witness-importer";
import { DemoCredentialTools } from "@/components/demo-credential-tools";
import { ProtocolPage } from "@/components/protocol-page";
import { StateChip } from "@/components/protocol-state";
import { WalletNetworkCard } from "@/components/wallet-network-card";
import { useDojangVerification } from "@/hooks/use-dojang-verification";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { officialDojang } from "@/lib/config/contracts";
import { GIWA_EXPLORER_URL } from "@/lib/config/chain";

function dateLabel(value: bigint) {
  return value === 0n ? "No expiry" : new Date(Number(value) * 1000).toLocaleString();
}

export default function DojangPage() {
  const wallet = useWalletNetwork();
  const dojang = useDojangVerification(wallet.address);
  const [readRequested, setReadRequested] = useState(false);

  return (
    <ProtocolPage
      page="dojang"
      tone="dojang"
      accent="celadon"
      status="Official read + project demo credential"
      glyph={{ shape: "orb", label: "A sphere of readable characters: the official Dojang record is public, so anyone can read it.", caption: "The official record is public", legend: ["public"] }}
      title="Check what is officially trusted."
      lead="Read the connected wallet’s official Dojang Verified Address record on GIWA Sepolia. Issuer-managed demo credentials are a separate path and are never shown as official identity verification."
    >
      <div className="protocol-stack protocol-section">
        <WalletNetworkCard />
        <div className="protocol-grid protocol-grid--even">
          <section className="panel panel--ticks protocol-panel" aria-labelledby="official-dojang-heading">
            <div className="protocol-panel__head">
              <h2 id="official-dojang-heading">Official GIWA Dojang</h2>
              <StateChip state={dojang.state} />
            </div>
            <p className="protocol-copy">Read-only query for the UPBIT KOREA Verified Address attester. A missing record is a valid result; a read failure is kept separate.</p>

            {!wallet.address && <p className="protocol-empty">Connect a wallet to check its official status.</p>}
            {wallet.address && dojang.state === "checking" && <p className="callout callout--demo" role="status" aria-live="polite">Reading Dojang and EAS attestation details from GIWA Sepolia…</p>}
            {wallet.address && dojang.state === "read-error" && <p className="callout callout--caution" role="alert">The official record could not be validated. This result does not mean the wallet lacks a credential.{dojang.error ? ` ${dojang.error.message}` : ""}</p>}
            {wallet.address && dojang.state === "no-official-credential" && <p className="protocol-empty">No official Verified Address credential was found for this wallet and attester.</p>}
            {dojang.credential && (
              <>
                <div className="protocol-panel__head"><h3>Attestation details</h3><StateChip state={dojang.credential.state} /></div>
                <dl className="kv protocol-kv">
                  <div className="kv__row"><dt>Wallet</dt><dd className="addr">{dojang.credential.wallet}</dd></div>
                  <div className="kv__row"><dt>Issuer</dt><dd className="addr">{dojang.credential.issuer}</dd></div>
                  <div className="kv__row"><dt>Attestation UID</dt><dd className="addr">{dojang.credential.attestationUid}</dd></div>
                  <div className="kv__row"><dt>Issued</dt><dd>{dateLabel(dojang.credential.issuedAt)}</dd></div>
                  <div className="kv__row"><dt>Expires</dt><dd>{dateLabel(dojang.credential.expirationTime)}</dd></div>
                  <div className="kv__row"><dt>Revoked</dt><dd>{dojang.credential.revocationTime === 0n ? "No" : dateLabel(dojang.credential.revocationTime)}</dd></div>
                  <div className="kv__row"><dt>EAS valid</dt><dd>{dojang.credential.isValid ? "Yes" : "No"}</dd></div>
                  <div className="kv__row"><dt>Verified Address content</dt><dd>{dojang.credential.isVerified ? "Verified" : "Not verified"}</dd></div>
                  <div className="kv__row"><dt>Schema UID</dt><dd className="addr">{dojang.credential.schemaUid}</dd></div>
                </dl>
              </>
            )}

            <div className="protocol-actions">
              <Link className="btn btn--secondary" href="/dao">Use it in DAO governance ↗</Link>
              <button className="btn btn--secondary" type="button" onClick={() => { setReadRequested(true); void dojang.refetch(); }} disabled={!wallet.address || dojang.isLoading}>
                {dojang.isLoading ? "Checking…" : "Refresh official status"}
              </button>
              {readRequested && !dojang.isLoading && dojang.state !== "read-error" && <span className="small muted" role="status">Read complete: {dojang.state.replaceAll("-", " ")}.</span>}
            </div>
          </section>

          <section className="panel panel--ticks protocol-panel" aria-labelledby="dojang-source-heading">
            <div className="protocol-panel__head"><h2 id="dojang-source-heading">Verified source</h2><StateChip state="connected">GIWA Sepolia</StateChip></div>
            <dl className="kv protocol-kv">
              <div className="kv__row"><dt>DojangScroll</dt><dd><a className="addr" href={`${GIWA_EXPLORER_URL}/address/${officialDojang.dojangScroll}`} target="_blank" rel="noopener noreferrer">{officialDojang.dojangScroll}<span className="visually-hidden"> (opens in a new tab)</span></a></dd></div>
              <div className="kv__row"><dt>Attester</dt><dd className="addr">{dojang.trustedAttester ?? (dojang.isTrustedAttesterLoading ? "Resolving from DojangAttesterBook…" : "Unavailable (read failed)")}</dd></div>
              <div className="kv__row"><dt>Attester ID</dt><dd className="addr">{officialDojang.upbitKoreaAttesterId}</dd></div>
              <div className="kv__row"><dt>Schema</dt><dd className="addr">{officialDojang.verifiedAddressSchemaUid}</dd></div>
            </dl>
          </section>
        </div>

        <section className="protocol-section" aria-labelledby="demo-path-heading">
          <header className="protocol-section__head">
            <p className="stub__num">PROJECT DEMO PATH · NOT OFFICIAL</p>
            <h2 id="demo-path-heading">Separate from official Dojang</h2>
            <p>The issuer-controlled commitment flow exists for the demo path. It needs the configured project contracts and an authorized issuer wallet, and no issuer keys or credentials are provided by this app.</p>
          </header>
          <div className="protocol-grid protocol-grid--even">
            <CredentialWitnessImporter />
            <DemoCredentialTools />
          </div>
        </section>
      </div>
    </ProtocolPage>
  );
}
