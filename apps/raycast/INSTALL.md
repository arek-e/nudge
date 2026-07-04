# Nudge Raycast Extension

This archive contains the production build of the Nudge Raycast extension. It is
for internal release QA and does not include TypeScript source, tests, or source
maps.

Raycast does not provide a normal double-click ZIP installer for unpublished
extensions, and local development mode expects the source workspace. To install
the extension locally before it is published, use the repository checkout:

```bash
bun install
bun run raycast:dev
```

For user-facing installation, publish the extension through Raycast:

```bash
bun run raycast:publish
```

That publishes to the Raycast Store, or to a private organization store when the
authenticated Raycast account supports private extensions.
