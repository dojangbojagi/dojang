"use client";

import { useState, type ReactNode } from "react";
import { AmountAction } from "@/components/lending/amount-action";
import { formatAmount, minBigint, shortAddress } from "@/components/lending/format";
import { LendingIssuerTools } from "@/components/lending/lending-issuer-tools";
import { shortMarketMessage } from "@/components/lending/lending-panels";
import type { ActionRunner, LendingMarket } from "@/components/lending/types";
import { StateChip } from "@/components/protocol-state";
import type { useLendingCredential } from "@/hooks/use-lending-credential";
import type { useLendingEligibilityProof } from "@/hooks/use-lending-eligibility-proof";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { parseDemoCredentialWitness, type DemoCredentialWitness } from "@/lib/credential/witness";
import { LENDING_ELIGIBILITY_THRESHOLD, LENDING_MAX_LTV_BPS, LENDING_POLICY_ID } from "@/lib/lending/config";
import { explainProtocolError } from "@/lib/protocol/errors";
import { ProtocolError, type LendingCredentialState, type LendingProofState } from "@/lib/protocol/types";

interface BorrowViewProps {
  market: LendingMarket;
  runner: ActionRunner;
  credential: ReturnType<typeof useLendingCredential>;
  proof: ReturnType<typeof useLendingEligibilityProof>;
  witness: DemoCredentialWitness | null;
  onWitness: (witness: DemoCredentialWitness | null) => void;
}

const CREDENTIAL_COPY: Record<LendingCredentialState, string> = {
  unconfigured: "The credential registry is not configured, so eligibility cannot be checked.",
  disconnected: "Connect a wallet to check its lending credential.",
  checking: "Reading the credential from the registry…",
  missing: "No lending credential is registered for this wallet. An account with the registry issuer role must issue a policy-2 credential to it; then import the private witness that the issuer delivers.",
  active: "",
  expired: "This credential has expired. Ask the issuer for a new one; borrowing is blocked until then.",
  revoked: "The issuer revoked this credential. Borrowing is blocked.",
  "issuer-untrusted": "The issuer of this credential no longer holds the registry issuer role, so the pool would reject it.",
  "read-error": "The credential could not be read. This does not mean the wallet has none. Try again in a moment.",
};

const PROOF_COPY: Record<LendingProofState, string> = {
  unconfigured: "Proving needs both the LendingPool and the credential registry to be configured.",
  disconnected: "Connect a wallet to prove eligibility.",
  "wrong-network": "Switch to GIWA Sepolia before proving.",
  "checking-credential": "Checking the credential first…",
  "credential-required": "A lending credential is required before a proof can be made.",
  "credential-expired": "The credential has expired, so no proof can be made.",
  "credential-revoked": "The credential was revoked, so no proof can be made.",
  "issuer-untrusted": "The credential's issuer is no longer authorized, so no proof can be made.",
  "witness-required": "Import the private witness for this credential. The proof is built from it in this browser.",
  "ready-to-prove": "Ready. The proof is built in this browser and can take a while; the private value never leaves this device.",
  generating: "Generating the proof in your browser. Keep this tab open.",
  "proof-ready": "A proof bound to this wallet, credential and the LendingPool is ready and was verified locally. Nothing has been sent on-chain.",
  invalid: "The witness, credential or proof does not match the lending policy.",
};

function Step({ n, title, done, status, children }: { n: number; title: string; done: boolean; status?: ReactNode; children: ReactNode }) {
  return (
    <li className="lend-step" data-done={done ? "true" : undefined}>
      <header className="lend-step__head">
        <span className="lend-step__n" aria-hidden="true">{done ? "✓" : n}</span>
        <h3>{title}</h3>
        {status}
      </header>
      <div className="lend-step__body">{children}</div>
    </li>
  );
}

