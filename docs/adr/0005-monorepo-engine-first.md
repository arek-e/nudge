# Monorepo, Engine First

Lares starts as a monorepo with one Lares Engine app at `apps/engine`. The Engine is a Cloudflare Worker that contains API routes, Workers Workflows, and Cloudflare Agents SDK entrypoints behind clear internal module boundaries. This keeps the first product loop easy to deploy and reason about, while preserving the option to split Workers or packages later when runtime limits, ownership, or scaling needs justify the extra deployment complexity.

User-facing App Surfaces live separately under flat `apps/` directories and stay thin over the Lares Engine API: `apps/web`, `apps/ios`, and future `apps/android`, `apps/macos`, `apps/windows`, `apps/linux`, or `apps/raycast` may own platform presentation and interaction details, but durable product logic belongs in the Engine and shared domain packages. In-repo TypeScript surfaces consume `packages/engine-contract`; they should not import the deployable `apps/engine` package.
