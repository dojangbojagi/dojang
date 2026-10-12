import type { ReactNode } from "react";

export type Tone = "valid" | "pending" | "invalid" | "warn" | "demo" | "neutral";

/** A status chip. The words carry the meaning; the colour only supports them. */
export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="status" data-state={tone}>
      <i className="status__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/** A thin bar for a share of something (utilisation, cap usage, borrowing-limit usage). Always paired with the number as text. */
export function Meter({ bps, label, tone }: { bps: bigint | null; label: string; tone?: "valid" | "warn" | "invalid" }) {
  const width = bps === null ? 0 : Math.min(100, Number(bps) / 100);
  return (
    <span className="lendv2-meter" role="img" aria-label={bps === null ? `${label}: not applicable` : `${label}: ${(Number(bps) / 100).toFixed(1)}%`} data-tone={tone}>
      <i style={{ width: `${width}%` }} />
    </span>
  );
}

/** One labelled value in a dense metrics grid. */
export function Metric({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="lendv2-metric">
      <dt>{label}</dt>
      <dd>{children}</dd>
      {note ? <p className="lendv2-metric__note">{note}</p> : null}
    </div>
  );
}

/** A polished "this is not available" block. It never shows placeholder numbers. */
export function Unavailable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="lendv2-unavailable" role="status">
      <span className="lendv2-unavailable__mark" aria-hidden="true" />
      <div>
        <p className="lendv2-unavailable__title">{title}</p>
        <div className="lendv2-unavailable__body">{children}</div>
      </div>
    </div>
  );
}
