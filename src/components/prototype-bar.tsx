"use client";

import { usePathname } from "next/navigation";
import { appEnv } from "@/lib/config/env";

export function PrototypeBar() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <div className="proto-bar">
      <div className="container proto-bar__inner">
        <span><strong>Deployed on Robinhood Mainnet · chain 4663 · 10 contracts.</strong> Interactive journeys run on Robinhood Testnet · chain 46630. Mainnet DAO and Lending are paused; assets are synthetic. {appEnv.appName} credentials are project-issued, not official GIWA or Upbit credentials.</span>
      </div>
    </div>
  );
}
