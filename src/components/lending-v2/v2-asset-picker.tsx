"use client";

import type { Address } from "viem";
import type { V2Reserve } from "@/components/lending-v2/v2-types";

/** A small radio group for choosing a reserve. Reserves that cannot take the action stay listed, with the reason. */
export function AssetPicker({ legend, reserves, value, onChange, disabledReason }: {
  legend: string;
  reserves: readonly V2Reserve[];
  value: Address | undefined;
  onChange: (asset: Address) => void;
  disabledReason?: (reserve: V2Reserve) => string | null;
}) {
  return (
    <fieldset className="lendv2-picker">
      <legend>{legend}</legend>
      <div className="lendv2-picker__options">
        {reserves.map((reserve) => {
          const reason = disabledReason?.(reserve) ?? null;
          const checked = value?.toLowerCase() === reserve.asset.toLowerCase();
          return (
            <label key={reserve.asset} className="lendv2-picker__option" data-checked={checked ? "true" : undefined} data-disabled={reason ? "true" : undefined}>
              <input
                type="radio"
                name={`lendv2-pick-${legend}`}
                checked={checked}
                onChange={() => onChange(reserve.asset)}
              />
              <span className="lendv2-picker__symbol">{reserve.symbol}</span>
              {reason && <span className="lendv2-picker__reason">{reason}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
