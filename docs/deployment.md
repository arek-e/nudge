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
