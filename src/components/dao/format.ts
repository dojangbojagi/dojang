import { useEffect, useState } from "react";

/* Presentation helpers for the governance page. They only format what the contract returned; no governance rule
   is decided here. */

const DAY = 86_400n;
const UNITS: readonly (readonly [bigint, string])[] = [[DAY, "day"], [3_600n, "hour"], [60n, "minute"], [1n, "second"]];

/** 604800n -> "7 days"; 5400n -> "1 hour 30 minutes". Shows at most two units. */
export function formatDuration(seconds: bigint): string {
  if (seconds === 0n) return "0 seconds";
  const parts: string[] = [];
  let rest = seconds;
  for (const [size, name] of UNITS) {
    const n = rest / size;
    if (n > 0n) {
      parts.push(`${n} ${name}${n === 1n ? "" : "s"}`);
      rest -= n * size;
    }
    if (parts.length === 2) break;
  }
  return parts.join(" ");
}

export const formatTimestamp = (seconds: bigint) => new Date(Number(seconds) * 1000).toLocaleString();

/** "in 3 hours" / "2 days ago", from a chain timestamp and the current time in seconds. */
export function relativeTime(seconds: bigint, nowSeconds: number): string {
  const diff = Number(seconds) - nowSeconds;
  const label = formatDuration(BigInt(Math.max(0, Math.floor(Math.abs(diff)))));
  return diff >= 0 ? `in ${label}` : `${label} ago`;
}

/** Current time in seconds, refreshed on an interval so countdowns and open/closed labels do not go stale. */
export function useNowSeconds(everyMs = 15_000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export const utf8Length = (text: string) => new TextEncoder().encode(text).length;

/** The page's own reading of the contract's limits (1 to 512 bytes of public text). */
export const MAX_CONTENT_BYTES = 512;
/** The contract bounds the policy value to 0..365 days. */
export const MAX_VALIDITY_SECONDS = 365n * DAY;

export type ValidityUnit = "days" | "hours" | "minutes" | "seconds";
const UNIT_SECONDS: Record<ValidityUnit, bigint> = { days: DAY, hours: 3_600n, minutes: 60n, seconds: 1n };

export function parseValidity(text: string, unit: ValidityUnit): { value: bigint | null; error: string | null } {
  const trimmed = text.trim();
  if (trimmed === "") return { value: null, error: null };
  if (!/^\d+$/.test(trimmed)) return { value: null, error: "Use a whole number, 0 or more." };
  const value = BigInt(trimmed) * UNIT_SECONDS[unit];
  if (value > MAX_VALIDITY_SECONDS) return { value: null, error: "The contract allows at most 365 days." };
  return { value, error: null };
}

/** A link only for plain web addresses; anything else is shown as text. Never executed or fetched by the page. */
export function contentLink(reference: string): string | null {
  try {
    const url = new URL(reference.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Share of `part` in `whole`, as a percentage with one decimal; display only. */
export function percent(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0;
  return Number((part * 1000n) / whole) / 10;
}
