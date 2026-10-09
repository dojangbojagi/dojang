import { invalidContractConfig, projectContracts } from "@/lib/config/contracts";

/* What the landing may truthfully say about the project contracts, read from the
   same configuration the rest of the app uses. A configured address is not a
   confirmed deployment, so the wording never goes further than "configured". */
export function contractsStatus(): string {
  if (invalidContractConfig.length > 0) return "Invalid configuration";
  const set = Object.values(projectContracts).filter(Boolean).length;
  if (set === 0) return "Not deployed yet";
  if (set === Object.keys(projectContracts).length) return "Addresses configured";
  return "Partly configured";
}
