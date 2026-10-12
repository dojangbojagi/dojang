"use client";

import { usePathname } from "next/navigation";
import { appEnv } from "@/lib/config/env";

export function PrototypeBar() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <div className="proto-bar">
      <div className="container proto-bar__inner">
        <span><strong>Robinhood Testnet demo · chain 46630.</strong> Project contracts are deployed; Credentials are issued by {appEnv.appName}, the project. Official Dojang verification is a separate GIWA integration.</span>
      </div>
    </div>
  );
}
