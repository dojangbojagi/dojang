"use client";

import { AmountAction } from "@/components/lending/amount-action";
import { formatAmount, minBigint } from "@/components/lending/format";
import { shortMarketMessage } from "@/components/lending/lending-panels";
import type { ActionRunner, LendingMarket } from "@/components/lending/types";

/** The supplier experience: approve, supply real demo tokens, and withdraw what is not lent out. */
export function SupplyView({ market, runner }: { market: LendingMarket; runner: ActionRunner }) {
  const { summary, position } = market;

  if (!summary || !position) {
    return (
      <section className="panel panel--ticks protocol-panel" aria-labelledby="lend-supply-heading">
        <div className="protocol-panel__head"><h2 id="lend-supply-heading">Supply</h2></div>
        <p className="protocol-empty">{shortMarketMessage(market.state) ?? "Supplying is not available until the market and your wallet have been read."}</p>
      </section>
    );
  }

  const asset = summary.lendingAsset;
  const withdrawable = minBigint(position.supplierPosition, summary.availableLiquidity);

  return (
    <section className="panel panel--ticks protocol-panel" aria-labelledby="lend-supply-heading">
      <div className="protocol-panel__head"><h2 id="lend-supply-heading">Supply {asset.symbol}</h2></div>
      <p className="protocol-copy">
        Lend {asset.symbol} to the pool. Supplier positions are 1:1 principal: you can take back what you put in, but earn no interest or yield.
        Withdrawals are limited to liquidity that has not been borrowed.
      </p>
      <dl className="kv protocol-kv">
        <div className="kv__row"><dt>Your {asset.symbol} balance</dt><dd>{formatAmount(position.lendingAssetBalance, asset.decimals)}</dd></div>
        <div className="kv__row"><dt>Approved for the pool</dt><dd>{formatAmount(position.lendingAssetAllowance, asset.decimals)}</dd></div>
        <div className="kv__row"><dt>Your supplied position</dt><dd>{formatAmount(position.supplierPosition, asset.decimals)} {asset.symbol}</dd></div>
        <div className="kv__row"><dt>Pool liquidity you can withdraw now</dt><dd>{formatAmount(withdrawable, asset.decimals)} {asset.symbol}</dd></div>
      </dl>
      {position.lendingAssetBalance === 0n && position.supplierPosition === 0n && (
        <p className="callout callout--demo protocol-notice" role="status">
          This wallet holds no {asset.symbol}. The demo token can only be minted by the market operator; there is no faucet here.
        </p>
      )}

      <div className="lend-actions">
        <AmountAction
          title="Supply"
          fieldLabel="Amount to supply"
          asset={asset}
          verb="Supply"
          submitLabel="Supply"
          successMessage="Supply confirmed by the receipt and the contract readback."
          approveSuccessMessage="Approval confirmed. You can supply now."
          balance={position.lendingAssetBalance}
          allowance={position.lendingAssetAllowance}
          max={position.lendingAssetBalance}
          hint="The pool needs your approval for this exact amount before it can take the tokens."
          onApprove={market.approveLendingAsset}
          onSubmit={market.supply}
          runner={runner}
        />
        <AmountAction
          title="Withdraw"
          fieldLabel="Amount to withdraw"
          asset={asset}
          verb="Withdraw"
          submitLabel="Withdraw supply"
          successMessage="Withdrawal confirmed by the receipt and the contract readback."
          max={withdrawable}
          hint={`Up to ${formatAmount(withdrawable, asset.decimals)} ${asset.symbol} can come out now.`}
          checkAmount={(amount) =>
            amount > position.supplierPosition
              ? `This is more than your supplied position (${formatAmount(position.supplierPosition, asset.decimals)} ${asset.symbol}).`
              : amount > summary.availableLiquidity
                ? `Only ${formatAmount(summary.availableLiquidity, asset.decimals)} ${asset.symbol} is unborrowed and available right now.`
                : null}
          onSubmit={market.withdrawSupply}
          runner={runner}
          tone="secondary"
        />
      </div>
    </section>
  );
}
