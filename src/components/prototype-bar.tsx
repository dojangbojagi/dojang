"use client";

import { usePathname } from "next/navigation";

export function PrototypeBar() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <div className="proto-bar">
      <div className="container proto-bar__inner">
        <span><strong>GIWA Sepolia testnet.</strong> Official Dojang is read-only; project contracts are not deployed.</span>
      </div>
    </div>
  );
}
