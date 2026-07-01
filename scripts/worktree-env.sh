vesta_resolve_worktree_root() {
  if [ "${1:-}" != "" ]; then
    printf "%s\n" "$1"
    return
  fi

  git rev-parse --show-toplevel 2>/dev/null || pwd
}

vesta_high_band_port_for_root() {
  root="$1"
  checksum="$(printf "%s" "$root" | cksum | awk '{ print $1 }')"
  printf "%s\n" "$((40000 + (checksum % 210) * 100))"
}

vesta_export_if_unset() {
  name="$1"
  value="$2"
  eval "current_value=\"\${$name:-}\""
  if [ "$current_value" = "" ]; then
    export "$name=$value"
  fi
}

vesta_export_worktree_env() {
  root="$(vesta_resolve_worktree_root "${1:-}")"

  vesta_export_if_unset VESTA_WORKTREE_ROOT "$root"
  vesta_export_if_unset VESTA_DEV_PORT "$(vesta_high_band_port_for_root "$root")"
  vesta_export_if_unset VESTA_DEV_URL "http://localhost:${VESTA_DEV_PORT}"
  vesta_export_if_unset VESTA_WRANGLER_INSPECTOR_PORT "$((VESTA_DEV_PORT + 1))"
  vesta_export_if_unset VESTA_WRANGLER_PERSIST_TO \
    "${root}/apps/engine/.wrangler/state"
  vesta_export_if_unset BETTER_AUTH_URL "$VESTA_DEV_URL"
}