/** The borrower experience, in the order the pool requires it: credential, proof, collateral, borrow, repay. */
export function BorrowView({ market, runner, credential, proof, witness, onWitness }: BorrowViewProps) {
  const wallet = useWalletNetwork();
  const [importMessage, setImportMessage] = useState("");
  const [proofMessage, setProofMessage] = useState("");
  const { summary, position } = market;

  async function importWitness(file?: File) {
    if (!file) return;
    setImportMessage("");
    try {
      const candidate = parseDemoCredentialWitness(JSON.parse(await file.text()));
      if (!wallet.address || candidate.wallet.toLowerCase() !== wallet.address.toLowerCase()) throw new Error("This witness is not bound to the connected wallet.");
      if (candidate.policyId !== Number(LENDING_POLICY_ID)) throw new Error(`This witness belongs to policy ${candidate.policyId}. Lending uses policy ${LENDING_POLICY_ID.toString()}.`);
      if (!credential.record || credential.state !== "active") throw new Error("There is no active lending credential on record for this wallet to match.");
      if (candidate.commitment.toLowerCase() !== credential.record.commitment.toLowerCase()) throw new Error("The witness commitment does not match the credential on record.");
      if (BigInt(candidate.expiresAt) !== credential.record.expiresAt) throw new Error("The witness expiry does not match the credential on record.");
      onWitness(candidate);
      setImportMessage("The witness metadata matches the credential on record. The circuit checks the private value and salt when you generate the proof.");
    } catch (cause) {
      onWitness(null);
      setImportMessage(cause instanceof SyntaxError ? "That file is not valid JSON." : explainProtocolError(cause));
    }
  }

  async function generate() {
    setProofMessage("");
    try {
      await proof.generateProof();
      setProofMessage("Proof generated and verified locally. No transaction was submitted.");
    } catch (cause) {
      setProofMessage(explainProtocolError(cause));
    }
  }

  const credentialActive = credential.state === "active";
  const proofReady = proof.state === "proof-ready" && Boolean(proof.proof);
  const canProve = (proof.state === "ready-to-prove" || proof.state === "proof-ready") && !runner.busy;
  const proofBytes = proof.proof ? (proof.proof.proof.length - 2) / 2 : 0;

  const lend = summary?.lendingAsset;
  const coll = summary?.collateralAsset;
  const ready = Boolean(summary && position && lend && coll);

  return (
    <div className="lend-borrow">
      <p className="protocol-copy">
        Borrowing is gated by a private eligibility proof and bounded by collateral you actually deposit. The proof only shows you are eligible:
        it never sets an amount. Every loan is still limited on-chain by your collateral, a {Number(LENDING_MAX_LTV_BPS) / 100}% loan-to-value cap and the pool&apos;s free liquidity.
      </p>
      <ol className="lend-steps">
        <Step
          n={1}
          title="Lending credential"
          done={credentialActive && Boolean(witness)}
          status={<StateChip state={credential.state === "active" ? "active" : credential.state}>{credential.state === "active" ? "Credential active" : undefined}</StateChip>}
        >
          {credentialActive ? (
            <dl className="kv protocol-kv">
              <div className="kv__row"><dt>Policy</dt><dd>ID {LENDING_POLICY_ID.toString()} · private value of at least {LENDING_ELIGIBILITY_THRESHOLD.toString()} demo units</dd></div>
              <div className="kv__row"><dt>Version</dt><dd>{credential.record?.version.toString()}</dd></div>
              <div className="kv__row"><dt>Expires</dt><dd>{credential.record ? new Date(Number(credential.record.expiresAt) * 1000).toLocaleString() : "—"}</dd></div>
              <div className="kv__row"><dt>Issuer</dt><dd className="addr">{credential.record ? shortAddress(credential.record.issuer) : "—"}{credential.issuerAuthorized ? " · authorized" : ""}</dd></div>
            </dl>
          ) : (
            <p className={`callout ${credential.state === "checking" || credential.state === "disconnected" ? "callout--demo" : "callout--caution"}`} role="status">{CREDENTIAL_COPY[credential.state]}</p>
          )}
          <p className="small muted">This is a project demo credential from the registry. It is separate from official Dojang and says nothing about real funds.</p>
          <label className="protocol-field" htmlFor="lend-witness-file"><span>Private witness JSON (from your issuer)</span>
            <input id="lend-witness-file" type="file" accept="application/json,.json" disabled={!credentialActive} onChange={(event) => { void importWitness(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
          </label>
          {witness && <p className="small muted" role="status">Witness loaded in memory for <span className="addr">{shortAddress(witness.wallet)}</span>. It is not uploaded or stored.</p>}
          {importMessage && <p className={`callout ${witness ? "callout--demo" : "callout--caution"}`} role="status" aria-live="polite">{importMessage}</p>}
          <div className="protocol-actions">
            <button className="btn btn--secondary" type="button" onClick={() => { onWitness(null); setImportMessage("Witness cleared from memory."); }} disabled={!witness}>Clear witness</button>
          </div>
          <LendingIssuerTools onIssued={(issued) => { onWitness(issued); setImportMessage("The new credential and its witness are ready."); }} />
        </Step>

        <Step n={2} title="Eligibility proof" done={proofReady} status={<StateChip state={proof.state}>{proof.state === "proof-ready" ? "Proof ready" : undefined}</StateChip>}>
          <p className={`callout ${proof.state === "invalid" || proof.state === "unconfigured" || proof.state.startsWith("credential-") || proof.state === "issuer-untrusted" ? "callout--caution" : "callout--demo"}`} role="status" aria-live="polite">
            {proof.state === "invalid" && proof.error ? proof.error : PROOF_COPY[proof.state]}
          </p>
          {proof.proof && (
            <dl className="kv protocol-kv">
              <div className="kv__row"><dt>Local check</dt><dd>Verified in this browser</dd></div>
              <div className="kv__row"><dt>Proof</dt><dd>{proofBytes.toLocaleString("en-US")} bytes · {proof.proof.publicInputs.length} public inputs</dd></div>
              <div className="kv__row"><dt>Bound to</dt><dd className="addr">LendingPool {shortAddress(proof.proof.publicContext.vault)}</dd></div>
              <div className="kv__row"><dt>Created</dt><dd>{new Date(proof.proof.createdAt).toLocaleString()}</dd></div>
            </dl>
          )}
          <div className="callout callout--demo"><p><strong>Private:</strong> the value and salt. <strong>Public:</strong> wallet, commitment, policy, threshold, credential version and expiry, chain, the LendingPool address and the proof.</p></div>
          <div className="protocol-actions">
            <button className="btn btn--primary" type="button" onClick={() => void generate()} disabled={!canProve}>
              {proof.state === "generating" ? "Generating proof…" : proof.state === "proof-ready" ? "Generate a new proof" : "Generate proof"}
            </button>
          </div>
          {proofMessage && proof.state !== "invalid" && <p className="small" role="status" aria-live="polite">{proofMessage}</p>}
        </Step>

        <Step n={3} title="Deposit collateral" done={Boolean(position && position.collateralBalance > 0n)}>
          {ready && position && coll && lend ? (
            <>
              <dl className="kv protocol-kv">
                <div className="kv__row"><dt>Your {coll.symbol} balance</dt><dd>{formatAmount(position.collateralAssetBalance, coll.decimals)}</dd></div>
                <div className="kv__row"><dt>Approved for the pool</dt><dd>{formatAmount(position.collateralAssetAllowance, coll.decimals)}</dd></div>
                <div className="kv__row"><dt>Deposited collateral</dt><dd>{formatAmount(position.collateralBalance, coll.decimals)} {coll.symbol}</dd></div>
              </dl>
              <p className="small muted">Collateral is real {coll.symbol} locked in the pool. A private proof never counts as collateral. At the fixed demo price, 1 {coll.symbol} is worth 1 {lend.symbol}.</p>
              <AmountAction
                title="Deposit"
                fieldLabel="Collateral to deposit"
                asset={coll}
                verb="Deposit"
                submitLabel="Deposit collateral"
                successMessage="Collateral deposit confirmed by the receipt and the contract readback."
                approveSuccessMessage="Approval confirmed. You can deposit now."
                balance={position.collateralAssetBalance}
                allowance={position.collateralAssetAllowance}
                max={position.collateralAssetBalance}
                onApprove={market.approveCollateralAsset}
                onSubmit={market.depositCollateral}
                runner={runner}
              />
              {position.collateralAssetBalance === 0n && position.collateralBalance === 0n && (
                <p className="callout callout--demo" role="status">This wallet holds no {coll.symbol}. The demo token can only be minted by the market operator; there is no faucet here.</p>
              )}
            </>
          ) : (
            <p className="protocol-empty">{shortMarketMessage(market.state) ?? "Collateral is not available until the market and your wallet have been read."}</p>
          )}
        </Step>

        <Step n={4} title="Borrow" done={Boolean(position && position.debtBalance > 0n)}>
          {ready && position && summary && lend ? (
            <>
              <dl className="kv protocol-kv">
                <div className="kv__row"><dt>Maximum loan-to-value</dt><dd>{Number(LENDING_MAX_LTV_BPS) / 100}%</dd></div>
                <div className="kv__row"><dt>Collateral value</dt><dd>{formatAmount(position.collateralValue, lend.decimals)} {lend.symbol}</dd></div>
                <div className="kv__row"><dt>Borrowing capacity</dt><dd>{formatAmount(position.borrowingCapacity, lend.decimals)} {lend.symbol}</dd></div>
                <div className="kv__row"><dt>Remaining capacity</dt><dd>{formatAmount(position.remainingBorrowCapacity, lend.decimals)} {lend.symbol}</dd></div>
                <div className="kv__row"><dt>Available in the pool</dt><dd>{formatAmount(summary.availableLiquidity, lend.decimals)} {lend.symbol}</dd></div>
                <div className="kv__row"><dt>Your debt</dt><dd>{formatAmount(position.debtBalance, lend.decimals)} {lend.symbol}</dd></div>
              </dl>
              <AmountAction
                title="Borrow"
                fieldLabel="Amount to borrow"
                asset={lend}
                verb="Borrow"
                submitLabel="Borrow with proof"
                successMessage="Borrow confirmed by the receipt and the contract readback. The debt is recorded on-chain."
                max={minBigint(position.remainingBorrowCapacity, summary.availableLiquidity)}
                hint={`Up to ${formatAmount(minBigint(position.remainingBorrowCapacity, summary.availableLiquidity), lend.decimals)} ${lend.symbol} right now. Zero interest: you repay exactly what you borrow.`}
                precondition={
                  !credentialActive ? "An active lending credential is required to borrow."
                  : !proofReady ? "Generate an eligibility proof first (step 2)."
                  : position.collateralBalance === 0n ? "Deposit collateral first (step 3). It creates the borrowing capacity."
                  : position.remainingBorrowCapacity === 0n ? "No borrowing capacity left. Deposit more collateral or repay."
                  : null
                }
                checkAmount={(amount) =>
                  amount > position.remainingBorrowCapacity
                    ? `This is more than your remaining capacity (${formatAmount(position.remainingBorrowCapacity, lend.decimals)} ${lend.symbol}).`
                    : amount > summary.availableLiquidity
                      ? `Only ${formatAmount(summary.availableLiquidity, lend.decimals)} ${lend.symbol} is available in the pool right now.`
                      : null}
                onSubmit={(amount) => {
                  if (!proof.proof) return Promise.reject(new ProtocolError("INVALID_PROOF", "Generate an eligibility proof first."));
                  return market.borrow(amount, proof.proof);
                }}
                runner={runner}
              />
            </>
          ) : (
            <p className="protocol-empty">{shortMarketMessage(market.state) ?? "Borrowing is not available until the market and your wallet have been read."}</p>
          )}
        </Step>

        <Step n={5} title="Repay and release collateral" done={false}>
          {ready && position && lend && coll ? (
            <div className="lend-actions">
              <AmountAction
                title="Repay"
                fieldLabel="Amount to repay"
                asset={lend}
                verb="Repay"
                submitLabel="Repay debt"
                successMessage="Repayment confirmed by the receipt and the contract readback."
                approveSuccessMessage="Approval confirmed. You can repay now."
                balance={position.lendingAssetBalance}
                allowance={position.lendingAssetAllowance}
                max={minBigint(position.debtBalance, position.lendingAssetBalance)}
                hint={`You owe ${formatAmount(position.debtBalance, lend.decimals)} ${lend.symbol}. No interest has accrued.`}
                precondition={position.debtBalance === 0n ? "You have no outstanding debt." : null}
                checkAmount={(amount) => amount > position.debtBalance ? `This is more than your debt (${formatAmount(position.debtBalance, lend.decimals)} ${lend.symbol}).` : null}
                onApprove={market.approveLendingAsset}
                onSubmit={market.repay}
                runner={runner}
              />
              <AmountAction
                title="Withdraw collateral"
                fieldLabel="Collateral to withdraw"
                asset={coll}
                verb="Withdraw collateral"
                submitLabel="Withdraw collateral"
                successMessage="Collateral withdrawal confirmed by the receipt and the contract readback."
                max={position.debtBalance === 0n ? position.collateralBalance : undefined}
                hint={position.debtBalance === 0n
                  ? "No debt: all of your deposited collateral can come out."
                  : "While you owe debt, only collateral beyond what the loan needs can come out. The contract checks every withdrawal and rejects an unsafe one. Repay to release more."}
                precondition={position.collateralBalance === 0n ? "You have no deposited collateral." : null}
                checkAmount={(amount) => amount > position.collateralBalance ? `This is more than your deposited collateral (${formatAmount(position.collateralBalance, coll.decimals)} ${coll.symbol}).` : null}
                onSubmit={market.withdrawCollateral}
                runner={runner}
                tone="secondary"
              />
            </div>
          ) : (
            <p className="protocol-empty">{shortMarketMessage(market.state) ?? "Repayment is not available until the market and your wallet have been read."}</p>
          )}
        </Step>
      </ol>
    </div>
  );
}
