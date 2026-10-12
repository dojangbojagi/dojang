"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { inspectRobinhoodContracts, type RobinhoodCodeEvidence } from "@/lib/protocol/robinhood-chain-evidence";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";

export type DirectoryRow = {
  key: RobinhoodCodeEvidence["name"];
  group: string;
  name: string;
  tech: string;
  purpose: string;
  address?: string;
  invalid?: boolean;
};

type Live = Partial<Record<DirectoryRow["key"], RobinhoodCodeEvidence>>;

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="cdir__copy"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        });
      }}
      aria-label={done ? "Address copied" : "Copy address"}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/* The contract list, written for a visitor: a name, what it is for, where it lives and whether it is there.
   Deployment is read live from the Robinhood RPC; source publication is read from the explorer. Neither is
   assumed: while a check is running, or if it fails, the row says so instead of guessing. */
export function ContractDirectory({ rows }: { rows: DirectoryRow[] }) {
  const client = usePublicClient({ chainId: ROBINHOOD_TESTNET_CHAIN_ID });
  const [live, setLive] = useState<Live>({});
  const [state, setState] = useState<"checking" | "ready" | "unavailable">("checking");

  useEffect(() => {
    if (!client) {
      setState("unavailable");
      return;
    }
    let current = true;
    setState("checking");
    inspectRobinhoodContracts(client)
      .then((result) => {
        if (!current) return;
        setLive(Object.fromEntries(result.map((item) => [item.name, item])) as Live);
        setState("ready");
      })
      .catch(() => {
        if (current) setState("unavailable");
      });
    return () => { current = false; };
  }, [client]);

  const deployed = rows.filter((row) => live[row.key]?.state === "code-present").length;
  const verified = rows.filter((row) => live[row.key]?.sourceVerification === "verified").length;
  const groups = Array.from(new Set(rows.map((row) => row.group)));

  return (
    <div className="cdir">
      <div className="cdir__head">
        <h2 id="contracts-heading">Deployed contracts</h2>
        <div className="cdir__net" role="group" aria-label="Network">
          <button type="button" aria-pressed="true" className="cdir__net-opt" data-active="true">
            <i aria-hidden="true" />
            <span>Robinhood Testnet</span>
            <small>Chain 46630 · Active</small>
          </button>
          <button
            type="button"
            className="cdir__net-opt"
            disabled
            aria-disabled="true"
            title="Robinhood Mainnet has not launched. No contracts are deployed on it."
          >
            <i aria-hidden="true" />
            <span>Robinhood Mainnet</span>
            <small>Chain 4663 · Not launched</small>
          </button>
        </div>
      </div>

      <dl className="cdir__stats" aria-live="polite">
        <div><dt>Contracts</dt><dd>{rows.length}</dd></div>
        <div><dt>Deployed</dt><dd>{state === "ready" ? deployed : "…"}</dd><small>{state === "checking" ? "Checking the network" : state === "unavailable" ? "Network status unavailable" : "Code found at the address"}</small></div>
        <div><dt>Source verified</dt><dd>{state === "ready" ? verified : "…"}</dd><small>{state === "ready" && verified === 0 ? "Not yet published on the explorer" : "Published on the explorer"}</small></div>
      </dl>

      {groups.map((group) => (
        <section className="cdir__group" key={group} aria-label={group}>
          <h3>{group}</h3>
          <ul>
            {rows.filter((row) => row.group === group).map((row) => {
              const evidence = live[row.key];
              const deployedHere = evidence?.state === "code-present";
              const status = !row.address ? { tone: "warn", text: "Address not published" }
                : row.invalid ? { tone: "bad", text: "Invalid address" }
                : state === "checking" ? { tone: "wait", text: "Checking…" }
                : evidence?.state === "code-present" ? { tone: "ok", text: "Deployed" }
                : evidence?.state === "no-code" ? { tone: "bad", text: "No contract code found" }
                : { tone: "wait", text: "Status unavailable" };
              const source = deployedHere
                ? evidence?.sourceVerification === "verified" ? "Source verified"
                  : evidence?.sourceVerification === "unverified" ? "Source Not Verified"
                  : "Source status unavailable"
                : null;
              return (
                <li className="cdir__row" key={row.key}>
                  <div className="cdir__what">
                    <strong>{row.name}</strong>
                    <span className="cdir__tech">{row.tech}</span>
                    <p>{row.purpose}</p>
                  </div>
                  <div className="cdir__where">
                    <p className="cdir__status">
                      <span className="cdir__state" data-tone={status.tone}><i aria-hidden="true" />{status.text}</span>
                      {source ? <span className="cdir__source" data-verified={evidence?.sourceVerification === "verified" ? "true" : "false"}>{source}</span> : null}
                    </p>
                    {row.address && !row.invalid ? (
                      <>
                        <code className="cdir__addr">{row.address}</code>
                        <p className="cdir__actions">
                          <CopyButton value={row.address} />
                          <a href={`${ROBINHOOD_TESTNET_EXPLORER_URL}/address/${row.address}`} target="_blank" rel="noopener noreferrer">
                            View on Explorer<span className="visually-hidden"> (opens in a new tab)</span>
                          </a>
                        </p>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="cdir__note">
        <b>Deployed</b> means the network returned contract code at the address. <b>Source Not Verified</b> means the source code has not been
        published on the explorer yet; it does not change whether the contract exists.
      </p>
    </div>
  );
}
