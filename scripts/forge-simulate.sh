#!/usr/bin/env bash
set -euo pipefail

if (($# == 0)); then
  echo "usage: bun run deployment:simulate -- <script:Contract> [forge script options]" >&2
  exit 2
fi

for argument in "$@"; do
  case "$argument" in
    --broadcast|--broadcast=*|--resume|--verify|--account|--account=*|--private-key|--private-key=*|--keystore|--keystore=*|--mnemonic|--mnemonic=*|--ledger|--trezor)
      echo "deployment:simulate refuses broadcast, verification, and signer options: $argument" >&2
      exit 2
      ;;
  esac
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
contracts_dir="$(cd -- "$script_dir/../contracts" && pwd)"
simulation_dir="$(mktemp -d /private/tmp/giwa-forge-sim.XXXXXX)"
trap 'rm -rf -- "$simulation_dir"' EXIT

cd "$contracts_dir"
FOUNDRY_OUT="$simulation_dir/out" \
FOUNDRY_CACHE_PATH="$simulation_dir/cache" \
FOUNDRY_BROADCAST="$simulation_dir/broadcast" \
  forge script --force --use ./solc-wrapper.sh "$@"
