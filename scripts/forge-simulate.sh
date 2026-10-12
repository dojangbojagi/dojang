#!/usr/bin/env bash
set -euo pipefail

if (($# == 0)); then
  echo "usage: bun run deployment:simulate -- <script:Contract> [forge script options]" >&2
  exit 2
fi

for argument in "$@"; do
  case "$argument" in
    --broadcast|--broadcast=*|--resume|--verify|--verify=*|--account|--account=*|--sender|--sender=*|--private-key|--private-key=*|--keystore|--keystore=*|--mnemonic|--mnemonic=*|--mnemonic-derivation-path|--mnemonic-derivation-path=*|--mnemonic-passphrase|--mnemonic-passphrase=*|--ledger|--trezor|--unlocked)
      echo "deployment:simulate refuses broadcast, verification, and signer options: ${argument%%=*}" >&2
      exit 2
      ;;
  esac
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
contracts_dir="$(cd -- "$script_dir/../contracts" && pwd)"
workspace_env="$contracts_dir/../.env"

# Foundry runs from contracts/, while the project's non-secret deployment inputs live in
# the workspace-root .env. Export only the Robinhood simulation allowlist; never load a
# private key, mnemonic, account password, or arbitrary shell expression into this process.
if [[ -f "$workspace_env" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*(RH_TESTNET_[A-Za-z0-9_]+)[[:space:]]*=(.*)$ ]] || continue
    name="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    case "$name" in
      RH_TESTNET_RPC_URL|RH_TESTNET_ADMIN_ADDRESS|RH_TESTNET_ISSUER_ADDRESS|\
      RH_TESTNET_GOVERNANCE_VOTING_PERIOD|RH_TESTNET_GOVERNANCE_QUORUM|\
      RH_TESTNET_GOVERNANCE_EXECUTION_WINDOW|RH_TESTNET_GOVERNANCE_INITIAL_MIN_VALIDITY|\
      RH_TESTNET_LENDING_TOKEN_MINT_CAP|RH_TESTNET_COLLATERAL_TOKEN_MINT_CAP|\
      RH_TESTNET_LENDING_SUPPLY_CAP|RH_TESTNET_LENDING_BORROW_CAP|RH_TESTNET_COLLATERAL_CAP|\
      RH_TESTNET_MIN_BORROW_AMOUNT|RH_TESTNET_MAX_ORACLE_AGE|RH_TESTNET_MAX_LTV_BPS|\
      RH_TESTNET_LIQUIDATION_THRESHOLD_BPS|RH_TESTNET_LIQUIDATION_BONUS_BPS|\
      RH_TESTNET_CLOSE_FACTOR_BPS|RH_TESTNET_RESERVE_FACTOR_BPS|RH_TESTNET_OPTIMAL_UTILIZATION_BPS|\
      RH_TESTNET_BASE_BORROW_RATE_BPS|RH_TESTNET_SLOPE1_BPS|RH_TESTNET_SLOPE2_BPS|\
      RH_TESTNET_LENDING_PRICE_MIN_WAD|RH_TESTNET_LENDING_PRICE_MAX_WAD|\
      RH_TESTNET_COLLATERAL_PRICE_MIN_WAD|RH_TESTNET_COLLATERAL_PRICE_MAX_WAD)
        value="${value#\"}"; value="${value%\"}"
        value="${value#\'}"; value="${value%\'}"
        if [[ -z "${!name:-}" ]]; then export "$name=$value"; fi
        ;;
    esac
  done < "$workspace_env"
fi

simulation_args=("$@")
robinhood_profile=false
for argument in "${simulation_args[@]}"; do
  [[ "$argument" == "robinhood_testnet" ]] && robinhood_profile=true
done
if [[ "$robinhood_profile" == true ]]; then
  if [[ -z "${RH_TESTNET_RPC_URL:-}" ]]; then
    echo "Robinhood simulation requires RH_TESTNET_RPC_URL in the workspace environment." >&2
    exit 2
  fi
  for ((index = 0; index < ${#simulation_args[@]}; index++)); do
    if [[ "${simulation_args[index]}" == "--rpc-url" && $((index + 1)) -lt ${#simulation_args[@]} && -z "${simulation_args[index + 1]}" ]]; then
      simulation_args[index + 1]="$RH_TESTNET_RPC_URL"
    fi
  done
fi

simulation_dir="$(mktemp -d /private/tmp/giwa-forge-sim.XXXXXX)"
trap 'rm -rf -- "$simulation_dir"' EXIT

cd "$contracts_dir"
FOUNDRY_OUT="$simulation_dir/out" \
FOUNDRY_CACHE_PATH="$simulation_dir/cache" \
FOUNDRY_BROADCAST="$simulation_dir/broadcast" \
  forge script --force --use ./solc-wrapper.sh "${simulation_args[@]}"
