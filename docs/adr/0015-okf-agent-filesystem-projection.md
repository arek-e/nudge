# OKF Agent Filesystem Projection

Nudge exposes a user's Workspace Boundary to agents as a read-only OKF-style filesystem projection generated from canonical D1 records, then materializes that projection into Cloudflare Sandbox when a container-backed agent needs normal filesystem tools such as `find`, `grep`, and `cat`. OKF is not the canonical store, a replacement for `llms.txt`, or a write path; it is an agent-searchable index layer over daily notes, extracted items, memory, and summaries. This keeps user data scoped by the authenticated user, preserves the existing Review and persistence paths for writes, and lets future FUSE/VFS-style mounts share the same projection contract instead of duplicating data export logic.

## Decision

Nudge keeps OKF as a generated, read-only projection at the workspace boundary. The Worker API exposes the same projection through HTTP and MCP, while Cloudflare Sandbox receives the projection as POSIX paths under `/workspace/okf`.

On Cloudflare, the preferred runtime path writes the projection into the `OKF_FILES` R2 bucket under a user-scoped prefix and mounts that prefix read-only with `sandbox.mountBucket()`. This gives agents a real mounted filesystem surface without making OKF files canonical. If bucket mounting is unavailable, Nudge falls back to clearing only the OKF sandbox root before writing the current projection directly.

Agent writes stay outside the OKF filesystem. Agents can create reviewable proposals, and the existing Review flow decides whether a proposal becomes a committed user record.

## FUSE and POSIX Paths

Cloudflare Sandbox bucket mounts are the supported FUSE-backed path for object storage. Nudge uses that path instead of shipping a custom kernel FUSE adapter.

A custom FUSE adapter remains a runtime-specific adapter, not the product contract. It should only be added when Nudge has a native/local runtime that needs live D1/API-backed mount semantics. That adapter must keep the same read-only projection rules, use a narrow mount prefix, and route writes through proposals rather than mutating OKF files directly.

## Consequences

Agents get searchable files, MCP resources, and stable OKF metadata without making Markdown files the source of truth. The tradeoff is that Sandbox agents see a mounted snapshot of the latest projection; if canonical data changes, Nudge refreshes the R2 prefix before the next run.
