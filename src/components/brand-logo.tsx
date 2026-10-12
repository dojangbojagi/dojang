import Image from "next/image";

/* The real logo (public/logo.svg, used as it is). It is silver and burgundy on a transparent ground, which
   reads on dark and fades on white, so it always sits in the same minimal dark tile: one mark, one look,
   on the white cover, the dark bars and the footers. */
export function BrandLogo({ size = 38, priority = false }: { size?: number; priority?: boolean }) {
  const pad = Math.max(3, Math.round(size * 0.09));
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-grid",
        placeItems: "center",
        flex: "none",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: "#0A0708",
        boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.14)",
      }}
    >
      <Image src="/logo.svg" alt="" width={size - pad * 2} height={size - pad * 2} priority={priority} />
    </span>
  );
}
