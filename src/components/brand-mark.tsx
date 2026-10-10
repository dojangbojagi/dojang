/* The sealed square: a patchwork of public (champagne) and private (lime) panels. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="1.25" y="1.25" width="21.5" height="21.5" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="5" width="6.5" height="9" rx="1.4" fill="#EADCB6" />
      <rect x="13.25" y="5" width="5.75" height="4.5" rx="1.4" fill="currentColor" />
      <rect x="13.25" y="11.5" width="5.75" height="7.5" rx="1.4" fill="#C8FF6A" />
      <rect x="5" y="16" width="6.5" height="3" rx="1.4" fill="currentColor" />
    </svg>
  );
}
