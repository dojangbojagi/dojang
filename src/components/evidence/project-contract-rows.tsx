"use client";

import { useProjectEvidence } from "@/components/evidence/use-project-evidence";
import { GIWA_EXPLORER_URL } from "@/lib/config/chain";
import type { EvidenceContractName } from "@/lib/protocol/chain-evidence";

export interface ContractRow {
  /** The key in the evidence adapter. */
  key: EvidenceContractName;
  name: string;
  role: string;
  /** Present for contracts that are configured by an environment variable. */
  env?: string;
  /** What the environment gave us, decided on the server: configured, unset or invalid. */
  config?: "configured" | "unset" | "invalid";
  address?: string;
}

type Tone = "valid" | "warn" | "invalid" | "neutral";

function Chip({ tone, children }: { tone: Tone; children: string }) {
  return <span className="status" data-state={tone}><i className="status__dot" aria-hidden="true" />{children}</span>;
}

const short = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-6)}`;

/**
 * One row per project-owned contract. The chip says what is actually known: an unset or invalid configuration, or,
 * for a configured address, what the chain says about code at it. Code present is not source verified.
 */
export function ProjectContractRows({ rows }: { rows: readonly ContractRow[] }) {
  const evidence = useProjectEvidence();

  return (
    <>
      {rows.map((row) => {
        const found = evidence.contract(row.key);
        const address = row.config === "configured" ? row.address : found?.address;
        const code = found?.codeState;
        let chip: { tone: Tone; label: string };
        if (row.config === "invalid") chip = { tone: "invalid", label: "Invalid address" };
        else if (row.config === "unset") chip = { tone: "warn", label: "Not configured" };
        else if (!row.config && !address) chip = { tone: "neutral", label: evidence.state === "checking" ? "Reading…" : "Not available" };
        else if (evidence.state === "checking") chip = { tone: "neutral", label: "Address configured · reading code…" };
        else if (evidence.state === "read-error") chip = { tone: "warn", label: "Address configured · code not read" };
        else if (code === "present") chip = { tone: "valid", label: "Code present" };
        else if (code === "no-code") chip = { tone: "invalid", label: "No code at this address" };
        else chip = { tone: "neutral", label: "Address configured" };

        return (
          <div className="contract-row" key={row.key}>
            <dt>
              <strong>{row.name}</strong>
              <span className="xsmall muted">{row.role}</span>
            </dt>
            <dd>
              <Chip tone={chip.tone}>{chip.label}</Chip>
              {address && (
                <a href={found?.explorerUrl ?? `${GIWA_EXPLORER_URL}/address/${address}`} target="_blank" rel="noopener noreferrer">
                  <code>{address}</code><span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              )}
              {found?.runtimeCodeHash && <span className="xsmall muted">Runtime code hash <code>{short(found.runtimeCodeHash)}</code>. A code hash is not source verification.</span>}
              {row.config === "invalid" && <span className="xsmall muted">The value in the environment is not a valid address, so it is ignored.</span>}
              {row.config === "unset" && <span className="xsmall muted">No address and no deployment is claimed.</span>}
              {!row.config && !address && <span className="xsmall muted">Found on-chain from a configured contract; nothing is assumed.</span>}
              {evidence.warned(row.key) && <span className="xsmall muted">A dependency of this contract could not be read.</span>}
              {row.env && <span className="contract-env">{row.env}</span>}
            </dd>
          </div>
        );
      })}
    </>
  );
}

const DEPENDENCY_LABEL = {
  dojangScroll: "DojangScroll",
  attesterBook: "DojangAttesterBook",
  eas: "EAS",
  registry: "Registry",
  verifier: "Verifier",
  honkVerifier: "Generated verifier",
  lendingAsset: "Lending asset",
  collateralAsset: "Collateral asset",
} as const;

/** What a configured DAO contract points at, and whether that matches GIWA's official Dojang addresses. */
export function GovernanceDependencies() {
  const evidence = useProjectEvidence();
  const deps = evidence.dependencies("daoGovernance");
  if (evidence.state !== "ready" || deps.length === 0) return null;
  return (
    <div className="evidence-block">
      <h3 className="evidence-subhead">What the governance contract points at</h3>
      <dl className="kv protocol-kv">
        {deps.map((dep) => (
          <div className="kv__row" key={dep.relation}>
            <dt>{DEPENDENCY_LABEL[dep.relation]}</dt>
            <dd>
              <span className="addr">{dep.address}</span>
              {dep.matchesConfiguredAddress === true && " · matches the official GIWA address"}
              {dep.matchesConfiguredAddress === false && " · does NOT match the official GIWA address"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
