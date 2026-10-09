#!/usr/bin/env bash
set -euo pipefail

# Foundry passes --allow-paths to native solc; solc-js does not recognize it.
forwarded=()
while (($#)); do
  if [[ "$1" == "--allow-paths" ]]; then
    shift
    (($#)) && shift
  else
    forwarded+=("$1")
    shift
  fi
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ " ${forwarded[*]} " == *" --standard-json "* ]]; then
  temp_dir="$(mktemp -d /private/tmp/giwa-solc.XXXXXX)"
  trap 'rm -rf "$temp_dir"' EXIT
  cat >"$temp_dir/compiler-input.json"
  status=0
  "$script_dir/../node_modules/.bin/solcjs" "${forwarded[@]}" <"$temp_dir/compiler-input.json" >"$temp_dir/compiler-output.json" || status=$?
  sed '/^>>> /d' "$temp_dir/compiler-output.json"
  exit "$status"
else
  exec "$script_dir/../node_modules/.bin/solcjs" "${forwarded[@]}"
fi
