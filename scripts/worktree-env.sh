lares_resolve_worktree_root() {
  if [ "${1:-}" != "" ]; then
    printf "%s\n" "$1"
    return
  fi

  git rev-parse --show-toplevel 2>/dev/null || pwd
}

lares_high_band_port_for_root() {
  root="$1"
  checksum="$(printf "%s" "$root" | cksum | awk '{ print $1 }')"
  printf "%s\n" "$((40000 + (checksum % 210) * 100))"
}

lares_export_if_unset() {
  name="$1"
  value="$2"
  eval "current_value=\"\${$name:-}\""
  if [ "$current_value" = "" ]; then
    export "$name=$value"
  fi
}

lares_export_worktree_env() {
  root="$(lares_resolve_worktree_root "${1:-}")"

  lares_export_if_unset LARES_WORKTREE_ROOT "$root"
  lares_export_if_unset LARES_DEV_PORT "$(lares_high_band_port_for_root "$root")"
  lares_export_if_unset LARES_DEV_URL "http://localhost:${LARES_DEV_PORT}"
  lares_export_if_unset LARES_WRANGLER_INSPECTOR_PORT "$((LARES_DEV_PORT + 1))"
  lares_export_if_unset LARES_WRANGLER_PERSIST_TO \
    "${root}/apps/engine/.wrangler/state"
  lares_export_if_unset BETTER_AUTH_URL "$LARES_DEV_URL"
}
