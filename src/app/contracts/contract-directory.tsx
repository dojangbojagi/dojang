"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { inspectRobinhoodContracts, type RobinhoodCodeEvidence } from "@/lib/protocol/robinhood-chain-evidence";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";
import { robinhoodMainnetDemoChain, robinhoodMainnetDemoContracts, ROBINHOOD_MAINNET_CHAIN_ID, ROBINHOOD_MAINNET_DEMO_EXPLORER_URL } from "@/lib/config/robinhood-mainnet-demo";
import { robinhoodMainnetPhase2Contracts } from "@/lib/config/contracts";

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
type MainnetProtocolReadout =
  | { state: "checking" }
  | { state: "unavailable" }
  | {
      state: "ready";
      blockNumber: bigint;
      lendingPaused: boolean;
      governancePaused: boolean;
      loanSupplyIsZero: boolean;
      collateralSupplyIsZero: boolean;
      loanOracleUnseeded: boolean;
      collateralOracleUnseeded: boolean;
      dependenciesMatch: boolean;
      demoOnly: boolean;
      phase2State: "live" | "not-configured" | "unavailable";
      phase2ReputationPaused?: boolean;
      phase2GovernancePaused?: boolean;
    };

const mainnetClient = createPublicClient({ chain: robinhoodMainnetDemoChain, transport: http(undefined, { retryCount: 1, timeout: 15_000 }) });
const mainnetPoolReadAbi = parseAbi([
  "function paused() view returns (bool)",
  "function credentialRegistry() view returns (address)",
  "function eligibilityVerifier() view returns (address)",
  "function priceOracle() view returns (address)",
  "function getReserveAssets() view returns (address[])",
  "function demoOnly() pure returns (bool)",
]);
const mainnetGovernanceReadAbi = parseAbi([
  "function paused() view returns (bool)",
  "function credentialRegistry() view returns (address)",
  "function demoOnly() pure returns (bool)",
]);
const mainnetPhase2ReadAbi = parseAbi(["function paused() view returns (bool)"]);
const mainnetOracleReadAbi = parseAbi([
  "function getPriceBounds(address asset) view returns (uint128 minimumPriceWad,uint128 maximumPriceWad,uint128 priceWad,uint64 updatedAt)",
  "function demoOnly() pure returns (bool)",
]);
const mainnetTokenReadAbi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function demoOnly() pure returns (bool)",
]);

