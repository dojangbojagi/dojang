"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { createPublicClient, http, type Address } from "viem";
import { inspectRobinhoodContracts, type RobinhoodCodeEvidence } from "@/lib/protocol/robinhood-chain-evidence";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";
import { robinhoodMainnetDemoChain, ROBINHOOD_MAINNET_CHAIN_ID, ROBINHOOD_MAINNET_DEMO_EXPLORER_URL } from "@/lib/config/robinhood-mainnet-demo";

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
type MainnetEvidence = { bytecode: "present" | "absent" | "unavailable"; source: "verified" | "unverified" | "unavailable" };
type MainnetLive = Partial<Record<DirectoryRow["key"], MainnetEvidence>>;

const mainnetClient = createPublicClient({ chain: robinhoodMainnetDemoChain, transport: http() });

async function mainnetSource(address: Address): Promise<MainnetEvidence["source"]> {
  try {
    const response = await fetch(`${ROBINHOOD_MAINNET_DEMO_EXPLORER_URL}/api/v2/addresses/${address}`, {
      cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return "unavailable";
    const body = await response.json() as { is_verified?: unknown };
    return body.is_verified === true ? "verified" : body.is_verified === false ? "unverified" : "unavailable";
  } catch {
    return "unavailable";
  }
}

async function inspectMainnet(rows: DirectoryRow[]): Promise<MainnetLive> {
  const correctChain = await mainnetClient.getChainId().then((id) => id === ROBINHOOD_MAINNET_CHAIN_ID, () => false);
  const entries = await Promise.all(rows.map(async (row) => {
    const address = row.address as Address;
    const [bytecode, source] = await Promise.all([
      correctChain ? mainnetClient.getBytecode({ address }).then(
        (code) => code && code !== "0x" ? "present" : "absent", () => "unavailable",
      ) : Promise.resolve("unavailable"),
      mainnetSource(address),
    ]);
    return [row.key, { bytecode, source }] as const;
  }));
  return Object.fromEntries(entries) as MainnetLive;
}

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
export function ContractDirectory({ rows, mainnetRows }: { rows: DirectoryRow[]; mainnetRows: DirectoryRow[] }) {
  const client = usePublicClient({ chainId: ROBINHOOD_TESTNET_CHAIN_ID });
  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [live, setLive] = useState<Live>({});
  const [mainnetLive, setMainnetLive] = useState<MainnetLive>({});
  const [state, setState] = useState<"checking" | "ready" | "unavailable">("checking");

  useEffect(() => {
    let current = true;
    setState("checking");
    if (network === "mainnet") {
      setMainnetLive({});
      inspectMainnet(mainnetRows).then((result) => {
        if (!current) return;
        setMainnetLive(result);
        setState("ready");
      }).catch(() => { if (current) setState("unavailable"); });
      return () => { current = false; };
    }
    setLive({});
    if (!client) {
      setState("unavailable");
      return;
    }
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
  }, [client, mainnetRows, network]);

  const selectedRows = network === "mainnet" ? mainnetRows : rows;
  const deployed = rows.filter((row) => live[row.key]?.state === "code-present").length;
  const bytecodeConfirmed = mainnetRows.filter((row) => mainnetLive[row.key]?.bytecode === "present").length;
  const verified = selectedRows.filter((row) => network === "mainnet"
    ? mainnetLive[row.key]?.source === "verified" : live[row.key]?.sourceVerification === "verified").length;
  const groups = Array.from(new Set(selectedRows.map((row) => row.group)));
  const explorer = network === "mainnet" ? ROBINHOOD_MAINNET_DEMO_EXPLORER_URL : ROBINHOOD_TESTNET_EXPLORER_URL;

  return (
    <div className="cdir">
      <div className="cdir__head">
        <h2 id="contracts-heading">Deployed contracts</h2>
        <div className="cdir__net" role="group" aria-label="Network">
          <button type="button" aria-pressed={network === "testnet"} className="cdir__net-opt" data-active={network === "testnet"} onClick={() => setNetwork("testnet")}>
            <i aria-hidden="true" />
            <span>Robinhood Testnet</span>
            <small>Chain 46630 · Active</small>
          </button>
          <button
            type="button"
            className="cdir__net-opt"
            aria-pressed={network === "mainnet"}
            data-active={network === "mainnet"}
            onClick={() => setNetwork("mainnet")}
          >
            <i aria-hidden="true" />
            <span>Robinhood Mainnet</span>
            <small>Chain 4663 · Controlled demo</small>
          </button>
        </div>
      </div>

      <dl className="cdir__stats" aria-live="polite">
        <div><dt>{network === "mainnet" ? "Deployed" : "Contracts"}</dt><dd>{network === "mainnet" ? mainnetRows.length : rows.length}</dd><small>{network === "mainnet" ? "Successful chain 4663 creation receipts" : "Robinhood Testnet"}</small></div>
        <div><dt>{network === "mainnet" ? "Bytecode confirmed" : "Deployed"}</dt><dd>{state === "ready" ? network === "mainnet" ? bytecodeConfirmed : deployed : "…"}</dd><small>{state === "checking" ? "Checking the network" : state === "unavailable" ? "Network status unavailable" : network === "mainnet" && bytecodeConfirmed < mainnetRows.length ? "RPC confirmation incomplete or unavailable" : "Code found at the address"}</small></div>
        <div><dt>Source verified</dt><dd>{state === "ready" ? `${verified}/${selectedRows.length}` : "…"}</dd><small>{state === "ready" ? "Blockscout source status checked separately" : "Checking Blockscout"}</small></div>
      </dl>

      {groups.map((group) => (
        <section className="cdir__group" key={group} aria-label={group}>
          <h3>{group}</h3>
          <ul>
            {selectedRows.filter((row) => row.group === group).map((row) => {
              const evidence = live[row.key];
              const deployedHere = evidence?.state === "code-present";
              const mainnetEvidence = mainnetLive[row.key];
              const status = network === "mainnet" ? { tone: "ok", text: "Deployed · receipt confirmed" }
                : !row.address ? { tone: "warn", text: "Address not published" }
                : row.invalid ? { tone: "bad", text: "Invalid address" }
                : state === "checking" ? { tone: "wait", text: "Checking…" }
                : evidence?.state === "code-present" ? { tone: "ok", text: "Deployed" }
                : evidence?.state === "no-code" ? { tone: "bad", text: "No contract code found" }
                : { tone: "wait", text: "Status unavailable" };
              const source = network === "mainnet"
                ? state === "checking" ? "Checking source…" : mainnetEvidence?.source === "verified" ? "Source verified"
                  : mainnetEvidence?.source === "unverified" ? "Source Not Verified" : "Source status unavailable"
                : deployedHere
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
                      {network === "mainnet" ? <span className="cdir__source">{state === "checking" ? "Checking bytecode…" : mainnetEvidence?.bytecode === "present" ? "Bytecode confirmed" : mainnetEvidence?.bytecode === "absent" ? "Bytecode absent" : "Bytecode status unavailable"}</span> : null}
                      {source ? <span className="cdir__source" data-verified={network === "mainnet" ? mainnetEvidence?.source === "verified" : evidence?.sourceVerification === "verified"}>{source}</span> : null}
                    </p>
                    {row.address && !row.invalid ? (
                      <>
                        <code className="cdir__addr">{row.address}</code>
                        <p className="cdir__actions">
                          <CopyButton value={row.address} />
                          <a href={`${explorer}/address/${row.address}`} target="_blank" rel="noopener noreferrer">
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

      {network === "mainnet" ? <p className="cdir__note"><b>Controlled Mainnet Demo.</b> These assets are synthetic and not redeemable. Lending is restricted and not production-ready. Deployment is backed by successful creation receipts; bytecode and source verification are checked independently. Public production readiness remains pending.</p> : <p className="cdir__note">
        <b>Deployed</b> means the network returned contract code at the address. <b>Source Not Verified</b> means Blockscout does not currently report published source for that contract; code presence alone is not source verification.
      </p>}
    </div>
  );
}
