"use client";

import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();
  /* The landing page ends with its own footer, revealed under the content */
  if (pathname === "/") return null;
  return <footer className="site-footer">GIWA Sepolia demonstration · Not audited · No funds held</footer>;
}
