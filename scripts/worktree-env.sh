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

  nudge_export_if_unset VESTA_WORKTREE_ROOT "$NUDGE_WORKTREE_ROOT"
  nudge_export_if_unset VESTA_DEV_PORT "$NUDGE_DEV_PORT"
  nudge_export_if_unset VESTA_DEV_URL "$NUDGE_DEV_URL"
  nudge_export_if_unset VESTA_WRANGLER_INSPECTOR_PORT "$NUDGE_WRANGLER_INSPECTOR_PORT"
  nudge_export_if_unset VESTA_WRANGLER_PERSIST_TO "$NUDGE_WRANGLER_PERSIST_TO"
}

vesta_export_worktree_env() {
  nudge_export_worktree_env "$@"
}
