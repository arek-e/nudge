# Deployment

Lares deploys should be tied to Git commits so Cloudflare Worker versions, trace logs, and rollback decisions can be mapped back to source code.

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

## Version Stamping

Deploys set `APP_VERSION` to the short Git SHA with Wrangler `--var`. Wide request logs and `/api/version` expose this value, so an agent can connect production behavior back to the deployed commit.

The deploy command also sets the Cloudflare Worker version tag and message to the same SHA.

`scripts/deploy-web.ts --version=<tag>` overrides the version stamp. The production release workflow uses this so `/api/version`, Worker version metadata, the Git tag, and the GitHub Release all share the same release tag.

## Production Releases

Production releases are created manually from GitHub Actions via **Release Production**.

The workflow:

1. Computes a tag, defaulting to UTC CalVer `vYYYY.MM.DD.HHMM`.
2. Generates GitHub release notes from merged changes since the previous tag.
3. Optionally applies remote D1 migrations.
4. Runs the normal production deploy with `APP_VERSION=<tag>`.
5. Creates and pushes the Git tag.
6. Creates a GitHub Release with the generated notes.

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
curl https://lares-web.teampitch.workers.dev/health
bun run traces:recent
```

## Pull Requests

Early solo development may use direct commits to `main`, but any slice that changes schema, deployment config, auth, agent behavior, evals, or public API contracts should go through a PR before deploy.
