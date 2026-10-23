"use client";

import type { Address } from "viem";
import { formatAmount, minBigint } from "@/components/lending/format";
import type { ActionRunner } from "@/components/lending/types";
import { AssetPicker } from "@/components/lending-v2/v2-asset-picker";
import { formatBps, mainnetParticipantBlockReason, reserveBlockReason, usageBps } from "@/components/lending-v2/v2-format";
import { Chip, Metric, Unavailable } from "@/components/lending-v2/v2-parts";
import { ReviewedAction } from "@/components/lending-v2/reviewed-action";
import { positionOf, type V2Market, type V2Proof } from "@/components/lending-v2/v2-types";
import { ProtocolError } from "@/lib/protocol/types";

/** Supply and withdraw. Supplying needs a fresh policy-3 proof; withdrawing never does. */
export function SupplyView({ market, proof, runner, asset, onAsset }: {
  market: V2Market;
  proof: V2Proof;
  runner: ActionRunner;
  asset: Address | undefined;
  onAsset: (asset: Address) => void;
}) {
  const snapshot = market.snapshot;
  const reserve = snapshot?.reserves.find((item) => item.asset.toLowerCase() === asset?.toLowerCase())
    ?? snapshot?.reserves.find((item) => item.data.config.supplyEnabled)
    ?? snapshot?.reserves[0];

  if (!snapshot || !reserve) {
    return (
      <section className="panel panel--ticks protocol-panel" aria-labelledby="lendv2-supply-heading">
        <div className="protocol-panel__head"><h2 id="lendv2-supply-heading">Supply</h2></div>
        <Unavailable title={market.state === "checking" ? "Reading the pool…" : "Supplying is unavailable"}>
          {market.state === "checking" ? <p>Reading the Lending V2 pool and your wallet from {market.networkName}. Nothing is shown in its place.</p> : null}
          <p>Supply needs a readable Lending V2 pool with at least one reserve that accepts supply. Nothing is simulated while it is unavailable.</p>
        </Unavailable>
      </section>
    );
  }

  const { symbol, decimals, data } = reserve;
  const { config } = data;
  const position = positionOf(snapshot, reserve);
  const blocked = reserveBlockReason(reserve, snapshot.riskPaused, "supply");
  const headroom = config.supplyCap > data.totalSupplyAssets ? config.supplyCap - data.totalSupplyAssets : 0n;
  const withdrawable = position ? minBigint(position.supplied, data.availableLiquidity) : 0n;
  const proofValue = proof.proof;
  const participantBlocked = mainnetParticipantBlockReason(market.chainId, Boolean(snapshot.position), snapshot.position?.demoParticipant);
  const capUse = usageBps(data.totalSupplyAssets, config.supplyCap);

  const supplyPrecondition =
    blocked ??
    (!position ? `Connect a wallet on ${market.networkName} to see your balance.` : null) ??
    participantBlocked ??
    (headroom === 0n ? `The ${symbol} supply cap has been reached.` : null);

  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="lendv2-supply-heading">
      <div className="protocol-panel__head">
        <h2 id="lendv2-supply-heading">Supply {symbol}</h2>
        <Chip tone={proofValue ? "valid" : "demo"}>{proofValue ? "Proof ready" : "Proof needed to supply"}</Chip>
      </div>
      <AssetPicker
        legend="Asset to supply"
        reserves={snapshot.reserves}
        value={reserve.asset}
        onChange={onAsset}
        disabledReason={(item) => reserveBlockReason(item, snapshot.riskPaused, "supply")}
      />
      <p className="protocol-copy">
        Lend {symbol} to the pool and earn the pool&apos;s variable supply rate. You can withdraw what is not lent out.
        Supplying needs your wallet, an exact-amount token approval, and a policy-3 proof; withdrawing needs neither a proof nor a current credential.
      </p>

      <dl className="lendv2-metrics">
        <Metric label={`Your ${symbol} balance`}>{position ? formatAmount(position.walletBalance, decimals) : "Connect a wallet"}</Metric>
        <Metric label="Current pool allowance" note={market.poolAddress ? `Spender: ${market.poolAddress}` : "Pool address unavailable"}>{position ? `${formatAmount(position.allowance, decimals)} ${symbol}` : "Connect a wallet"}</Metric>
        <Metric label="Your supplied position" note="Includes interest accrued up to the block read.">{position ? `${formatAmount(position.supplied, decimals)} ${symbol}` : "Connect a wallet"}</Metric>
        <Metric label="Supply rate (APR)" note="Variable. Not compounded.">{formatBps(data.currentSupplyRateBps)}</Metric>
        <Metric label="Available liquidity">{formatAmount(data.availableLiquidity, decimals)} {symbol}</Metric>
        <Metric label="Supply cap">{config.supplyEnabled ? `${formatAmount(data.totalSupplyAssets, decimals)} of ${formatAmount(config.supplyCap, decimals)} ${symbol}${capUse !== null ? ` (${formatBps(capUse)})` : ""}` : "Supplying is off"}</Metric>
        <Metric label="Room under the cap">{config.supplyEnabled ? `${formatAmount(headroom, decimals)} ${symbol}` : "n/a"}</Metric>
        <Metric label="You can withdraw now">{position ? `${formatAmount(withdrawable, decimals)} ${symbol}` : "Connect a wallet"}</Metric>
      </dl>
      {position && position.walletBalance === 0n && position.supplied === 0n && (
        <p className="callout callout--demo protocol-notice" role="status">
          This wallet holds no {symbol}. It is a controlled test token that only the project operator can mint; there is no faucet here.
        </p>
      )}

      <div className="lend-actions">
        <ReviewedAction
          key={`supply-${reserve.asset}`}
          title="Supply"
          fieldLabel="Amount to supply"
          asset={{ symbol, decimals }}
          verb="Supply"
          submitLabel="Confirm supply"
          successMessage="Supply confirmed by the receipt, the pool event and the contract readback."
          approveSuccessMessage="Approval confirmed. You can confirm the supply now."
          balance={position?.walletBalance}
          allowance={position?.allowance}
          max={position ? minBigint(position.walletBalance, headroom) : undefined}
          hint={market.poolAddress
            ? `Approval is limited to the amount entered. Spender: ${market.poolAddress}. The wallet, chain, token balance, allowance and estimated network fee are checked before signing.`
            : "The pool needs your approval for this exact amount before it can take the tokens."}
          precondition={supplyPrecondition}
          approvalPrecondition={!position
            ? `Connect a wallet on ${market.networkName} to approve this token.`
            : !market.poolAddress ? "The verified Lending V2 spender is unavailable." : null}
          approvalCheckAmount={(amount) => amount > headroom ? `The supply cap leaves room for ${formatAmount(headroom, decimals)} ${symbol}.` : null}
          submitPrecondition={!proofValue ? "Generate a locally verified Policy 3 proof before supplying. Approval can be completed first; the proof is checked again by the pool." : null}
          submitAction={!proofValue ? (
            <a className="btn btn--secondary" href="#lendv2-eligibility" aria-label="Go to the Eligibility card to generate a Policy 3 proof">
              Generate Policy 3 Proof
            </a>
          ) : undefined}
          checkAmount={(amount) => amount > headroom ? `The supply cap leaves room for ${formatAmount(headroom, decimals)} ${symbol}.` : null}
          onApprove={(amount) => market.approveToken(reserve.asset, amount)}
          onSubmit={(amount) => {
            if (!proofValue) return Promise.reject(new ProtocolError("INVALID_PROOF", "Generate a policy-3 proof first."));
            return market.supply(reserve.asset, amount, proofValue);
          }}
          review={(amount) => (
            <dl className="kv protocol-kv">
              <div className="kv__row"><dt>You supply</dt><dd>{formatAmount(amount, decimals)} {symbol}</dd></div>
              <div className="kv__row"><dt>Supplied position after</dt><dd>{position ? `${formatAmount(position.supplied + amount, decimals)} ${symbol}` : "—"}</dd></div>
              <div className="kv__row"><dt>Wallet balance after</dt><dd>{position ? `${formatAmount(position.walletBalance - amount, decimals)} ${symbol}` : "—"}</dd></div>
              <div className="kv__row"><dt>Supply rate</dt><dd>{formatBps(data.currentSupplyRateBps)} APR, variable <span className="muted">(changes with utilization)</span></dd></div>
              <div className="kv__row"><dt>Authorization</dt><dd>GYEVO Policy 3 proof, verified again by the pool</dd></div>
              <div className="kv__row"><dt>Current allowance</dt><dd>{position ? `${formatAmount(position.allowance, decimals)} ${symbol}` : "Unavailable"}</dd></div>
              <div className="kv__row"><dt>Spender</dt><dd className="addr">{market.poolAddress ?? "Unavailable"}</dd></div>
              <div className="kv__row"><dt>Approval amount</dt><dd>{position && amount > position.allowance ? `${formatAmount(amount, decimals)} ${symbol} exactly` : "No additional approval needed"}</dd></div>
            </dl>
          )}
          runner={runner}
        />
        <ReviewedAction
          key={`withdraw-${reserve.asset}`}
          title="Withdraw supply"
          fieldLabel="Amount to withdraw"
          asset={{ symbol, decimals }}
          verb="Withdraw"
          submitLabel="Confirm withdrawal"
          successMessage="Withdrawal confirmed by the receipt, the pool event and the contract readback."
          max={withdrawable}
          hint={position ? `Up to ${formatAmount(withdrawable, decimals)} ${symbol} can come out now: your position, limited to liquidity that is not lent out.` : undefined}
              precondition={!position ? `Connect a wallet on ${market.networkName} to withdraw.` : position.supplied === 0n ? "You have no supplied position in this asset." : null}
          checkAmount={(amount) =>
            amount > position!.supplied
              ? `This is more than your supplied position (${formatAmount(position!.supplied, decimals)} ${symbol}).`
              : amount > data.availableLiquidity
                ? `Only ${formatAmount(data.availableLiquidity, decimals)} ${symbol} is not lent out right now.`
                : null}
          onSubmit={(amount) => market.withdrawSupply(reserve.asset, amount)}
          review={(amount) => (
            <dl className="kv protocol-kv">
              <div className="kv__row"><dt>You withdraw</dt><dd>{formatAmount(amount, decimals)} {symbol}</dd></div>
              <div className="kv__row"><dt>Supplied position after</dt><dd>{position ? `${formatAmount(position.supplied > amount ? position.supplied - amount : 0n, decimals)} ${symbol}` : "—"}</dd></div>
              <div className="kv__row"><dt>Needs a proof or credential</dt><dd>No. Withdrawing is a safe exit.</dd></div>
            </dl>
          )}
          runner={runner}
          tone="secondary"
        />
      </div>
    </section>
  );
}
