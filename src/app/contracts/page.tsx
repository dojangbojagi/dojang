import "./contracts.css";
import { PageGlyphFigure } from "@/components/page-glyph";
import { appEnv } from "@/lib/config/env";
import {
  invalidRobinhoodContractConfig,
  robinhoodContracts,
} from "@/lib/config/contracts";
import { ROBINHOOD_TESTNET_EXPLORER_URL } from "@/lib/config/robinhood-testnet";
import { RobinhoodEvidenceLookup } from "@/components/evidence/robinhood-evidence-lookup";

const PROJECT_CONTRACTS = [
  {
    key: "zkTranscriptLib",
    name: "ZKTranscriptLib",
    type: "Project-owned verifier library",
    role: "Linked library used by the generated Honk verifier.",
    env: "NEXT_PUBLIC_ROBINHOOD_ZK_TRANSCRIPT_LIB_CONTRACT",
  },
  {
    key: "relationsLib",
    name: "RelationsLib",
    type: "Project-owned verifier library",
    role: "Linked library used by the generated Honk verifier.",
    env: "NEXT_PUBLIC_ROBINHOOD_RELATIONS_LIB_CONTRACT",
  },
  {
    key: "honkVerifier",
    name: "HonkVerifier",
    type: "Generated project verifier",
    role: "Generated from this repository's eligibility circuit and linked to both verifier libraries.",
    env: "NEXT_PUBLIC_ROBINHOOD_HONK_VERIFIER_CONTRACT",
  },
  {
    key: "credentialRegistry",
    name: "RobinhoodDemoCredentialRegistry",
    type: "Project-owned credential registry",
    role: "Project-issued policy-3 test credentials. This is not an official Dojang credential system.",
    env: "NEXT_PUBLIC_ROBINHOOD_CREDENTIAL_REGISTRY_CONTRACT",
  },
  {
    key: "verifierAdapter",
    name: "EligibilityVerifierAdapter",
    type: "Project-owned verifier adapter",
    role: "Connects LendingPoolV2 to the generated Honk verifier.",
    env: "NEXT_PUBLIC_ROBINHOOD_VERIFIER_ADAPTER_CONTRACT",
  },
  {
    key: "lendingV2Oracle",
    name: "ControlledTestOracle",
    type: "Project-owned test oracle",
    role: "Operator-set, bounded synthetic prices for test assets; not market data.",
    env: "NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ORACLE_CONTRACT",
  },
  {
    key: "lendingV2Asset",
    name: "ControlledTestToken · rUSD2",
    type: "Project-owned test token / lending reserve",
    role: "Controlled demo liquidity asset; not a real or bridged stablecoin.",
    env: "NEXT_PUBLIC_ROBINHOOD_LENDING_V2_ASSET_CONTRACT",
  },
  {
    key: "lendingV2Collateral",
    name: "ControlledTestToken · rCOL2",
    type: "Project-owned test token / collateral reserve",
    role: "Controlled demo collateral asset; not a real or bridged token.",
    env: "NEXT_PUBLIC_ROBINHOOD_LENDING_V2_COLLATERAL_CONTRACT",
  },
  {
    key: "lendingV2Pool",
    name: "LendingPoolV2",
    type: "Project-owned lending market",
    role: "Multi-reserve test lending engine. This confirmed deployment has two configured demo reserves; the source supports up to eight.",
    env: "NEXT_PUBLIC_ROBINHOOD_LENDING_V2_POOL_CONTRACT",
  },
  {
    key: "governance",
    name: "RobinhoodGovernancePhase1",
    type: "Project-owned Robinhood DAO Phase 1 contract",
    role: "Uses project-issued policy-4 credentials. This is separate from the GIWA DAO and official Dojang path.",
    env: "NEXT_PUBLIC_ROBINHOOD_GOVERNANCE_CONTRACT",
  },
] as const;

const LEGACY_CONTRACTS = [
  {
    name: "GovernedDojangAccess",
    role: "DAO Phase 1 contract is hard-bound to GIWA Sepolia and official Dojang infrastructure; it is not a Robinhood governance deployment.",
  },
  {
    name: "DemoCredentialRegistry / LendingPool V1",
    role: "Legacy GIWA demo path. Robinhood V2 uses a separate RobinhoodDemoCredentialRegistry and LendingPoolV2 deployment.",
  },
  {
    name: "RestrictedVault",
    role: "Legacy technical access gate; it is not part of the Robinhood Lending V2 deployment script.",
  },
] as const;

