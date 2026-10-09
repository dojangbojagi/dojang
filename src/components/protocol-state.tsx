import type { ReactNode } from "react";

type ProtocolUiState =
  | "disconnected" | "connecting" | "connected" | "wrong-network"
  | "idle" | "checking" | "official-verified" | "no-official-credential" | "invalid" | "expired" | "revoked" | "read-error"
  | "unconfigured" | "missing" | "active"
  | "credential-required" | "ready-to-prove" | "generating" | "ready-to-submit" | "contract-unconfigured"
  | "locked" | "eligible" | "access-granted" | "previously-granted"
  | "simulating" | "awaiting-signature" | "submitted" | "confirming" | "confirmed" | "reverted" | "rejected" | "rpc-error";

const LABELS: Record<ProtocolUiState, string> = {
  disconnected: "Disconnected", connecting: "Connecting", connected: "Connected", "wrong-network": "Wrong Network",
  idle: "Not checked", checking: "Checking", "official-verified": "Official Verified", "no-official-credential": "No Official Credential",
  invalid: "Invalid", expired: "Expired", revoked: "Revoked", "read-error": "Read Error",
  unconfigured: "Contracts Not Configured", missing: "No Demo Credential", active: "Demo Credential Ready",
  "credential-required": "Credential Required", "ready-to-prove": "Ready to Prove", generating: "Generating Proof",
  "ready-to-submit": "Proof Verified Locally", "contract-unconfigured": "Vault Not Configured",
  locked: "Locked", eligible: "Eligible", "access-granted": "Access Granted", "previously-granted": "Previously Granted",
  simulating: "Simulating", "awaiting-signature": "Awaiting Signature", submitted: "Submitted", confirming: "Confirming",
  confirmed: "Confirmed", reverted: "Reverted", rejected: "Rejected", "rpc-error": "RPC Error",
};

const TONES: Record<ProtocolUiState, "valid" | "pending" | "invalid" | "warn" | "demo" | "neutral"> = {
  disconnected: "neutral", connecting: "pending", connected: "valid", "wrong-network": "warn",
  idle: "neutral", checking: "pending", "official-verified": "valid", "no-official-credential": "neutral",
  invalid: "invalid", expired: "warn", revoked: "invalid", "read-error": "invalid",
  unconfigured: "warn", missing: "neutral", active: "demo",
  "credential-required": "neutral", "ready-to-prove": "pending", generating: "pending",
  "ready-to-submit": "valid", "contract-unconfigured": "warn",
  locked: "neutral", eligible: "valid", "access-granted": "valid", "previously-granted": "valid",
  simulating: "pending", "awaiting-signature": "pending", submitted: "pending", confirming: "pending",
  confirmed: "valid", reverted: "invalid", rejected: "warn", "rpc-error": "invalid",
};

export function stateLabel(state: ProtocolUiState) {
  return LABELS[state];
}

export function StateChip({ state, children }: { state: ProtocolUiState; children?: ReactNode }) {
  return <span className="status" data-state={TONES[state]}><i className="status__dot" aria-hidden="true" />{children ?? LABELS[state]}</span>;
}

export function TransactionSummary({ lifecycle }: { lifecycle: {
  state: ProtocolUiState;
  hash?: `0x${string}`;
  explorerUrl?: string;
  error?: string;
} }) {
  return (
    <div className="protocol-transaction" aria-live="polite">
      <div className="protocol-panel__head">
        <h3>Transaction</h3>
        <StateChip state={lifecycle.state} />
      </div>
      {lifecycle.hash && lifecycle.explorerUrl && (
        <p className="protocol-copy">
          <a className="protocol-transaction__link mono" href={lifecycle.explorerUrl} target="_blank" rel="noopener noreferrer">
            {lifecycle.hash}<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </p>
      )}
      {lifecycle.error && <p className="callout callout--caution protocol-notice" role="status">{lifecycle.error}</p>}
    </div>
  );
}
