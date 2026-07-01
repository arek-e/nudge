# Lares iOS

Native SwiftUI App Surface for logging spoken captures into the Lares Engine.

## Run

1. Start the Engine from the repo root:

   ```sh
   bun dev
   ```

2. Open `apps/ios/Lares/Lares.xcodeproj` in Xcode.
3. Run the `Lares` scheme on an iOS Simulator.
4. In the app, use the gear button to edit the Engine URL if your LAN IP changes.

The checked-in default is `http://192.168.76.133:8787` so a plugged-in iPhone can reach the local Engine. For simulator-only testing, `http://127.0.0.1:8787` also works.
If Siri says it cannot reach Lares, check that `bun dev` is running and that `http://192.168.76.133:8787/health` opens from the phone.

## Siri

After the app has launched once on a device, Siri can run the App Intent in the background. From the home screen, invoke Siri and say one of:

```text
Tell Lares
Ask Lares
Capture in Lares
Add to Lares
Remember in Lares
Note to Lares
Log in Lares
Log something in Lares
Log this in Lares
```

Use `Tell Layers` first; the app still displays as Lares, but registers "Layers" as its spoken Siri name because Siri recognizes it more reliably. The app refreshes its App Shortcuts on launch so installed users get this phrase without creating a custom Shortcut.

Siri asks what to log, calls `POST /api/voice/log`, and speaks the Engine response without opening the app. Action-like captures such as "Follow up with Maya tomorrow" are logged as processing candidates, and Lares sends a local notification after the Engine accepts them.
