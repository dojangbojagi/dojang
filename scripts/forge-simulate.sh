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
    [[ "$line" =~ ^[[:space:]]*((RH_TESTNET|RH_MAINNET)_[A-Za-z0-9_]+)[[:space:]]*=(.*)$ ]] || continue
    name="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[3]}"
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
      RH_TESTNET_COLLATERAL_PRICE_MIN_WAD|RH_TESTNET_COLLATERAL_PRICE_MAX_WAD|\
      RH_TESTNET_CREDENTIAL_REGISTRY_ADDRESS|RH_TESTNET_VERIFIER_ADAPTER_ADDRESS|\
      RH_TESTNET_LENDING_V2_POOL_ADDRESS|RH_TESTNET_PHASE2_DEPLOYER_ADDRESS|\
      RH_TESTNET_PHASE2_ADMIN_ADDRESS|RH_TESTNET_PHASE2_MEMBERSHIP_ISSUER_ADDRESS|\
      RH_TESTNET_PHASE2_REPUTATION_ISSUER_ADDRESS|RH_TESTNET_PHASE2_PAUSE_AUTHORITY_ADDRESS|\
      RH_TESTNET_PHASE2_COMMIT_PERIOD|RH_TESTNET_PHASE2_REVEAL_PERIOD|\
      RH_TESTNET_PHASE2_EXECUTION_WINDOW|RH_TESTNET_PHASE2_QUORUM|RH_TESTNET_PHASE2_MINIMUM_REPUTATION)
        value="${value#\"}"; value="${value%\"}"
        value="${value#\'}"; value="${value%\'}"
        if [[ -z "${!name+x}" ]]; then export "$name=$value"; fi
        ;;
      RH_MAINNET_RPC_URL|RH_MAINNET_DEPLOYER_ADDRESS|RH_MAINNET_ADMIN_ADDRESS|\
      RH_MAINNET_ISSUER_ADDRESS|RH_MAINNET_ORACLE_UPDATER_ADDRESS|RH_MAINNET_RISK_ADMIN_ADDRESS|\
      RH_MAINNET_PAUSE_AUTHORITY_ADDRESS|RH_MAINNET_DEMO_MINTER_ADDRESS|\
      RH_MAINNET_DEMO_PARTICIPANT_A_ADDRESS|RH_MAINNET_DEMO_PARTICIPANT_B_ADDRESS|\
      RH_MAINNET_DEMO_GOVERNANCE_VOTING_PERIOD|RH_MAINNET_DEMO_GOVERNANCE_QUORUM|\
      RH_MAINNET_DEMO_GOVERNANCE_EXECUTION_WINDOW|RH_MAINNET_DEMO_GOVERNANCE_INITIAL_MIN_VALIDITY|\
      RH_MAINNET_DEMO_LOAN_MINT_CAP|RH_MAINNET_DEMO_COLLATERAL_MINT_CAP|\
      RH_MAINNET_DEMO_LENDING_SUPPLY_CAP|RH_MAINNET_DEMO_LENDING_BORROW_CAP|\
      RH_MAINNET_DEMO_COLLATERAL_CAP|RH_MAINNET_DEMO_MIN_BORROW_AMOUNT|\
      RH_MAINNET_DEMO_MAX_ORACLE_AGE|RH_MAINNET_DEMO_MAX_LTV_BPS|\
      RH_MAINNET_DEMO_LIQUIDATION_THRESHOLD_BPS|RH_MAINNET_DEMO_LIQUIDATION_BONUS_BPS|\
      RH_MAINNET_DEMO_CLOSE_FACTOR_BPS|RH_MAINNET_DEMO_RESERVE_FACTOR_BPS|\
      RH_MAINNET_DEMO_OPTIMAL_UTILIZATION_BPS|RH_MAINNET_DEMO_BASE_BORROW_RATE_BPS|\
      RH_MAINNET_DEMO_SLOPE1_BPS|RH_MAINNET_DEMO_SLOPE2_BPS|\
      RH_MAINNET_DEMO_LOAN_PRICE_MIN_WAD|RH_MAINNET_DEMO_LOAN_PRICE_MAX_WAD|\
      RH_MAINNET_DEMO_COLLATERAL_PRICE_MIN_WAD|RH_MAINNET_DEMO_COLLATERAL_PRICE_MAX_WAD|\
      RH_MAINNET_CREDENTIAL_REGISTRY_ADDRESS|RH_MAINNET_VERIFIER_ADAPTER_ADDRESS|RH_MAINNET_DEMO_LENDING_POOL_ADDRESS|\
      RH_MAINNET_PHASE2_COMMIT_PERIOD|RH_MAINNET_PHASE2_REVEAL_PERIOD|RH_MAINNET_PHASE2_EXECUTION_WINDOW|\
      RH_MAINNET_PHASE2_QUORUM|RH_MAINNET_PHASE2_MINIMUM_REPUTATION)
        value="${value#\"}"; value="${value%\"}"
        value="${value#\'}"; value="${value%\'}"
        if [[ -z "${!name+x}" ]]; then export "$name=$value"; fi
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

