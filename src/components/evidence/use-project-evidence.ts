"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { GIWA_CHAIN_ID } from "@/lib/config/chain";
import { projectContracts } from "@/lib/config/contracts";
import {
  inspectProjectDeployment,
  type ContractCodeEvidence,
  type ContractDependencyEvidence,
  type EvidenceContractName,
  type ProjectDeploymentEvidence,
} from "@/lib/protocol/chain-evidence";

export type EvidenceState = "unconfigured" | "checking" | "ready" | "read-error";

/**
 * Presentation wrapper around the shared evidence adapter. It reads the configured project contracts' runtime code
 * and dependency links through the GIWA Sepolia client and never writes. Nothing is read when no project address is
 * configured, so an empty configuration stays an empty configuration instead of becoming a failed read.
 */
export function useProjectEvidence() {
  const client = usePublicClient({ chainId: GIWA_CHAIN_ID });
  const anyConfigured = Object.values(projectContracts).some(Boolean);
  const query = useQuery({
    queryKey: ["project-evidence", ...Object.values(projectContracts)],
    queryFn: (): Promise<ProjectDeploymentEvidence> => {
      if (!client) throw new Error("GIWA Sepolia read client is unavailable.");
      return inspectProjectDeployment(client);
    },
    enabled: Boolean(client && anyConfigured),
    refetchInterval: 60_000,
    retry: 1,
  });

  let state: EvidenceState;
  if (!anyConfigured) state = "unconfigured";
  else if (query.isError) state = "read-error";
  else if (query.isPending) state = "checking";
  else state = "ready";

  const evidence = query.data;
  const contract = (name: EvidenceContractName): ContractCodeEvidence | undefined =>
    evidence?.contracts.find((entry) => entry.name === name);
  const dependencies = (from: ContractDependencyEvidence["from"]): readonly ContractDependencyEvidence[] =>
    evidence?.dependencies.filter((entry) => entry.from === from) ?? [];
  const warned = (name: EvidenceContractName) => Boolean(evidence?.discoveryWarnings.some((w) => w.contract === name));

  return {
    state,
    evidence,
    error: query.error instanceof Error ? query.error : undefined,
    contract,
    dependencies,
    warned,
    refetch: query.refetch,
  };
}
