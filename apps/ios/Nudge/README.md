# Nudge iOS

Native SwiftUI App Surface for logging spoken captures into the Nudge Engine.

## Run

1. For local simulator work, start the Engine from the repo root:

   ```sh
   bun dev
   ```

2. Open `apps/ios/Nudge/Nudge.xcodeproj` in Xcode.
3. Pick the scheme for the environment you want:

| Scheme             | Build config | Bundle id               | Icon             | Engine URL                                        | Convex URL                                              |
| ------------------ | ------------ | ----------------------- | ---------------- | ------------------------------------------------- | ------------------------------------------------------- |
| `Nudge Local`      | `Debug`      | `app.nudge.ios.local`   | `AppIcon`        | `http://localhost:8787`                           | `https://grandiose-hamster-855.eu-west-1.convex.cloud`  |
| `Nudge Staging`    | `Staging`    | `app.nudge.ios.staging` | `AppIconStaging` | `https://nudge-web-staging.teampitch.workers.dev` | `https://abundant-retriever-130.eu-west-1.convex.cloud` |
| `Nudge Production` | `Release`    | `app.nudge.ios`         | `AppIcon`        | `https://nudge-web.teampitch.workers.dev`         | `https://friendly-lion-904.eu-west-1.convex.cloud`      |

Settings shows the active environment and Engine URL on-device. Use `Nudge Staging` for physical iPhone QA unless you explicitly need to test the local simulator flow.

The staging iOS build has a separate bundle id, Engine endpoint, Clerk app, and Convex deployment. Use `Nudge Production` only when you want the app to talk to the production Worker and production Convex deployment.

Production Clerk still uses the existing Clerk development instance until `clerk deploy` is completed with a production domain, DNS access, and OAuth credentials.

## Siri

After the app has launched once on a device, Siri can run the App Intent in the background. From the home screen, invoke Siri and say one of:

```text
Tell Nudge
Ask Nudge
Capture in Nudge
Add to Nudge
Remember in Nudge
Note to Nudge
Log in Nudge
Log something in Nudge
Log this in Nudge
```

The app registers Nudge as its spoken Siri name and refreshes App Shortcuts on launch so installed users get these phrases without creating a custom Shortcut.

Siri asks what to log, calls `POST /api/voice/log`, and speaks the Engine response without opening the app. Action-like captures such as "Follow up with Maya tomorrow" are logged as processing candidates, and Nudge sends a local notification after the Engine accepts them.