robinhood_mainnet_profile=false
for argument in "${simulation_args[@]}"; do
  [[ "$argument" == "robinhood_mainnet" ]] && robinhood_mainnet_profile=true
done
if [[ "$robinhood_mainnet_profile" == true ]]; then
  if [[ -z "${RH_MAINNET_RPC_URL:-}" ]]; then
    echo "Robinhood Mainnet demo simulation requires RH_MAINNET_RPC_URL." >&2
    exit 2
  fi
  has_explicit_mainnet_chain=false
  for ((index = 0; index < ${#simulation_args[@]}; index++)); do
    if [[ "${simulation_args[index]}" == "--chain-id" ]]; then
      if (( index + 1 >= ${#simulation_args[@]} )) || [[ "${simulation_args[index + 1]}" != "4663" ]]; then
        echo "Robinhood Mainnet demo simulation requires explicit --chain-id 4663." >&2
        exit 2
      fi
      has_explicit_mainnet_chain=true
    elif [[ "${simulation_args[index]}" == "--chain-id=4663" ]]; then
      has_explicit_mainnet_chain=true
    elif [[ "${simulation_args[index]}" == "--rpc-url" ]] && (( index + 1 < ${#simulation_args[@]} )) && [[ -z "${simulation_args[index + 1]}" ]]; then
      simulation_args[index + 1]="$RH_MAINNET_RPC_URL"
    fi
  done
  if [[ "$has_explicit_mainnet_chain" != true ]]; then
    echo "Robinhood Mainnet demo simulation refuses an implicit chain ID; pass --chain-id 4663." >&2
    exit 2
  fi
  actual_chain_id=""
  for attempt in 1 2 3; do
    if actual_chain_id="$(cast chain-id --rpc-timeout 8 --rpc-url "$RH_MAINNET_RPC_URL" 2>/dev/null)"; then
      break
    fi
    if (( attempt < 3 )); then
      echo "Robinhood Mainnet chain-ID RPC check failed (attempt $attempt/3); retrying in 1 second." >&2
      sleep 1
    fi
  done
  if [[ -z "$actual_chain_id" ]]; then
    echo "Could not read the configured Robinhood Mainnet RPC chain ID after 3 bounded attempts." >&2
    exit 2
  fi
  if [[ "$actual_chain_id" != "4663" ]]; then
    echo "Robinhood Mainnet RPC returned chain ID $actual_chain_id; expected 4663." >&2
    exit 2
  fi
fi

simulation_dir="$(mktemp -d /private/tmp/giwa-forge-sim.XXXXXX)"
trap 'rm -rf -- "$simulation_dir"' EXIT

cd "$contracts_dir"
run_forge_script() {
  FOUNDRY_OUT="$simulation_dir/out" \
  FOUNDRY_CACHE_PATH="$simulation_dir/cache" \
  FOUNDRY_BROADCAST="$simulation_dir/broadcast" \
    forge script --force --use ./solc-wrapper.sh "$@"
}

redact_rpc_url() {
  python3 -c 'import os,sys; s=sys.stdin.read(); u=os.environ.get("RH_MAINNET_RPC_URL", ""); sys.stdout.write(s.replace(u, "<configured Robinhood Mainnet RPC>") if u else s)' < "$1"
}

if [[ "$robinhood_mainnet_profile" == true ]]; then
  for attempt in 1 2; do
    attempt_log="$simulation_dir/mainnet-attempt-$attempt.log"
    if run_forge_script "${simulation_args[@]}" >"$attempt_log" 2>&1; then
      redact_rpc_url "$attempt_log"
      exit 0
    else
      forge_status=$?
    fi
    if grep -Eiq 'connection reset|connection error|timed out|timeout|failed to retrieve chain ID from fork endpoint|could not connect|transport error' "$attempt_log"; then
      if (( attempt < 2 )); then
        echo "Transient Robinhood RPC failure during Mainnet simulation (attempt 1/2); retrying once in 2 seconds." >&2
        sleep 2
        continue
      fi
      redact_rpc_url "$attempt_log" >&2
      echo "Mainnet simulation failed after 2 bounded attempts; check RH_MAINNET_RPC_URL or use a dedicated RPC endpoint." >&2
      exit "$forge_status"
    fi
    redact_rpc_url "$attempt_log" >&2
    exit "$forge_status"
  done
else
  run_forge_script "${simulation_args[@]}" || exit $?
fi
