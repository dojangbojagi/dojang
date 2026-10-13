import Link from "next/link";
import { LendingV2Workspace } from "@/components/lending-v2/lending-v2-workspace";

/** The public Lending route is always Robinhood V2; GIWA V1 is isolated on /lending/legacy. */
export function LendingExperience() {
  return (
    <div className="lend lendv2-experience">
      <LendingV2Workspace />
      <p className="xsmall muted">
        Looking for the separate GIWA Sepolia legacy demo? <Link className="protocol-inline-link" href="/lending/legacy">Open Lending V1</Link>.
      </p>
    </div>
  );
}
