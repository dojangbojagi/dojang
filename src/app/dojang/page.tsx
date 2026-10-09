"use client";

import { WalletNetworkCard } from "@/components/wallet-network-card";
import { CredentialWitnessImporter } from "@/components/credential-witness-importer";
import { useDojangVerification } from "@/hooks/use-dojang-verification";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { officialDojang } from "@/lib/config/contracts";

export default function DojangPage() {
  const wallet = useWalletNetwork();
  const dojang = useDojangVerification(wallet.address);
  return (
    <main className="page">
      <p className="eyebrow">Verify · Official read and separate demo credential</p>
      <h1>Dojang verification</h1>
      <p className="page-lead">Read the official GIWA Dojang Verified Address state for the selected UPBIT KOREA attester. A read does not issue an attestation.</p>
      <WalletNetworkCard />
      <section className="panel" aria-labelledby="official-dojang-heading">
        <div className="panel-heading">
          <h2 id="official-dojang-heading">Official GIWA Dojang</h2>
          <span className={`status-chip status-chip--${dojang.state}`}>{dojang.state.replaceAll("-", " ")}</span>
        </div>
        {!wallet.address ? <p>Connect a wallet to query official status.</p> : dojang.state === "read-error" ? <p role="alert">Unable to check Dojang through GIWA Sepolia. This is not a negative credential result.</p> : dojang.credential ? (
          <dl className="data-list">
            <div><dt>Issuer</dt><dd>{dojang.credential.issuer}</dd></div>
            <div><dt>Attestation UID</dt><dd><code>{dojang.credential.attestationUid}</code></dd></div>
            <div><dt>Issued at</dt><dd>{new Date(Number(dojang.credential.issuedAt) * 1000).toISOString()}</dd></div>
            <div><dt>Expires</dt><dd>{dojang.credential.expirationTime === BigInt(0) ? "No expiry" : new Date(Number(dojang.credential.expirationTime) * 1000).toISOString()}</dd></div>
            <div><dt>Schema UID</dt><dd>{dojang.credential.schemaUid}</dd></div>
          </dl>
        ) : dojang.state === "checking" ? <p>Checking the official attestation registry…</p> : <p>No official Dojang credential was found for this wallet and attester.</p>}
        <p className="muted">GIWA DojangScroll: <code>{officialDojang.dojangScroll}</code> · UPBIT KOREA attester ID: <code>{officialDojang.upbitKoreaAttesterId}</code></p>
        <button className="button button--quiet" type="button" onClick={() => void dojang.refetch()} disabled={!wallet.address}>Retry read</button>
      </section>
      <CredentialWitnessImporter />
    </main>
  );
}
