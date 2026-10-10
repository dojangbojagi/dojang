import { formatUnits, parseUnits } from "viem";

/* Presentation helpers only: turning token base units into text and back. No lending rule lives here;
   limits, capacity and collateral rules come from the contract through the lending hooks. */

export interface ParsedAmount {
  /** The amount in token base units, or null while the field is empty or invalid. */
  value: bigint | null;
  /** A message to show under the field, or null. */
  error: string | null;
}

/** Parses what a person typed into an amount in base units for a token with the given decimals. */
export function parseAmount(text: string, decimals: number): ParsedAmount {
  const trimmed = text.trim();
  if (trimmed === "") return { value: null, error: null };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(trimmed)) return { value: null, error: "Use digits and at most one decimal point." };
  const fraction = trimmed.split(".")[1] ?? "";
  if (fraction.length > decimals) return { value: null, error: `This token has ${decimals} decimals.` };
  const value = parseUnits(trimmed.startsWith(".") ? `0${trimmed}` : trimmed, decimals);
  if (value === 0n) return { value: null, error: "Enter an amount greater than zero." };
  return { value, error: null };
}

/** Full-precision text for filling an input (no grouping, no rounding). */
export function toInputText(value: bigint, decimals: number): string {
  return formatUnits(value, decimals);
}

/** Readable text for display: grouped integer part, at most `maxFraction` decimals, trailing zeros removed. */
export function formatAmount(value: bigint, decimals: number, maxFraction = 6): string {
  const [integer, fraction = ""] = formatUnits(value, decimals).split(".");
  const grouped = BigInt(integer).toLocaleString("en-US");
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, "");
  const truncated = fraction.slice(maxFraction).replace(/0+$/, "") !== "";
  return `${grouped}${trimmed ? `.${trimmed}` : ""}${truncated ? "…" : ""}`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function minBigint(...values: bigint[]): bigint {
  return values.reduce((least, value) => (value < least ? value : least));
}
