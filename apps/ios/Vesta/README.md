# Vesta iOS

Native SwiftUI App Surface for logging spoken captures into the Vesta Engine.

## Run

1. Start the Engine from the repo root:

   ```sh
   bun dev
   ```

2. Open `apps/ios/Vesta/Vesta.xcodeproj` in Xcode.
3. Run the `Vesta` scheme on an iOS Simulator.
4. In the app, use the gear button to edit the Engine URL if your LAN IP changes.

The checked-in default is `http://192.168.76.133:8787` so a plugged-in iPhone can reach the local Engine. For simulator-only testing, `http://127.0.0.1:8787` also works.
If Siri says it cannot reach Vesta, check that `bun dev` is running and that `http://192.168.76.133:8787/health` opens from the phone.

## Siri

After the app has launched once on a device, Siri can run the App Intent in the background. From the home screen, invoke Siri and say one of:

```text
Tell Vesta
Ask Vesta
Capture in Vesta
Add to Vesta
Remember in Vesta
Note to Vesta
Log in Vesta
Log something in Vesta
Log this in Vesta
```

The app registers Vesta as its spoken Siri name and refreshes App Shortcuts on launch so installed users get these phrases without creating a custom Shortcut.

Siri asks what to log, calls `POST /api/voice/log`, and speaks the Engine response without opening the app. Action-like captures such as "Follow up with Maya tomorrow" are logged as processing candidates, and Vesta sends a local notification after the Engine accepts them.