async function inspectMainnetProtocol(): Promise<MainnetProtocolReadout> {
  const chainId = await mainnetClient.getChainId();
  if (chainId !== ROBINHOOD_MAINNET_CHAIN_ID) throw new Error("Wrong Mainnet chain.");
  const addresses = robinhoodMainnetDemoContracts;
  const required = [addresses.credentialRegistry, addresses.verifierAdapter, addresses.oracle, addresses.loanToken, addresses.collateralToken, addresses.lendingPool, addresses.governance];
  if (required.some((address) => !address)) throw new Error("Mainnet registry is incomplete.");
  const blockNumber = await mainnetClient.getBlockNumber();
  const at = { blockNumber } as const;
  const [
    lendingPaused, governancePaused, poolRegistry, poolVerifier, poolOracle, governanceRegistry, reserves,
    loanSupply, collateralSupply, loanPriceBounds, collateralPriceBounds,
    poolDemoOnly, governanceDemoOnly, oracleDemoOnly, loanDemoOnly, collateralDemoOnly,
  ] = await Promise.all([
    mainnetClient.readContract({ address: addresses.lendingPool!, abi: mainnetPoolReadAbi, functionName: "paused", ...at }),
    mainnetClient.readContract({ address: addresses.governance!, abi: mainnetGovernanceReadAbi, functionName: "paused", ...at }),
    mainnetClient.readContract({ address: addresses.lendingPool!, abi: mainnetPoolReadAbi, functionName: "credentialRegistry", ...at }),
    mainnetClient.readContract({ address: addresses.lendingPool!, abi: mainnetPoolReadAbi, functionName: "eligibilityVerifier", ...at }),
    mainnetClient.readContract({ address: addresses.lendingPool!, abi: mainnetPoolReadAbi, functionName: "priceOracle", ...at }),
    mainnetClient.readContract({ address: addresses.governance!, abi: mainnetGovernanceReadAbi, functionName: "credentialRegistry", ...at }),
    mainnetClient.readContract({ address: addresses.lendingPool!, abi: mainnetPoolReadAbi, functionName: "getReserveAssets", ...at }),
    mainnetClient.readContract({ address: addresses.loanToken!, abi: mainnetTokenReadAbi, functionName: "totalSupply", ...at }),
    mainnetClient.readContract({ address: addresses.collateralToken!, abi: mainnetTokenReadAbi, functionName: "totalSupply", ...at }),
    mainnetClient.readContract({ address: addresses.oracle!, abi: mainnetOracleReadAbi, functionName: "getPriceBounds", args: [addresses.loanToken!], ...at }),
    mainnetClient.readContract({ address: addresses.oracle!, abi: mainnetOracleReadAbi, functionName: "getPriceBounds", args: [addresses.collateralToken!], ...at }),
    mainnetClient.readContract({ address: addresses.lendingPool!, abi: mainnetPoolReadAbi, functionName: "demoOnly", ...at }),
    mainnetClient.readContract({ address: addresses.governance!, abi: mainnetGovernanceReadAbi, functionName: "demoOnly", ...at }),
    mainnetClient.readContract({ address: addresses.oracle!, abi: mainnetOracleReadAbi, functionName: "demoOnly", ...at }),
    mainnetClient.readContract({ address: addresses.loanToken!, abi: mainnetTokenReadAbi, functionName: "demoOnly", ...at }),
    mainnetClient.readContract({ address: addresses.collateralToken!, abi: mainnetTokenReadAbi, functionName: "demoOnly", ...at }),
  ]);
  const phase2Addresses = [robinhoodMainnetPhase2Contracts.reputationRegistry, robinhoodMainnetPhase2Contracts.governance];
  let phase2State: "live" | "not-configured" | "unavailable" = "not-configured";
  let phase2ReputationPaused: boolean | undefined;
  let phase2GovernancePaused: boolean | undefined;
  if (phase2Addresses.every(Boolean)) {
    try {
      const [reputationCode, governanceCode] = await Promise.all(phase2Addresses.map((address) =>
        mainnetClient.getBytecode({ address: address!, blockNumber }),
      ));
      if (reputationCode && reputationCode !== "0x" && governanceCode && governanceCode !== "0x") {
        [phase2ReputationPaused, phase2GovernancePaused] = await Promise.all([
          mainnetClient.readContract({ address: phase2Addresses[0]!, abi: mainnetPhase2ReadAbi, functionName: "paused", blockNumber }),
          mainnetClient.readContract({ address: phase2Addresses[1]!, abi: mainnetPhase2ReadAbi, functionName: "paused", blockNumber }),
        ]);
        phase2State = "live";
      } else {
        phase2State = "unavailable";
      }
    } catch {
      phase2State = "unavailable";
    }
  }
  const same = (left: string, right?: string) => Boolean(right && left.toLowerCase() === right.toLowerCase());
  const reserveSet = new Set(reserves.map((address) => address.toLowerCase()));
  return {
    state: "ready",
    blockNumber,
    lendingPaused,
    governancePaused,
    loanSupplyIsZero: loanSupply === 0n,
    collateralSupplyIsZero: collateralSupply === 0n,
    loanOracleUnseeded: loanPriceBounds[2] === 0n && loanPriceBounds[3] === 0n,
    collateralOracleUnseeded: collateralPriceBounds[2] === 0n && collateralPriceBounds[3] === 0n,
    dependenciesMatch: same(poolRegistry, addresses.credentialRegistry) && same(poolVerifier, addresses.verifierAdapter) &&
      same(poolOracle, addresses.oracle) && same(governanceRegistry, addresses.credentialRegistry) &&
      reserveSet.has(addresses.loanToken!.toLowerCase()) && reserveSet.has(addresses.collateralToken!.toLowerCase()),
    demoOnly: poolDemoOnly && governanceDemoOnly && oracleDemoOnly && loanDemoOnly && collateralDemoOnly,
    phase2State,
    phase2ReputationPaused,
    phase2GovernancePaused,
  };
}

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
    if (!row.address || row.invalid) {
      return [row.key, { bytecode: "unavailable", source: "unavailable" }] as const;
    }
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

/* Testnet deployment is read from RPC. Mainnet creation receipts are recorded in the address registry;
   runtime bytecode and explorer source status are checked independently without assuming either result. */
