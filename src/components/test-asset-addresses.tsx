"use client";

import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { robinhoodContracts } from "@/lib/config/contracts";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";

const TEST_ASSETS: readonly {
  symbol: string;
  description: string;
  address: Address | undefined;
}[] = [
  { symbol: "rUSD2", description: "Lending test token", address: robinhoodContracts.lendingV2Asset },
  { symbol: "rCOL2", description: "Collateral test token", address: robinhoodContracts.lendingV2Collateral },
];

type CopyFeedback = { symbol: string; state: "copied" | "failed" } | null;

export function TestAssetAddresses() {
  const [feedback, setFeedback] = useState<CopyFeedback>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const copyAddress = async (symbol: string, address: Address | undefined) => {
    if (!address) return;
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(null);

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(address);
      setFeedback({ symbol, state: "copied" });
    } catch {
      setFeedback({ symbol, state: "failed" });
    }

    feedbackTimer.current = setTimeout(() => setFeedback(null), 2_000);
  };

  return (
    <section className="panel app-home__test-assets" aria-labelledby="test-assets-title">
      <header className="test-assets__head">
        <div>
          <p className="eyebrow">Robinhood Testnet · chain {ROBINHOOD_TESTNET_CHAIN_ID}</p>
          <h2 id="test-assets-title">Test Asset Addresses</h2>
        </div>
        <span className="test-assets__badge">Controlled test tokens</span>
      </header>
      <p className="test-assets__note">These tokens are for testing only. They are not official GYEVO tokens or financial assets.</p>
      <ul className="test-assets__list">
        {TEST_ASSETS.map(({ symbol, description, address }) => {
          const status = feedback?.symbol === symbol ? feedback.state : undefined;
          return (
            <li className="test-assets__row" key={symbol}>
              <div className="test-assets__details">
                <div className="test-assets__name"><strong>{symbol}</strong><span>{description}</span></div>
                {address
                  ? <code className="test-assets__address" title={address}>{address}</code>
                  : <span className="test-assets__missing">Address not configured</span>}
              </div>
              <div className="test-assets__actions">
                {address && (
                  <a
                    className="protocol-inline-link test-assets__explorer"
                    href={`${ROBINHOOD_TESTNET_EXPLORER_URL}/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${symbol} test token on Robinhood Testnet Explorer`}
                  >
                    Explorer <span aria-hidden="true">↗</span>
                  </a>
                )}
                <button
                  className="btn btn--secondary btn--sm test-assets__copy"
                  type="button"
                  disabled={!address}
                  onClick={() => void copyAddress(symbol, address)}
                  aria-label={status === "copied" ? `${symbol} address copied` : `Copy full ${symbol} contract address`}
                >
                  {status === "copied" ? "Copied!" : status === "failed" ? "Copy failed" : "Copy"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <span className="visually-hidden" role="status" aria-live="polite">
        {feedback?.state === "copied" ? `${feedback.symbol} address copied.` : feedback?.state === "failed" ? `Could not copy ${feedback.symbol} address.` : ""}
      </span>
    </section>
  );
}
