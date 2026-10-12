"use client";

import { usePathname } from "next/navigation";

export function PrototypeBar() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <div className="proto-bar">
      <div className="container proto-bar__inner">
        <span><strong>Robinhood Testnet demo · chain 46630.</strong> Project contracts are deployed; Robinhood credentials are BOJOGAY-issued. Official Dojang verification is a separate GIWA integration.</span>
      </div>
    </div>
  );
}
