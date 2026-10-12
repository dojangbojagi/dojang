"use client";

import { usePathname } from "next/navigation";
import { appEnv } from "@/lib/config/env";

export function PrototypeBar() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <div className="proto-bar">
      <div className="container proto-bar__inner">
        <span><strong>Robinhood Testnet · chain 46630.</strong> Test tokens only. {appEnv.appName} credentials are project-issued, not official GIWA or Upbit credentials.</span>
      </div>
    </div>
  );
}
