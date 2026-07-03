# Releasing Desktop And Raycast Apps

Nudge publishes desktop and Raycast downloads through GitHub Releases. The
release workflow is `.github/workflows/release-apps.yml`.

## Release Artifacts

Each tagged app release uploads:

- `Nudge-<version>-universal.dmg`
- `Nudge-<version>-universal.zip`
- `Nudge-Raycast-build-<tag>.zip`

The macOS artifacts are built from `apps/desktop` with Electron Builder. The
Raycast build ZIP is built from `apps/raycast/dist` after `ray build -e dist`
and contains the compiled commands, `package.json`, assets, and a README. It is
an internal QA artifact and does not include TypeScript source, tests, or source
maps.

## Required GitHub Secrets

Public macOS downloads must be signed and notarized. Configure these repository
or environment secrets before cutting a public release:

| Secret                        | Purpose                                   |
| ----------------------------- | ----------------------------------------- |
| `MAC_CSC_LINK`                | Base64-encoded Developer ID `.p12` file   |
| `MAC_CSC_KEY_PASSWORD`        | Password for the Developer ID certificate |
| `APPLE_ID`                    | Apple ID email used for notarization      |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for the Apple ID    |
| `APPLE_TEAM_ID`               | 10-character Apple Developer Team ID      |

The workflow maps `MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD` to Electron Builder's
`CSC_LINK` and `CSC_KEY_PASSWORD` environment variables.

## Cut A Release

1. Make sure `main` is green.
2. Create and push a tag:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. The `Release Apps` workflow checks out the tag, builds signed desktop
   artifacts, builds the Raycast extension, and uploads everything to the
   matching GitHub Release.
4. Open [explorenudge.com](https://explorenudge.com/) and confirm the public
   download links point at the newly attached assets.

For an internal unsigned smoke build, run `Release Apps` manually with
`allow_unsigned_macos=true` and keep the release as a draft. Do not publish
unsigned macOS artifacts as user-facing downloads.

## Raycast Publishing

The public Raycast Store listing is not live yet. Local development install:

```bash
bun install
bun run raycast:dev
```

Tagged GitHub Releases upload `Nudge-Raycast-build-<tag>.zip` as an internal QA
artifact. It is not a normal double-click installer, and it is not the supported
local install path because Raycast development mode expects the source
workspace.

Publish through Raycast when the extension is ready:

```bash
bun run raycast:publish
```

Raycast's CLI opens a submission flow for the public Store or publishes to an
organization private store when the authenticated Raycast account supports it.
