#!/usr/bin/env bash
set -euo pipefail

contracts_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
action="${1:-test}"
shift || true

case "$action" in
  test) exec forge test --root "$contracts_dir" --use "$contracts_dir/solc-wrapper.sh" -vvv "$@" ;;
  build) exec forge build --root "$contracts_dir" --use "$contracts_dir/solc-wrapper.sh" "$@" ;;
  *) echo "usage: run-forge.sh {test|build} [forge options...]" >&2; exit 2 ;;
esac
