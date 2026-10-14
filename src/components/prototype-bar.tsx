"use client";

import { usePathname } from "next/navigation";
import { appEnv } from "@/lib/config/env";

export function PrototypeBar() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <div className="proto-bar">
      <div className="container proto-bar__inner">
        <span><strong>Interactive demo: Robinhood Testnet · chain 46630.</strong> Controlled Mainnet deployment · chain 4663; DAO and Lending paused. {appEnv.appName} credentials are project-issued, not official GIWA or Upbit credentials.</span>
      </div>
    </div>
  );
}
