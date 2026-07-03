# Deployment

Nudge deploys should be tied to Git commits so Cloudflare Worker versions, trace logs, and rollback decisions can be mapped back to source code.

## Normal Flow

1. Finish one vertical slice.
2. Run checks locally.
3. Commit the slice.
4. Deploy from the clean working tree.

```bash
bun run check
bun run test:e2e
git status --short
git add <intended files>
git commit -m "short slice summary"
bun run deploy
```

`bun run deploy` refuses to deploy when the working tree has uncommitted changes. It runs the full check suite, mobile Playwright smoke test, web build, and `wrangler deploy`.

`bun run deploy` targets the `production` Wrangler environment. Use the explicit scripts when checking environment-specific behavior:

```bash
bun run deploy:staging
bun run deploy:production
```

The staging Worker is `nudge-web-staging` at `https://app.staging.explorenudge.com`, with `https://nudge-web-staging.teampitch.workers.dev` retained as the Cloudflare account fallback. The production Worker is `nudge-web` at `https://app.explorenudge.com`, with `https://nudge-web.teampitch.workers.dev` retained as the Cloudflare account fallback.

The web deploy script injects client-side Convex and Clerk settings before the Vite build:

- Staging Convex: `https://abundant-retriever-130.eu-west-1.convex.cloud`
- Production Convex: `https://friendly-lion-904.eu-west-1.convex.cloud`
- Local/dev Convex: `https://grandiose-hamster-855.eu-west-1.convex.cloud`
- Staging Clerk app: `Nudge Staging`
- Production Clerk app: `Nudge`
- Staging web lockup: `/icons/nudge-logo-lockup-blobby-n-transparent.svg`

Before the first staging deploy, provision the staging Cloudflare resources named in `apps/web/wrangler.jsonc` or let Wrangler resolve/create supported resources where available:

- R2: `nudge-staging-media`, `nudge-staging-okf-files`
- Workflow: `daily-digest-workflow-staging`

The iOS app has matching shared Xcode schemes: `Vesta Local`, `Vesta Staging`, and `Vesta Production`. The local scheme installs as `app.vesta.ios.local` and points at the local Worker plus the dev Convex deployment. The staging scheme installs as `app.vesta.ios.staging`, uses the `AppIconStaging` beta icon, and points at the staging Worker, staging Clerk app, and staging Convex deployment. The production scheme installs as `app.vesta.ios`, uses the normal `AppIcon`, and points at the production Worker and production Convex deployment.

Production Clerk still uses the existing Clerk development instance. Run `clerk deploy` from an interactive terminal to create the production Clerk instance; it requires a production domain, DNS access, and Apple/Google OAuth credentials.

## Version Stamping

Deploys set `APP_VERSION` to the short Git SHA with Wrangler `--var`. Wide request logs and `/api/version` expose this value, so an agent can connect production behavior back to the deployed commit.

The deploy command also sets the Cloudflare Worker version tag and message to the same SHA.

`scripts/deploy-web.ts --version=<tag>` overrides the version stamp. The production release workflow uses this so `/api/version`, Worker version metadata, the Git tag, and the GitHub Release all share the same release tag.

## Production Releases

Production releases are created manually from GitHub Actions via **Release Production**.

The workflow:

1. Computes a tag, defaulting to UTC CalVer `vYYYY.MM.DD.HHMM`.
2. Generates GitHub release notes from merged changes since the previous tag.
3. Runs the normal production deploy with `APP_VERSION=<tag>`.
4. Creates and pushes the Git tag.
5. Creates a GitHub Release with the generated notes.

Required repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Use the optional `tag` input for a specific release tag. Leave it blank for automatic UTC CalVer, for example `v2026.06.21.1430`.

## Prototype Override

For explicit prototype deploys from a dirty tree:

```bash
bun run deploy:dirty
```

This stamps the version as `<sha>-dirty`. Do not use this for normal QA checkpoints.

## Rollback

Preferred rollback paths:

- Cloudflare rollback to a previous Worker version when the deployed artifact is bad and immediate recovery is needed.
- `git revert <commit>` followed by `bun run deploy` when source history should record the reversal.

After rollback, verify:

```bash
curl https://app.explorenudge.com/health
bun run logs:tail
```

## Pull Requests

Early solo development may use direct commits to `main`, but any slice that changes schema, deployment config, auth, agent behavior, evals, or public API contracts should go through a PR before deploy.
