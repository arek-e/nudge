# Vesta iOS Agent Instructions

Scope: this file applies to work under `apps/ios/Vesta`. Keep it short, current, and operational. Put long design history in `docs/` and keep this file focused on the commands, boundaries, and architecture rules an agent must follow while editing the iOS app.

## Architecture

The iOS app is a SwiftUI App Surface backed by The Composable Architecture.

- `VestaRootFeature` in `Vesta/VestaAuth.swift` owns authenticated root state.
- `VestaCaptureFeature` in `Vesta/VestaCaptureFeature.swift` owns capture, navigation, sheet/modal state, refresh, submission, local note sync, network reachability, streak persistence, and settings sign-out effects.
- SwiftUI views receive `StoreOf<VestaCaptureFeature>` or scoped stores and send actions. They should not create app-level `@StateObject` view models for product state.
- `VestaCaptureViewModel.swift` is intentionally no longer a view model. It only hosts capture attachment/result value types that are still used by the reducer and views.
- Keep pure policies in `VestaPresentation.swift`, `VestaAPI.swift`, and `CalendarStats.swift` as small deterministic domain seams. Reducers should call those policies instead of duplicating their rules.

## State And Effects

- Put durable app state in TCA reducer `State`.
- Put user intent and lifecycle events in reducer `Action`.
- Put async work behind dependency clients registered with `DependencyValues`.
- Keep Engine HTTP calls behind `VestaAPIClient`.
- Keep Convex/local-note behavior behind `VestaNoteSyncClient`.
- Keep auth behavior behind `VestaAuthClient`.
- Keep network reachability behind `VestaNetworkStatusClient`.
- Keep streak persistence behind `VestaStreakClient`.

Do not reintroduce broad observable view models for capture, auth, sync, onboarding, or settings. If a feature needs state and effects, add a reducer or compose a child reducer.

Small UIKit/AVFoundation bridge objects may still use local observable objects when they are adapter state only, such as the voice recorder helper. Do not let those objects own product workflow state.

## SwiftUI Conventions

- Views render state and send actions.
- Use `@Bindable var store` when a view needs TCA bindings.
- For optional sheet/full-screen-cover presentation, prefer explicit reducer actions such as `presentedResultChanged`, `imagePickerSourceChanged`, or `voiceRecorderOpenChanged`.
- Keep focus, scroll, and tiny control-local state in SwiftUI when it is purely presentational and not part of product behavior.

## Testing And Verification

This project does not currently have a native XCTest target. Existing iOS verification is build/self-test oriented.

- Use behavior-focused policy self-tests for deterministic rules.
- Use reducer tests if/when a native test target is added.
- Before handoff after iOS state, dependency, or view changes, verify the app with:

```sh
xcodebuild -skipMacroValidation -project apps/ios/Vesta/Vesta.xcodeproj -scheme Vesta -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' build
```

Plain `xcodebuild` may stop until Xcode trusts the TCA macro packages. In Xcode, accept the macro trust prompt for Point-Free/TCA dependencies.

Also keep the existing iOS-adjacent Bun tests passing:

```sh
bun test apps/ios/Vesta/ios-branding.test.ts
```

For architecture migrations, also check that broad legacy view-model state has not returned:

```sh
rg "VestaCaptureViewModel|@StateObject private var model|@ObservedObject var model" apps/ios/Vesta/Vesta
```

## Migration Guardrails

- Do not move Vesta Engine rules into the iOS app. The app is an App Surface; durable product behavior belongs behind the Engine.
- Do not parse server responses ad hoc in views. Decode at the API/client boundary.
- Do not add Alamofire, image libraries, Redux-like state libraries, or alternate architecture frameworks unless a concrete app pressure justifies them.
- Do not document SwiftLint, SwiftFormat, or another formatter/linter as required until the repo has committed config and an exact command for it.
- Do not split every tiny view into a reducer. Use TCA for screens, flows, async effects, shared domain state, and testable workflow logic. Use plain SwiftUI components for local presentation.

## Maintenance

- Update this file when the iOS architecture, dependency clients, verification commands, or repeated agent mistakes change.
- Remove stale instructions instead of layering exceptions on top.
- Use scripts, CI, hooks, or project settings for hard enforcement. Treat this file as agent guidance, not a replacement for tooling.