type InventoryKey = (typeof PROJECT_CONTRACTS)[number]["key"];

function ContractAddressRow({ item }: { item: (typeof PROJECT_CONTRACTS)[number] }) {
  const key = item.key as InventoryKey;
  const rawAddress = appEnv.robinhoodContracts[key];
  const address = robinhoodContracts[key];
  const invalid = invalidRobinhoodContractConfig.includes(key);
  const status = invalid
    ? "Invalid address configuration"
    : address
      ? "Address configured · live chain evidence below"
      : "Not configured";

  return (
    <div className="contract-row">
      <dt>
        <strong>{item.name}</strong>
        <span className="xsmall muted">{item.type} · {item.role}</span>
      </dt>
      <dd>
        <span className="status" data-state={invalid ? "invalid" : address ? "neutral" : "warn"}>
          <i className="status__dot" aria-hidden="true" />{status}
        </span>
        {address && (
          <a href={`${ROBINHOOD_TESTNET_EXPLORER_URL}/address/${address}`} target="_blank" rel="noopener noreferrer">
            <code>{address}</code><span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        )}
        {invalid && <span className="xsmall muted">The configured value is not a valid EVM address.</span>}
        {!rawAddress && <span className="xsmall muted">No Robinhood address is configured; no deployment is claimed.</span>}
        <span className="contract-env">{item.env}</span>
      </dd>
    </div>
  );
}

export default function ContractsPage() {
  const configured = PROJECT_CONTRACTS.filter(({ key }) => Boolean(robinhoodContracts[key])).length;

  return (
    <main className="page">
      <header className="page-head">
        <PageGlyphFigure glyph={{ shape: "stack", label: "Project contract inventory and on-chain evidence status for Robinhood Chain Testnet.", caption: "Evidence, layer by layer", legend: ["public"] }} />
        <p className="eyebrow">Evidence · Project contracts and deployment status</p>
        <h1>Contract evidence</h1>
        <p className="page-lead">
          Network: Robinhood Chain Testnet · Chain ID 46630. Configured addresses are checked against live chain and Blockscout evidence below; environment configuration alone is not proof of deployment.
        </p>
      </header>

      <section className="panel" aria-labelledby="project-contracts-heading">
        <h2 id="project-contracts-heading">Robinhood project contract inventory</h2>
        <p className="contract-summary">{configured} of {PROJECT_CONTRACTS.length} Robinhood addresses configured</p>
        <dl className="contract-list">
          {PROJECT_CONTRACTS.map((item) => <ContractAddressRow key={item.key} item={item} />)}
        </dl>
        {configured === 0 ? (
          <p className="notice">
            No Robinhood project contract address is configured in this environment. Missing configuration does not establish that no contract is deployed; local Foundry and Anvil results are not public-chain evidence.
          </p>
        ) : (
          <p className="notice">
            Configured addresses link to the Robinhood Testnet explorer. Live RPC bytecode and Blockscout source-verification status are checked below; address configuration alone is not deployment evidence.
          </p>
        )}
        <p className="notice">
          Evidence terms: “Not configured” means no address was supplied to this environment. “No code” and “Code present” come from Robinhood RPC bytecode reads. Receipt status and emitted project events come from the queried transaction receipt. Source status is fetched separately from Blockscout; lookup failures appear as unavailable.
        </p>
      </section>

      <section className="panel" aria-labelledby="legacy-heading">
        <h2 id="legacy-heading">Legacy contracts outside the Robinhood V2 launch stack</h2>
        <dl className="contract-list">
          {LEGACY_CONTRACTS.map((contract) => (
            <div className="contract-row" key={contract.name}>
              <dt><strong>{contract.name}</strong><span className="xsmall muted">Existing project source</span></dt>
              <dd><span className="status" data-state="warn"><i className="status__dot" aria-hidden="true" />Not configured for Robinhood</span><span className="xsmall muted">{contract.role}</span></dd>
            </div>
          ))}
        </dl>
        <p className="muted">GIWA DojangScroll, DojangAttesterBook, EAS, and GIWA itself are external infrastructure. BOJOGAY-issued Robinhood test credentials are separate and must never be shown as official GIWA, Upbit, or third-party credentials.</p>
      </section>

      <RobinhoodEvidenceLookup />
    </main>
  );
}