export function ContractDirectory({ rows, mainnetRows }: { rows: DirectoryRow[]; mainnetRows: DirectoryRow[] }) {
  const client = usePublicClient({ chainId: ROBINHOOD_TESTNET_CHAIN_ID });
  const [network, setNetwork] = useState<"testnet" | "mainnet">("mainnet");
  const [live, setLive] = useState<Live>({});
  const [mainnetLive, setMainnetLive] = useState<MainnetLive>({});
  const [mainnetProtocol, setMainnetProtocol] = useState<MainnetProtocolReadout>({ state: "checking" });
  const [state, setState] = useState<"checking" | "ready" | "unavailable">("checking");

  useEffect(() => {
    let current = true;
    setState("checking");
    if (network === "mainnet") {
      setMainnetLive({});
      setMainnetProtocol({ state: "checking" });
      inspectMainnet(mainnetRows).then((result) => {
        if (!current) return;
        setMainnetLive(result);
        setState("ready");
      }).catch(() => { if (current) setState("unavailable"); });
      inspectMainnetProtocol().then((result) => {
        if (current) setMainnetProtocol(result);
      }).catch(() => {
        if (current) setMainnetProtocol({ state: "unavailable" });
      });
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
  const mainnetConfiguredRows = mainnetRows.filter((row) => Boolean(row.address) && !row.invalid);
  const sourceRows = network === "mainnet" ? mainnetConfiguredRows : selectedRows;
  const deployed = rows.filter((row) => live[row.key]?.state === "code-present").length;
  const bytecodeConfirmed = mainnetConfiguredRows.filter((row) => mainnetLive[row.key]?.bytecode === "present").length;
  const verified = sourceRows.filter((row) => network === "mainnet"
    ? mainnetLive[row.key]?.source === "verified" : live[row.key]?.sourceVerification === "verified").length;
  const unavailableSources = mainnetConfiguredRows.filter((row) => mainnetLive[row.key]?.source === "unavailable").length;
  const allSourcesUnavailable = network === "mainnet" && mainnetConfiguredRows.length > 0 && unavailableSources === mainnetConfiguredRows.length;
  const groups = Array.from(new Set(selectedRows.map((row) => row.group)));
  const explorer = network === "mainnet" ? ROBINHOOD_MAINNET_DEMO_EXPLORER_URL : ROBINHOOD_TESTNET_EXPLORER_URL;

  return (
    <div className="cdir">
      <div className="cdir__head">
        <h2 id="contracts-heading">Deployed contracts</h2>
        <div className="cdir__net" role="group" aria-label="Network">
          <button type="button" aria-label={`Robinhood Testnet — Interactive, chain ${ROBINHOOD_TESTNET_CHAIN_ID}`} aria-pressed={network === "testnet"} className="cdir__net-opt" data-active={network === "testnet"} onClick={() => setNetwork("testnet")}>
            <i aria-hidden="true" />
            <span>Robinhood Testnet</span>
            <small>Interactive · Chain {ROBINHOOD_TESTNET_CHAIN_ID}</small>
          </button>
          <button
            type="button"
            aria-label={`Robinhood Mainnet — Deployed, chain ${ROBINHOOD_MAINNET_CHAIN_ID}`}
            className="cdir__net-opt"
            aria-pressed={network === "mainnet"}
            data-active={network === "mainnet"}
            onClick={() => setNetwork("mainnet")}
          >
            <i aria-hidden="true" />
            <span>Robinhood Mainnet</span>
            <small>Deployed · Chain {ROBINHOOD_MAINNET_CHAIN_ID}</small>
          </button>
        </div>
      </div>

      {network === "mainnet" && (
        <section aria-labelledby="mainnet-protocol-state-heading">
          <h3 id="mainnet-protocol-state-heading">Live Mainnet protocol state</h3>
          {mainnetProtocol.state === "checking" && <p className="cdir__note" role="status">Checking chain 4663 pause state, demo reserves, token supplies, oracle initialization, and contract dependencies.</p>}
          {mainnetProtocol.state === "unavailable" && <p className="callout callout--caution" role="status">Live Mainnet protocol state is unavailable. No current pause, supply, or oracle status is inferred from recorded deployment receipts.</p>}
          {mainnetProtocol.state === "ready" && (
            <>
              <dl className="cdir__stats" aria-live="polite">
                <div><dt>Lending V2 risk</dt><dd>{mainnetProtocol.lendingPaused ? "Paused" : "Unpaused"}</dd><small>Live read at block {mainnetProtocol.blockNumber.toString()}</small></div>
                <div><dt>Phase 1 governance</dt><dd>{mainnetProtocol.governancePaused ? "Paused" : "Unpaused"}</dd><small>Live contract state</small></div>
                <div><dt>Phase 2 governance</dt><dd>{mainnetProtocol.phase2State === "live" ? mainnetProtocol.phase2GovernancePaused ? "Paused" : "Unpaused" : mainnetProtocol.phase2State === "not-configured" ? "Not configured" : "Live read unavailable"}</dd><small>{mainnetProtocol.phase2State === "live" ? "Live contract state" : mainnetProtocol.phase2State === "not-configured" ? "Build-time Phase 2 address variables are required" : "Phase 2 code or state could not be read"}</small></div>
                <div><dt>Phase 2 reputation</dt><dd>{mainnetProtocol.phase2State === "live" ? mainnetProtocol.phase2ReputationPaused ? "Paused" : "Active" : mainnetProtocol.phase2State === "not-configured" ? "Not configured" : "Live read unavailable"}</dd><small>{mainnetProtocol.phase2State === "live" ? "Live contract state" : mainnetProtocol.phase2State === "not-configured" ? "Build-time Phase 2 address variables are required" : "Phase 2 code or state could not be read"}</small></div>
                <div><dt>Demo token supply</dt><dd>{mainnetProtocol.loanSupplyIsZero && mainnetProtocol.collateralSupplyIsZero ? "Zero" : "Nonzero"}</dd><small>Both deployed token contracts</small></div>
                <div><dt>Synthetic oracle</dt><dd>{mainnetProtocol.loanOracleUnseeded && mainnetProtocol.collateralOracleUnseeded ? "Unseeded" : "Seeded"}</dd><small>Not a market price feed</small></div>
                <div><dt>Dependencies</dt><dd>{mainnetProtocol.dependenciesMatch ? "Match" : "Mismatch"}</dd><small>Registry, verifier, oracle, and two reserves</small></div>
                <div><dt>Demo-only markers</dt><dd>{mainnetProtocol.demoOnly ? "Confirmed" : "Mismatch"}</dd><small>Pool, DAO, oracle, and both tokens</small></div>
              </dl>
              <p className="cdir__note">Read-only state from Robinhood Mainnet RPC. This app does not expose Mainnet write or activation controls.</p>
            </>
          )}
        </section>
      )}

      <dl className="cdir__stats" aria-live="polite">
        <div><dt>{network === "mainnet" ? "Configured addresses" : "Contracts"}</dt><dd>{network === "mainnet" ? mainnetConfiguredRows.length : rows.length}</dd><small>{network === "mainnet" ? "Receipt-derived Mainnet registry; checked separately from live code" : "Robinhood Testnet"}</small></div>
        <div><dt>{network === "mainnet" ? "Bytecode confirmed" : "Deployed"}</dt><dd>{state === "ready" ? network === "mainnet" ? bytecodeConfirmed : deployed : "…"}</dd><small>{state === "checking" ? "Checking the network" : state === "unavailable" ? "Network status unavailable" : network === "mainnet" && bytecodeConfirmed < mainnetConfiguredRows.length ? "RPC confirmation incomplete or unavailable" : "Code found at the address"}</small></div>
        <div><dt>Source verified</dt><dd>{state !== "ready" ? "…" : sourceRows.length === 0 ? "Not configured" : allSourcesUnavailable ? "Unavailable" : `${verified}/${sourceRows.length}`}</dd><small>{state !== "ready" ? "Checking Blockscout" : sourceRows.length === 0 ? "No configured addresses to check" : allSourcesUnavailable ? "Blockscout status unavailable" : network === "mainnet" && unavailableSources ? "Some Blockscout checks unavailable" : "Blockscout source status checked"}</small></div>
      </dl>

      {groups.map((group) => (
        <section className="cdir__group" key={group} aria-label={group}>
          <h3>{group}</h3>
          <ul>
            {selectedRows.filter((row) => row.group === group).map((row) => {
              const evidence = live[row.key];
              const deployedHere = evidence?.state === "code-present";
              const mainnetEvidence = mainnetLive[row.key];
              const status = network === "mainnet" ? !row.address ? { tone: "warn", text: "Address not configured" } : { tone: "ok", text: "Deployment address recorded" }
                : !row.address ? { tone: "warn", text: "Address not published" }
                : row.invalid ? { tone: "bad", text: "Invalid address" }
                : state === "checking" ? { tone: "wait", text: "Checking…" }
                : evidence?.state === "code-present" ? { tone: "ok", text: "Deployed" }
                : evidence?.state === "no-code" ? { tone: "bad", text: "No contract code found" }
                : { tone: "wait", text: "Status unavailable" };
              const source = network === "mainnet"
                ? !row.address ? "Not configured" : state === "checking" ? "Checking source…" : mainnetEvidence?.source === "verified" ? "Source verified"
                  : mainnetEvidence?.source === "unverified" ? "Source Not Verified" : "Source Status Unavailable"
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
                      {network === "mainnet" ? <span className="cdir__source">{!row.address ? "Bytecode not checked: address not configured" : state === "checking" ? "Checking bytecode…" : mainnetEvidence?.bytecode === "present" ? "Bytecode confirmed" : mainnetEvidence?.bytecode === "absent" ? "Bytecode absent" : "Bytecode status unavailable"}</span> : null}
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

      {network === "mainnet" ? <p className="cdir__note"><b>Mainnet status.</b> Lending assets are synthetic and have no redemption value. The live pause, supply, oracle, and dependency reads above are distinct from recorded deployment receipts, live bytecode, and Blockscout source status. Public production readiness remains pending.</p> : <p className="cdir__note">
        <b>Deployed</b> means the network returned contract code at the address. <b>Source Not Verified</b> means Blockscout does not currently report published source for that contract; code presence alone is not source verification.
      </p>}
    </div>
  );
}
