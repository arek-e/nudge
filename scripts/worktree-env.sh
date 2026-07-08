nudge_resolve_worktree_root() {
  if [ "${1:-}" != "" ]; then
    printf "%s\n" "$1"
    return
  fi

  git rev-parse --show-toplevel 2>/dev/null || pwd
}

nudge_high_band_port_for_root() {
  root="$1"
  checksum="$(printf "%s" "$root" | cksum | awk '{ print $1 }')"
  printf "%s\n" "$((40000 + (checksum % 210) * 100))"
}

nudge_export_if_unset() {
  name="$1"
  value="$2"
  eval "current_value=\"\${$name:-}\""
  if [ "$current_value" = "" ]; then
    export "$name=$value"
  fi
}

nudge_export_worktree_env() {
  root="$(nudge_resolve_worktree_root "${1:-}")"

  nudge_export_if_unset NUDGE_WORKTREE_ROOT "$root"
  nudge_export_if_unset NUDGE_DEV_PORT "$(nudge_high_band_port_for_root "$root")"
  nudge_export_if_unset NUDGE_DEV_URL "http://localhost:${NUDGE_DEV_PORT}"
  nudge_export_if_unset NUDGE_WRANGLER_INSPECTOR_PORT "$((NUDGE_DEV_PORT + 1))"
  nudge_export_if_unset NUDGE_WRANGLER_PERSIST_TO \
    "${root}/apps/engine/.wrangler/state"
  nudge_export_if_unset CLERK_PUBLISHABLE_KEY \
    "pk_test_dWx0aW1hdGUta2l3aS05Mi5jbGVyay5hY2NvdW50cy5kZXYk"
  nudge_export_if_unset VITE_CLERK_PUBLISHABLE_KEY "$CLERK_PUBLISHABLE_KEY"
  nudge_export_if_unset CLERK_AUTHORIZED_PARTIES \
    "${NUDGE_DEV_URL},http://127.0.0.1:${NUDGE_DEV_PORT},https://app.explorenudge.com,https://nudge-web.teampitch.workers.dev"
  nudge_export_if_unset CONVEX_URL \
    "https://grandiose-hamster-855.eu-west-1.convex.cloud"
  nudge_export_if_unset VITE_CONVEX_URL "$CONVEX_URL"
  nudge_export_if_unset CONVEX_DEPLOYMENT "dev:grandiose-hamster-855"
}
