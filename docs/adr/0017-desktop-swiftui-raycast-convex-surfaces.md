# Desktop, SwiftUI, Raycast, And Convex Surfaces

Nudge uses a desktop App Surface, SwiftUI for the iOS App Surface, a Raycast extension for fast command capture and review, and the web app as the browser App Surface. Convex is the canonical realtime product store across those surfaces, while the Nudge Engine stays behind the agent loop for reasoning, tool execution, review boundaries, and integration behavior.

Web and desktop should share React surface logic wherever the experience overlaps: capture flows, note and sticky-note editing, review queues, Convex query/mutation hooks, design primitives, and any Tiptap or ProseMirror-based editor modules. The desktop shell should stay thin and own desktop concerns such as windows, tray/menu behavior, global shortcuts, notifications, and OS permissions rather than forking product behavior from the web app.

Shared behavior should be enforced through package seams, not convention alone: reusable Engine workflow sequencing belongs in `@nudge/effect-services`, shared non-visual App Surface logic belongs in `@nudge/surface`, and reusable React presentation belongs in `@nudge/ui`. App packages should compose those seams instead of copying product rules locally.

SwiftUI remains the iOS choice because mobile capture, Siri/App Intents, calendar permissions, notifications, and native review affordances matter more there than sharing a React editor. Raycast remains a TypeScript command surface for low-friction capture, current context, asking Nudge, and lightweight review, but it should call the Engine API or auth-scoped Convex functions instead of owning agent logic or using runtime Convex secrets.

This keeps the product feeling like one notes and sticky-notes system that works anywhere, while avoiding four separate clients with four separate interpretations of the Nudge loop. React Native or Expo can be revisited later if cross-platform mobile velocity becomes more important than the current SwiftUI/Siri advantages, but it is not the current iOS replacement path.
