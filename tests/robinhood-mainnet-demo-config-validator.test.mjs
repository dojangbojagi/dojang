import { describe, expect, test } from "bun:test";
import {
  ADDRESS_KEYS,
  PARAMETER_KEYS,
  parseAllowedEnv,
  validateConfig,
} from "../scripts/validate-robinhood-mainnet-demo-config.mjs";

const proposedParameters = {
  RH_MAINNET_DEMO_GOVERNANCE_VOTING_PERIOD: "86400",
  RH_MAINNET_DEMO_GOVERNANCE_QUORUM: "2",
  RH_MAINNET_DEMO_GOVERNANCE_EXECUTION_WINDOW: "172800",
  RH_MAINNET_DEMO_GOVERNANCE_INITIAL_MIN_VALIDITY: "3600",
  RH_MAINNET_DEMO_LOAN_MINT_CAP: "1000000000",
  RH_MAINNET_DEMO_COLLATERAL_MINT_CAP: "1000000000000000000000",
  RH_MAINNET_DEMO_LENDING_SUPPLY_CAP: "100000000",
  RH_MAINNET_DEMO_LENDING_BORROW_CAP: "25000000",
  RH_MAINNET_DEMO_COLLATERAL_CAP: "100000000000000000000",
  RH_MAINNET_DEMO_MIN_BORROW_AMOUNT: "1000000",
  RH_MAINNET_DEMO_MAX_ORACLE_AGE: "600",
  RH_MAINNET_DEMO_MAX_LTV_BPS: "2500",
  RH_MAINNET_DEMO_LIQUIDATION_THRESHOLD_BPS: "4000",
  RH_MAINNET_DEMO_LIQUIDATION_BONUS_BPS: "500",
  RH_MAINNET_DEMO_CLOSE_FACTOR_BPS: "2500",
  RH_MAINNET_DEMO_RESERVE_FACTOR_BPS: "2000",
  RH_MAINNET_DEMO_OPTIMAL_UTILIZATION_BPS: "5000",
  RH_MAINNET_DEMO_BASE_BORROW_RATE_BPS: "100",
  RH_MAINNET_DEMO_SLOPE1_BPS: "300",
  RH_MAINNET_DEMO_SLOPE2_BPS: "1200",
  RH_MAINNET_DEMO_LOAN_PRICE_MIN_WAD: "950000000000000000",
  RH_MAINNET_DEMO_LOAN_PRICE_MAX_WAD: "1050000000000000000",
  RH_MAINNET_DEMO_COLLATERAL_PRICE_MIN_WAD: "1900000000000000000",
  RH_MAINNET_DEMO_COLLATERAL_PRICE_MAX_WAD: "2100000000000000000",
};

function completeConfig() {
  const values = {
    RH_MAINNET_RPC_URL: "https://rpc.mainnet.chain.robinhood.com",
    RH_MAINNET_ACCOUNT: "gyevo-rh-mainnet-deployer",
    ...proposedParameters,
  };
  ADDRESS_KEYS.forEach((key, index) => {
    values[key] = `0x${(index + 1).toString(16).padStart(40, "0")}`;
  });
  return values;
}

describe("Robinhood Mainnet demo config validator", () => {
  test("accepts the documented demo-only candidate shape without treating it as approval", () => {
    const result = validateConfig(completeConfig());
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.warnings.join(" ")).toContain("does not approve");
    expect(PARAMETER_KEYS).toHaveLength(24);
  });

  test("reports only missing public configuration key names", () => {
    const result = validateConfig({});
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("RH_MAINNET_ACCOUNT");
    expect(result.missing).toContain("RH_MAINNET_DEMO_GOVERNANCE_QUORUM");
    expect(result.missing).toHaveLength(35);
    expect(JSON.stringify(result)).not.toContain("private");
  });

  test("rejects duplicate role addresses and unsafe reserve relationships", () => {
    const values = completeConfig();
    values.RH_MAINNET_ADMIN_ADDRESS = values.RH_MAINNET_DEPLOYER_ADDRESS;
    values.RH_MAINNET_DEMO_LENDING_BORROW_CAP = "100000001";
    values.RH_MAINNET_DEMO_MAX_LTV_BPS = "4500";
    const result = validateConfig(values);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("must be distinct"))).toBe(true);
    expect(result.errors.some((error) => error.includes("cannot exceed LENDING_SUPPLY_CAP"))).toBe(true);
    expect(result.errors.some((error) => error.includes("must not exceed LIQUIDATION_THRESHOLD_BPS"))).toBe(true);
  });

  test("rejects zero addresses before Foundry simulation", () => {
    const values = completeConfig();
    values.RH_MAINNET_ISSUER_ADDRESS = "0x0000000000000000000000000000000000000000";
    const result = validateConfig(values);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("RH_MAINNET_ISSUER_ADDRESS cannot be the zero address.");
  });

  test("parses only allowlisted config keys and never evaluates arbitrary env text", () => {
    const parsed = parseAllowedEnv([
      "RH_MAINNET_ACCOUNT=gyevo-rh-mainnet-deployer",
      "PRIVATE_KEY=must-not-be-read",
      "export RH_MAINNET_ADMIN_ADDRESS=$(touch /tmp/should-not-run)",
      "RH_MAINNET_RPC_URL=https://rpc.mainnet.chain.robinhood.com",
    ].join("\n"));
    expect(parsed).toEqual({
      RH_MAINNET_ACCOUNT: "gyevo-rh-mainnet-deployer",
      RH_MAINNET_RPC_URL: "https://rpc.mainnet.chain.robinhood.com",
    });
    expect(JSON.stringify(parsed)).not.toContain("must-not-be-read");
  });
});
