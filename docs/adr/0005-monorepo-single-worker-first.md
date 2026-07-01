# Monorepo, Single Worker First

Vesta starts as a monorepo with one Cloudflare Worker app that contains API routes, Workers Workflows, and Cloudflare Agents SDK entrypoints behind clear internal module boundaries. This keeps the first product loop easy to deploy and reason about, while preserving the option to split Workers or packages later when runtime limits, ownership, or scaling needs justify the extra deployment complexity.
