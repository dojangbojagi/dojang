"use client";

import { useCallback, useEffect, useState } from "react";
import { decodeEventLog, formatUnits, type Address, type Hex, type PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { credentialIssuerRoleAbi, credentialRegistryAbi, controlledTestOracleAbi, lendingPoolV2Abi, robinhoodGovernanceAbi, controlledTokenAbi } from "@/lib/contracts/abis";
import { robinhoodContracts } from "@/lib/config/contracts";
import { ROBINHOOD_TESTNET_CHAIN_ID, ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";
import { readRobinhoodTransactionEvidence, type RobinhoodTransactionEvidence } from "@/lib/protocol/robinhood-chain-evidence";

const WALLET_A = "0x4C488dfa668A7643C4046a1952734eF875Af0d62" as Address;
const WALLET_B = "0xBE390374Ac7304A792c50EA37AB301b659a56Df7" as Address;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const USD_UNIT = 10n ** 6n;
const COLLATERAL_UNIT = 10n ** 18n;

type DemoReceipt = {
  id: string;
  group: "DAO" | "Lending V2";
  action: string;
  wallet: string;
  detail: string;
  contract: "governance" | "lendingV2Pool";
  eventName: string;
  hash: `0x${string}`;
  check: (args: Record<string, unknown>) => boolean;
};

const sameAddress = (left: unknown, right: Address) => typeof left === "string" && left.toLowerCase() === right.toLowerCase();
const asBigInt = (value: unknown) => typeof value === "bigint" ? value : typeof value === "number" ? BigInt(value) : undefined;

const RECEIPTS: DemoReceipt[] = [
  { id: "proposal", group: "DAO", action: "Proposal 1 created", wallet: "Wallet A", detail: "Policy 4 · minimum validity proposal", contract: "governance", eventName: "ProposalCreated", hash: "0x3bf437acbc75e6d8ff3363023ef571902263b47acae6342002c91e35aec4de09", check: (a) => asBigInt(a.proposalId) === 1n },
  { id: "vote-a", group: "DAO", action: "Wallet A voted For", wallet: "Wallet A", detail: "Proposal 1", contract: "governance", eventName: "VoteCast", hash: "0x9274914c40b45ef6d775119844046c81d8a89dc1e0509c39613febb81cb86a91", check: (a) => asBigInt(a.proposalId) === 1n && sameAddress(a.voter, WALLET_A) && asBigInt(a.voteType) === 1n },
  { id: "vote-b", group: "DAO", action: "Wallet B voted For", wallet: "Wallet B", detail: "Proposal 1", contract: "governance", eventName: "VoteCast", hash: "0xa0cf87e60b0afdf3ec5439ce5855401b95a8179b8572fa3dfc639c8f73a328c5", check: (a) => asBigInt(a.proposalId) === 1n && sameAddress(a.voter, WALLET_B) && asBigInt(a.voteType) === 1n },
  { id: "finalize", group: "DAO", action: "Proposal 1 finalized", wallet: "Public transaction", detail: "2 For · 0 Against · 0 Abstain", contract: "governance", eventName: "ProposalFinalized", hash: "0xd19e13a0c3e64cd3f3a62d8f2a57d6ebed54edbeb81e0a6ef23ef34e9426719d", check: (a) => asBigInt(a.proposalId) === 1n && a.approved === true && asBigInt(a.forVotes) === 2n && asBigInt(a.againstVotes) === 0n && asBigInt(a.abstainVotes) === 0n },
  { id: "execute", group: "DAO", action: "Proposal 1 executed", wallet: "Public transaction", detail: "Minimum remaining credential validity set to 3,600 seconds", contract: "governance", eventName: "ProposalExecuted", hash: "0x7e41f98e2357d342186dbcd384435b9141ffdcf67c867fa0f5a16eb9aa18cdc4", check: (a) => asBigInt(a.proposalId) === 1n && asBigInt(a.minimumRemainingValidity) === 3_600n },
  { id: "supply", group: "Lending V2", action: "Wallet A supplied 100 rUSD2", wallet: "Wallet A", detail: "Historical supply · test asset", contract: "lendingV2Pool", eventName: "LiquiditySupplied", hash: "0xdd107fabe2db697818a8f501450ba81ecaddfdaf00ef9a705c02a957fc998fff", check: (a) => sameAddress(a.asset, robinhoodContracts.lendingV2Asset!) && sameAddress(a.supplier, WALLET_A) && asBigInt(a.amount) === 100n * USD_UNIT },
  { id: "collateral", group: "Lending V2", action: "Wallet B deposited 10 rCOL2", wallet: "Wallet B", detail: "Historical collateral deposit · test asset", contract: "lendingV2Pool", eventName: "CollateralDeposited", hash: "0x8330535f41c68095ffae99573b61504e3515ae30d5d862d6dea57071e01069e6", check: (a) => sameAddress(a.asset, robinhoodContracts.lendingV2Collateral!) && sameAddress(a.user, WALLET_B) && asBigInt(a.amount) === 10n * COLLATERAL_UNIT },
  { id: "collateral-enabled", group: "Lending V2", action: "Wallet B enabled collateral use", wallet: "Wallet B", detail: "Historical collateral setting", contract: "lendingV2Pool", eventName: "CollateralUseChanged", hash: "0xa585292c68f2951d5a1e37799e4e05bf7791e00c10b83496b7ae31610394a7ed", check: (a) => sameAddress(a.asset, robinhoodContracts.lendingV2Collateral!) && sameAddress(a.user, WALLET_B) && a.enabled === true },
  { id: "borrow", group: "Lending V2", action: "Wallet B borrowed 3 rUSD2", wallet: "Wallet B", detail: "Historical borrowing · test asset", contract: "lendingV2Pool", eventName: "Borrowed", hash: "0xc4752f4e368a88ccf00c9498c47990258fb85aa3fd69a3650eebed3fea4466cf", check: (a) => sameAddress(a.asset, robinhoodContracts.lendingV2Asset!) && sameAddress(a.borrower, WALLET_B) && asBigInt(a.amount) === 3n * USD_UNIT },
  { id: "repay", group: "Lending V2", action: "Wallet B repaid the accrued debt", wallet: "Wallet B", detail: "Historical repayment · event records zero debt remaining", contract: "lendingV2Pool", eventName: "Repaid", hash: "0xd27bf0979f18fd5b4b1e98fd0af8138174499af78b32c510beb5fa17fbfee21e", check: (a) => sameAddress(a.asset, robinhoodContracts.lendingV2Asset!) && sameAddress(a.borrower, WALLET_B) && asBigInt(a.debtBalance) === 0n },
  { id: "withdraw-collateral", group: "Lending V2", action: "Wallet B withdrew 10 rCOL2", wallet: "Wallet B", detail: "Historical withdrawal · no collateral remains", contract: "lendingV2Pool", eventName: "CollateralWithdrawn", hash: "0xbf6d246e6f756307b00a5e5635b2eda2e17dbf36b219e4801b561de910b3839a", check: (a) => sameAddress(a.asset, robinhoodContracts.lendingV2Collateral!) && sameAddress(a.user, WALLET_B) && asBigInt(a.amount) === 10n * COLLATERAL_UNIT && asBigInt(a.balance) === 0n },
  { id: "withdraw-supply", group: "Lending V2", action: "Wallet A withdrew 100 rUSD2", wallet: "Wallet A", detail: "Historical supply withdrawal · no supply remains", contract: "lendingV2Pool", eventName: "LiquidityWithdrawn", hash: "0x25ec05bed3b26110ec21aefa35a516342905b83c4c2973f42b3d9afd7b90b299", check: (a) => sameAddress(a.asset, robinhoodContracts.lendingV2Asset!) && sameAddress(a.supplier, WALLET_A) && asBigInt(a.amount) === 100n * USD_UNIT },
];

type ReceiptResult = { state: "checking" | "verified" | "unavailable" | "mismatch"; block?: bigint; evidence?: RobinhoodTransactionEvidence };
type GroupResult<T> = { state: "ready"; value: T } | { state: "unavailable"; message: string };
type CredentialLine = { wallet: string; policy: number; status: string };
type PositionLine = { wallet: string; asset: string; supplied: string; collateral: string; debt: string; collateralEnabled: boolean };
type PriceLine = { asset: string; price: string; age: string; fresh: boolean };
type Snapshot = {
  dao: GroupResult<{ state: string; minimumValidity: bigint; votes: readonly [bigint, bigint, bigint] }>;
  credentials: GroupResult<CredentialLine[]>;
  positions: GroupResult<PositionLine[]>;
  prices: GroupResult<PriceLine[]>;
  blockNumber: bigint;
};

function recordFields(value: unknown, names: readonly string[]): Record<string, unknown> {
  if (Array.isArray(value)) {
    if (value.length === 1 && value[0] && typeof value[0] === "object") return recordFields(value[0], names);
    return Object.fromEntries(names.map((name, index) => [name, value[index]]));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const wrapper of ["credential", "config"]) {
      if (record[wrapper] && typeof record[wrapper] === "object") return recordFields(record[wrapper], names);
    }
    return record;
  }
  return {};
}

function receiptMatches(item: DemoReceipt, evidence: RobinhoodTransactionEvidence): boolean {
  if (evidence.status !== "success" || evidence.chainId !== ROBINHOOD_TESTNET_CHAIN_ID) return false;
  const expectedAddress = robinhoodContracts[item.contract];
  if (!expectedAddress) return false;
  const matching = evidence.projectEvents.filter((event) => event.eventName === item.eventName && event.address.toLowerCase() === expectedAddress.toLowerCase());
  const abi = item.contract === "governance" ? robinhoodGovernanceAbi : lendingPoolV2Abi;
  return matching.some((event) => {
    try {
      const decoded = decodeEventLog({ abi, topics: event.topics as [Hex, ...Hex[]], data: event.data, strict: false });
      return item.check(decoded.args as Record<string, unknown>);
    } catch {
      return false;
    }
  });
}

async function readSnapshot(client: PublicClient): Promise<Snapshot> {
  const block = await client.getBlock();
  const blockTimestamp = block.timestamp;
  const unavailable = (message: string) => ({ state: "unavailable", message } as const);
  const [daoResult, credentialResult, positionResult, priceResult] = await Promise.all([
    (async (): Promise<GroupResult<Snapshot["dao"] extends GroupResult<infer T> ? T : never>> => {
      try {
        if (!robinhoodContracts.governance) throw new Error("The GYEVO governance address is not configured.");
        const [state, minimumValidity, votes] = await Promise.all([
          client.readContract({ address: robinhoodContracts.governance, abi: robinhoodGovernanceAbi, functionName: "proposalState", args: [1n] }),
          client.readContract({ address: robinhoodContracts.governance, abi: robinhoodGovernanceAbi, functionName: "minimumRemainingValidity" }),
          client.readContract({ address: robinhoodContracts.governance, abi: robinhoodGovernanceAbi, functionName: "proposalVoteCounts", args: [1n] }),
        ]);
        const voteParts = recordFields(votes, ["forVotes", "againstVotes", "abstainVotes"]);
        const states = ["None", "Pending", "Active", "Approved", "Rejected", "Expired", "Executed"];
        return { state: "ready", value: { state: states[Number(state)] ?? "Unknown", minimumValidity, votes: [asBigInt(voteParts.forVotes) ?? 0n, asBigInt(voteParts.againstVotes) ?? 0n, asBigInt(voteParts.abstainVotes) ?? 0n] } };
      } catch (error) { return unavailable(error instanceof Error ? error.message : "Governance read failed."); }
    })(),
    (async (): Promise<GroupResult<CredentialLine[]>> => {
      try {
        if (!robinhoodContracts.credentialRegistry) throw new Error("The project credential registry is not configured.");
        const [issuerRole, records] = await Promise.all([
          client.readContract({ address: robinhoodContracts.credentialRegistry, abi: credentialIssuerRoleAbi, functionName: "ISSUER_ROLE" }),
          Promise.all([WALLET_A, WALLET_B].flatMap((wallet) => [3n, 4n].map(async (policy) => ({ wallet, policy: Number(policy), value: await client.readContract({ address: robinhoodContracts.credentialRegistry!, abi: credentialRegistryAbi, functionName: "getCredential", args: [wallet, policy] }) })))),
        ]);
        const lines = records.map(({ wallet, policy, value }) => {
          const fields = recordFields(value, ["wallet", "commitment", "issuer", "issuedAt", "expiresAt", "version", "revoked"]);
          const issuedAt = asBigInt(fields.issuedAt) ?? 0n;
          const expiresAt = asBigInt(fields.expiresAt) ?? 0n;
          return { wallet, policy, fields, issuedAt, expiresAt };
        });
        const currentLines = await Promise.all(lines.map(async ({ wallet, policy, fields, issuedAt, expiresAt }) => {
          const noRecord = !fields.wallet || String(fields.wallet).toLowerCase() === ZERO_ADDRESS.toLowerCase() || issuedAt === 0n;
          let status = noRecord ? "No credential on record"
            : fields.revoked === true ? "Revoked"
              : expiresAt !== 0n && expiresAt <= blockTimestamp ? "Expired"
                : "Active on-chain";
          if (!noRecord && fields.revoked !== true && (expiresAt === 0n || expiresAt > blockTimestamp) && typeof fields.issuer === "string") {
            const trusted = await client.readContract({ address: robinhoodContracts.credentialRegistry!, abi: credentialIssuerRoleAbi, functionName: "hasRole", args: [issuerRole, fields.issuer as Address] });
            status = trusted ? "Active · issuer authorized" : "Issuer no longer authorized";
          }
          return { wallet: wallet === WALLET_A ? "Wallet A" : "Wallet B", policy, status };
        }));
        return { state: "ready", value: currentLines };
      } catch (error) { return unavailable(error instanceof Error ? error.message : "Credential read failed."); }
    })(),
    (async (): Promise<GroupResult<PositionLine[]>> => {
      try {
        if (!robinhoodContracts.lendingV2Pool || !robinhoodContracts.lendingV2Asset || !robinhoodContracts.lendingV2Collateral) throw new Error("The Lending V2 addresses are not configured.");
        const [usdDecimals, collateralDecimals] = await Promise.all([
          client.readContract({ address: robinhoodContracts.lendingV2Asset, abi: controlledTokenAbi, functionName: "decimals" }),
          client.readContract({ address: robinhoodContracts.lendingV2Collateral, abi: controlledTokenAbi, functionName: "decimals" }),
        ]);
        const pairs = [
          { wallet: WALLET_A, walletLabel: "Wallet A", asset: robinhoodContracts.lendingV2Asset, assetLabel: "rUSD2", decimals: usdDecimals },
          { wallet: WALLET_A, walletLabel: "Wallet A", asset: robinhoodContracts.lendingV2Collateral, assetLabel: "rCOL2", decimals: collateralDecimals },
          { wallet: WALLET_B, walletLabel: "Wallet B", asset: robinhoodContracts.lendingV2Asset, assetLabel: "rUSD2", decimals: usdDecimals },
          { wallet: WALLET_B, walletLabel: "Wallet B", asset: robinhoodContracts.lendingV2Collateral, assetLabel: "rCOL2", decimals: collateralDecimals },
        ];
        const positions = await Promise.all(pairs.map(async (pair) => {
          const value = await client.readContract({ address: robinhoodContracts.lendingV2Pool!, abi: lendingPoolV2Abi, functionName: "getPosition", args: [pair.wallet, pair.asset!] });
          const fields = recordFields(value, ["supplied", "collateral", "debt", "isCollateralEnabled"]);
          return { wallet: pair.walletLabel, asset: pair.assetLabel, supplied: formatUnits(asBigInt(fields.supplied) ?? 0n, pair.decimals), collateral: formatUnits(asBigInt(fields.collateral) ?? 0n, pair.decimals), debt: formatUnits(asBigInt(fields.debt) ?? 0n, pair.decimals), collateralEnabled: fields.isCollateralEnabled === true };
        }));
        return { state: "ready", value: positions };
      } catch (error) { return unavailable(error instanceof Error ? error.message : "Position read failed."); }
    })(),
    (async (): Promise<GroupResult<PriceLine[]>> => {
      try {
        if (!robinhoodContracts.lendingV2Pool || !robinhoodContracts.lendingV2Oracle || !robinhoodContracts.lendingV2Asset || !robinhoodContracts.lendingV2Collateral) throw new Error("The Lending V2 oracle addresses are not configured.");
        const assets = [
          { address: robinhoodContracts.lendingV2Asset, asset: "rUSD2" },
          { address: robinhoodContracts.lendingV2Collateral, asset: "rCOL2" },
        ];
        const lines = await Promise.all(assets.map(async ({ address, asset }) => {
          const [priceValue, configValue] = await Promise.all([
            client.readContract({ address: robinhoodContracts.lendingV2Oracle!, abi: controlledTestOracleAbi, functionName: "getPrice", args: [address] }),
            client.readContract({ address: robinhoodContracts.lendingV2Pool!, abi: lendingPoolV2Abi, functionName: "getReserveConfig", args: [address] }),
          ]);
          const [price, updatedAt] = recordFields(priceValue, ["priceWad", "updatedAt"]).priceWad !== undefined
            ? [recordFields(priceValue, ["priceWad", "updatedAt"]).priceWad, recordFields(priceValue, ["priceWad", "updatedAt"]).updatedAt]
            : Array.isArray(priceValue) ? priceValue : [undefined, undefined];
          const config = recordFields(configValue, ["supplyCap","borrowCap","collateralCap","minBorrowAmount","maxOracleAge","maxLtvBps","liquidationThresholdBps","liquidationBonusBps","closeFactorBps","reserveFactorBps","optimalUtilizationBps","baseBorrowRateBps","slope1Bps","slope2Bps","active","supplyEnabled","borrowEnabled","collateralEnabled"]);
          const timestamp = asBigInt(updatedAt) ?? 0n;
          const maxAge = asBigInt(config.maxOracleAge) ?? 0n;
          const age = blockTimestamp >= timestamp ? blockTimestamp - timestamp : 0n;
          const ageText = timestamp === 0n ? "Unavailable" : blockTimestamp < timestamp ? "Oracle timestamp is ahead of the latest block" : `${age.toString()} seconds old · limit ${maxAge.toString()} seconds`;
          return { asset, price: formatUnits(asBigInt(price) ?? 0n, 18), age: ageText, fresh: timestamp !== 0n && maxAge !== 0n && blockTimestamp >= timestamp && age <= maxAge };
        }));
        return { state: "ready", value: lines };
      } catch (error) { return unavailable(error instanceof Error ? error.message : "Oracle read failed."); }
    })(),
  ]);
  return {
    blockNumber: block.number,
    dao: daoResult,
    credentials: credentialResult,
    positions: positionResult,
    prices: priceResult,
  };
}

function ReadStatus({ state }: { state: ReceiptResult["state"] }) {
  const label = state === "verified" ? "Receipt and event confirmed" : state === "checking" ? "Checking receipt…" : state === "mismatch" ? "Receipt did not match expected event" : "Could not verify right now";
  return <span className="status" data-state={state === "verified" ? "valid" : state === "checking" ? "pending" : state === "mismatch" ? "invalid" : "warn"}><i className="status__dot" aria-hidden="true" />{label}</span>;
}

function GroupMessage<T>({ result, fallbackMessage, children }: { result: GroupResult<T> | undefined; fallbackMessage?: string; children: (value: T) => React.ReactNode }) {
  if (!result && fallbackMessage) return <p className="callout callout--caution" role="status">Current state could not be read: {fallbackMessage}</p>;
  if (!result) return <p className="protocol-empty">Reading current on-chain state…</p>;
  if (result.state === "unavailable") return <p className="callout callout--caution" role="status">Current state could not be read: {result.message}</p>;
  return <>{children(result.value)}</>;
}

export function VerifiedDemoHistory() {
  const client = usePublicClient({ chainId: ROBINHOOD_TESTNET_CHAIN_ID });
  const [receipts, setReceipts] = useState<Record<string, ReceiptResult>>(() => Object.fromEntries(RECEIPTS.map((item) => [item.id, { state: "checking" }])));
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [reading, setReading] = useState(false);
  const [topError, setTopError] = useState("");

  const refresh = useCallback(async () => {
    if (!client) {
      setTopError("The Robinhood Testnet RPC client is unavailable.");
      setSnapshot(undefined);
      setReading(false);
      setReceipts(Object.fromEntries(RECEIPTS.map((item) => [item.id, { state: "unavailable" }])));
      return;
    }
    setReading(true);
    setTopError("");
    setReceipts(Object.fromEntries(RECEIPTS.map((item) => [item.id, { state: "checking" }])));
    for (let start = 0; start < RECEIPTS.length; start += 3) {
      const batch = RECEIPTS.slice(start, start + 3);
      const receiptResults = await Promise.all(batch.map(async (item) => {
        try {
          const evidence = await readRobinhoodTransactionEvidence(client, item.hash);
          return [item.id, { state: receiptMatches(item, evidence) ? "verified" : "mismatch", block: evidence.blockNumber, evidence } as ReceiptResult] as const;
        } catch {
          return [item.id, { state: "unavailable" } as ReceiptResult] as const;
        }
      }));
      setReceipts((current) => ({ ...current, ...Object.fromEntries(receiptResults) }));
    }
    try {
      setSnapshot(await readSnapshot(client));
    } catch (error) {
      setSnapshot(undefined);
      setTopError(error instanceof Error ? error.message : "The Robinhood Testnet read failed.");
    }
    setReading(false);
  }, [client]);

  useEffect(() => { void refresh(); }, [refresh]);

  const groups = ["DAO", "Lending V2"] as const;
  return (
    <section className="panel" id="verified-history" aria-labelledby="verified-history-heading">
      <div className="protocol-panel__head">
        <h2 id="verified-history-heading">Explore Verified Demo</h2>
        <span className="status" data-state="demo"><i className="status__dot" aria-hidden="true" />Read-only · Robinhood Testnet</span>
      </div>
      <p className="muted">No wallet, test ETH, credential or witness is needed to explore. Each transaction below is checked against chain {ROBINHOOD_TESTNET_CHAIN_ID} and its expected GYEVO event. These are historical actions, not current positions.</p>
      {topError && <p className="callout callout--caution" role="status">{topError}</p>}
      <div className="protocol-actions">
        <button className="btn btn--secondary btn--sm" type="button" onClick={() => void refresh()} disabled={reading || !client}>{reading ? "Checking public records…" : "Check public records again"}</button>
        {snapshot?.blockNumber !== undefined && <span className="small muted">Current reads from block {snapshot.blockNumber.toString()}</span>}
      </div>

      <div className="protocol-stack">
        <p className="small muted">Policy 4 project credentials were required for the DAO actions. Policy 3 plus a matching private witness was required for Lending proof-gated actions. The pool verifies those proofs on-chain; this view never displays a witness or private value. Credential issuance was a prior project operation, and its receipt hash is not included in this verified action list.</p>
        {groups.map((group) => (
          <section key={group} className="protocol-section" aria-label={`${group} confirmed history`}>
            <h3>{group === "DAO" ? "Verified Governance · Policy 4" : "Private Eligibility · Lending V2"}</h3>
            {group === "Lending V2" && <p className="small muted">Amounts and events below are historical. The current Lending positions are read separately from the pool.</p>}
            <ol className="evidence-events">
              {RECEIPTS.filter((item) => item.group === group).map((item) => {
                const result = receipts[item.id] ?? { state: "checking" as const };
                return <li key={item.id}>
                  <b>{item.action}</b>
                  <span className="small muted">{item.wallet} · {item.detail}</span>
                  <ReadStatus state={result.state} />
                  {result.block !== undefined && <span className="small muted">Block {result.block.toString()}</span>}
                  <a href={`${ROBINHOOD_TESTNET_EXPLORER_URL}/tx/${item.hash}`} target="_blank" rel="noopener noreferrer">Open transaction in explorer<span className="visually-hidden"> (opens in a new tab)</span></a>
                </li>;
              })}
            </ol>
          </section>
        ))}
      </div>

      <details className="protocol-notice">
        <summary className="protocol-inline-link">View current on-chain state</summary>
        <section className="protocol-section" aria-labelledby="demo-current-state">
        <h3 id="demo-current-state">Current on-chain state</h3>
        <p className="small muted">This is a fresh read, separate from the historical receipts above. Current wallet positions are shown only when the Robinhood RPC returns them.</p>
        <h4>DAO Proposal 1</h4>
        <GroupMessage result={snapshot?.dao} fallbackMessage={topError}>{(dao) => <dl className="kv protocol-kv">
          <div className="kv__row"><dt>Current proposal state</dt><dd>{dao.state}</dd></div>
          <div className="kv__row"><dt>Minimum remaining credential validity</dt><dd>{dao.minimumValidity.toString()} seconds</dd></div>
          <div className="kv__row"><dt>Votes</dt><dd>{dao.votes[0].toString()} For · {dao.votes[1].toString()} Against · {dao.votes[2].toString()} Abstain</dd></div>
        </dl>}</GroupMessage>

        <h4>Project credential status</h4>
        <p className="small muted">Live registry status only. Policy 4 is for governance; Policy 3 is for lending proofs. This read does not reveal the private witness.</p>
        <GroupMessage result={snapshot?.credentials} fallbackMessage={topError}>{(credentials) => <ul className="evidence-events">{credentials.map((item) => <li key={`${item.wallet}-${item.policy}`}><b>{item.wallet} · Policy {item.policy}</b><span>{item.status}</span></li>)}</ul>}</GroupMessage>

        <h4>Current Lending positions</h4>
        <GroupMessage result={snapshot?.positions} fallbackMessage={topError}>{(positions) => <ul className="evidence-events">{positions.map((item) => <li key={`${item.wallet}-${item.asset}`}>
          <b>{item.wallet} · {item.asset}</b><span>Supplied {item.supplied} · Collateral {item.collateral} · Debt {item.debt}</span>
          {item.collateralEnabled && item.collateral === "0" && <span className="small muted">Collateral use is enabled in the contract, but no collateral is currently deposited.</span>}
        </li>)}</ul>}</GroupMessage>

        <h4>Test oracle freshness</h4>
        <p className="small muted">Prices are controlled synthetic demo values, not market data. Stale prices disable risk-increasing Lending actions.</p>
        <GroupMessage result={snapshot?.prices} fallbackMessage={topError}>{(prices) => <ul className="evidence-events">{prices.map((item) => <li key={item.asset}>
          <b>{item.asset} · {item.price} test price units</b><span>{item.age} · {item.fresh ? "Fresh for the configured reserve limit" : "Stale or unavailable for risk-increasing actions"}</span>
        </li>)}</ul>}</GroupMessage>
        </section>
      </details>
      {!client && <p className="callout callout--caution" role="status">The Robinhood Testnet RPC client is unavailable. No receipt or current state is assumed.</p>}
    </section>
  );
}
