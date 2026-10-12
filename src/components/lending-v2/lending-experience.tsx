"use client";

import { useState, type KeyboardEvent } from "react";
import { LendingWorkspace } from "@/components/lending/lending-workspace";
import { LendingV2Workspace } from "@/components/lending-v2/lending-v2-workspace";

type Mode = "v2" | "legacy";

const MODES: readonly { id: Mode; label: string; note: string }[] = [
  { id: "v2", label: "Lending V2", note: "Policy 3 · variable rates · oracle" },
  { id: "legacy", label: "Legacy demo (V1)", note: "Policy 2 · fixed price · no interest" },
];

/**
 * The page. Lending V2 is the product; the first demonstration market stays reachable as a clearly separated legacy
 * path. Only one is mounted at a time, so V1 state, proofs and transactions can never stand in for V2 ones.
 */
export function LendingExperience() {
  const [mode, setMode] = useState<Mode>("v2");

  function onKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: Mode = event.key === "Home" ? "v2" : event.key === "End" ? "legacy" : mode === "v2" ? "legacy" : "v2";
    setMode(next);
    document.getElementById(`lend-mode-${next}`)?.focus();
  }

  return (
    <div className="lend lendv2-experience">
      <div className="lendv2-modes" role="tablist" aria-label="Lending market">
        {MODES.map(({ id, label, note }) => (
          <button
            key={id}
            id={`lend-mode-${id}`}
            type="button"
            role="tab"
            className="lendv2-mode"
            aria-selected={mode === id}
            aria-controls={`lend-mode-panel-${id}`}
            tabIndex={mode === id ? 0 : -1}
            onClick={() => setMode(id)}
            onKeyDown={onKey}
          >
            <span>{label}</span>
            <small>{note}</small>
          </button>
        ))}
      </div>

      {mode === "v2" ? (
        <div role="tabpanel" id="lend-mode-panel-v2" aria-labelledby="lend-mode-v2">
          <LendingV2Workspace />
        </div>
      ) : (
        <div role="tabpanel" id="lend-mode-panel-legacy" aria-labelledby="lend-mode-legacy">
          <p className="callout callout--caution lendv2-legacy-note" role="note">
            <strong>Legacy demonstration market (V1).</strong> This is the first, separate pool: a fixed 1:1 price, zero interest, no oracle and no liquidation, with its own policy-2 credential.
            It is not Lending V2. V2 proofs, positions and transactions do not appear here, and nothing here counts toward V2.
          </p>
          <LendingWorkspace />
        </div>
      )}
    </div>
  );
}
