"use client";

import { useEffect, useRef, useState } from "react";
import { isAddress } from "viem";
import { projectTokenConfig } from "@/lib/config/project-token";

type CopyState = "idle" | "copied" | "failed";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ProjectTokenCa() {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configuredAddress = projectTokenConfig.address;
  const chainId = projectTokenConfig.chainId;
  const isConfigured = Boolean(
    configuredAddress &&
    chainId &&
    Number.isSafeInteger(chainId) &&
    chainId > 0 &&
    isAddress(configuredAddress) &&
    configuredAddress !== "0x0000000000000000000000000000000000000000",
  );

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copyAddress() {
    if (!isConfigured || !configuredAddress) return;
    if (resetTimer.current) clearTimeout(resetTimer.current);

    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(configuredAddress);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }

    resetTimer.current = setTimeout(() => setCopyState("idle"), 2000);
  }

  return (
    <div
      className="lp-ca"
      role="group"
      aria-label="GYEVO project token contract address"
    >
      <span className="hidden! lp-ca__label"></span>
      {isConfigured && configuredAddress && chainId ? (
        <>
          <span className="lp-ca__address" title={configuredAddress}>
            {shortAddress(configuredAddress)}
          </span>
          <span className="lp-ca__chain">CHAIN {chainId}</span>
          <button
            className="lp-ca__copy"
            type="button"
            onClick={copyAddress}
            aria-label="Copy full GYEVO project token contract address"
          >
            {copyState === "copied"
              ? "Copied!"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy"}
          </button>
          <span className="lp-sr" aria-live="polite">
            {copyState === "copied"
              ? "GYEVO contract address copied"
              : copyState === "failed"
                ? "Could not copy contract address"
                : ""}
          </span>
        </>
      ) : (
        <span className="lp-ca__pending"></span>
      )}
    </div>
  );
}
