# Frontend State

Nudge frontend state is split by ownership, not by framework convenience. Notes, agent chat,
derived tasks, and reviewable work are product state with multiple writers. Panel toggles,
selected tabs, and visual preferences are UI state. Editor keystrokes are local editing state.

This document applies to the web and desktop React App Surfaces, and to shared React surface
logic that later moves into `@nudge/surface` or `@nudge/ui`.

## State Ownership

### Canonical Product State

Canonical product state lives in Convex and is reached through auth-scoped surface functions or
the Nudge Engine API. This includes:

- daily notes and note blocks
- agent conversations and messages
- agent run outputs, tool calls, and receipts
- tasks, proposals, reviews, commitments, and outcomes derived from notes
- source links and provenance from notes, captures, files, calendar events, and agent runs

The browser must not treat Zustand, React component state, TipTap editor state, Cloudflare Agent
state, or local storage as canonical for these records. Those layers can cache, draft, stream, or
optimistically render product state, but persisted user-visible state belongs behind the canonical
store boundary described in `docs/adr/0016-convex-canonical-store-cloudflare-runtime.md`.

### Editor Session State

The note editor owns live editing state while the user is typing:

- TipTap/ProseMirror document state
- text selection and focus
- undo and redo history
- temporary composition state
- unsaved draft text between debounce saves

Do not mirror every editor transaction into global state. The editor should emit debounced,
version-aware save intents through a small hook or controller. If the agent modifies the open
note, apply a patch or command that preserves the editor session where possible instead of
replacing the whole editor body.

### Frontend Domain State

Use a named frontend domain state layer when multiple visible surfaces need a coordinated view of
the same product domain. Notes, the agent chat, and derived tasks cross that threshold because the
same action can affect the editor, the agent rail, the review queue, and navigation badges.

This layer should coordinate:

- current daily note query state
- local draft status, save status, and conflict status
- streamed agent messages for the active workspace or note
- optimistic task/proposal creation from note blocks
- invalidation or patching after agent commands complete

The preferred future shape is an Effect Atom style domain layer for this coordination, following
the discipline in `docs/architecture/layers-and-services.md` without copying T3Code's full
runtime. Until that layer is introduced, keep the coordination behind small hooks such as
`useDailyNoteState`, `useAgentThreadState`, and `useDerivedTasksState` instead of spreading query
and mutation wiring across page components.

### UI State

UI state can stay local to React components or in a small persisted UI store. This includes:

- sidebar collapsed state
- agent panel open or closed state
- right rail open or closed state
- selected page tab
- selected task or review item
- composer expanded state
- surface-specific visual preferences

Do not store canonical note bodies, agent messages, tasks, proposals, or review decisions in a
UI store. UI state may reference product IDs, but it should not own product records.

## Agent Commands

The agent chat is an interface for changing the same domain model the user changes. It should not
write directly into arbitrary frontend state. Agent actions should become explicit commands such
as:

- `appendNoteBlock`
- `updateNoteBlock`
- `createTaskFromNoteBlock`
- `createReviewProposal`
- `resolveTask`
- `summarizeNote`

Commands should persist through the canonical product state boundary and return enough metadata
for the frontend domain state layer to update visible surfaces. Each command should carry
provenance: the acting agent or user, the source message, the source note block, and the run or
tool call that produced it.

## Frontend State Domains

### Workspace Shell

The workspace shell owns layout state, not product state.

Owned state:

- sidebar expanded, collapsed, or temporarily peeked
- left rail drag and click state
- open page route and active navigation item
- active page slots, such as note page, agent rail, and future right rails
- responsive layout state that changes only presentation

Current interactions:

- sidebar rail click toggles collapsed state
- sidebar rail drag expands or collapses
- left edge hover reveals the collapsed sidebar
- navigation items route to Notes, Review, Capture, Settings, or future Inbox
- mobile utility actions route into review or anonymous/local status surfaces

Agent interaction:

- The agent may request that a workspace view open, focus, or reveal a panel, but this should be a
  UI intent such as `openReviewQueue` or `focusNoteBlock`, not a direct mutation of shell internals.
- The shell can expose user-visible agent activity, but activity itself belongs to the agent/thread
  domain.

### Sidebar And Navigation

The sidebar is a projection of workspace state plus UI navigation state.

Owned state:

- active route
- collapsed/peeked shell state supplied by the workspace shell
- profile popover open state managed by the popover component
- user and workspace identity display

Projected product state:

- follow-up counts
- source update counts
- notification badge state
- current profile avatar/name from auth/session

Current placeholder or incomplete interactions:

- the notification bell is currently a labeled visual surface, not a real tray trigger
- Inbox routes to the Notes page and needs a real inbox domain before it should claim inbox behavior
- Today summary items are count projections, not selectable filters yet

Agent interaction:

- The agent can create or update the product records that drive badges: tasks, proposals, source
  updates, and review items.
- The agent should not set sidebar counts directly. Counts should derive from canonical queries or
  frontend domain projections.
- A real notification tray should show event records or reviewable items produced by the Engine,
  not local fake notifications.

### Notes Workspace

The notes workspace coordinates the active daily note, page tabs, the note editor, and note-derived
state.

Owned state:

- selected daily note or selected page tab
- note title editing state
- close tab and add tab UI state
- document scroll and focus target

Canonical product state:

- daily note record
- note title
- ordered note blocks
- note version or revision
- source links and analysis status per block

Current placeholder or incomplete interactions:

- the note close button has no product behavior yet
- the add page tab button has no page/tab model yet
- the current note title is derived from the first note/signal rather than a canonical editable
  daily note title
- the note editor emits changes, but the web screen does not yet connect them to a save hook

Agent interaction:

- The agent may propose or apply note commands such as `appendNoteBlock`, `updateNoteBlock`, or
  `renameNote`.
- Agent writes to a note should use block-level or versioned commands so user typing, autosave, and
  agent patches do not replace each other accidentally.
- Significant note changes should appear as visible patches or review proposals when they affect
  commitments, memory, or meaning.

### Editor Session

The editor session is local and high-frequency.

Owned state:

- TipTap/ProseMirror document
- selection, focus, undo, redo, composition
- unsaved local draft
- save status and conflict marker supplied by a note state hook

Canonical product state:

- persisted note blocks or serialized document
- last saved revision
- block analysis receipts

Agent interaction:

- The agent should not mutate TipTap state directly.
- The frontend domain layer should translate accepted agent note commands into editor-safe patches.
- If a patch conflicts with unsaved local typing, the UI should surface a conflict or staged
  suggestion instead of silently overwriting the draft.

### Agent Chat

Agent chat is a scoped command and explanation surface. It is not just text messages.

Owned state:

- current composer text
- sending/streaming status
- active model selection
- selected context window
- attached context items
- voice capture state
- streamed response segments
- pending commands proposed by the agent

Canonical product state:

- conversation thread
- messages
- tool calls
- command receipts
- agent run status
- links to notes, note blocks, tasks, proposals, files, and sources

Current placeholder or incomplete interactions:

- context button only sets a status string
- model picker only sets a status string
- voice input only sets a status string
- the composer streams a text reply and invalidates context, but does not yet persist a scoped
  thread view or command receipts into the panel
- the panel shows only the last prompt/reply pair rather than a durable conversation history

Agent interaction:

- Chat messages should be able to produce explicit domain commands, not arbitrary UI side effects.
- The agent can ask for confirmation, propose changes, or run tools, then return receipts that
  update notes, tasks, review queues, and source-linked context.
- The frontend should render command status inline in the chat and reflect accepted command effects
  in the relevant surfaces.

### Context Window And Sources

The context window is the user's control surface for what the agent may use.

Owned state:

- open/closed context window
- selected context scope
- temporary selected files, notes, blocks, people, calendar items, or memories
- redaction or consent choices before sending sensitive context

Canonical product state:

- source records
- consent grants
- memory/source links
- retrieval receipts

Current placeholder or incomplete interactions:

- the context affordance is visible in the composer but does not open a real selector
- source chips and source counts are currently projections from surface context

Agent interaction:

- The agent should request context through a scoped context contract, such as `useCurrentNote`,
  `useRecentSources`, or `requestUserSelectedSources`.
- Consent-sensitive context should be explicit and auditable.
- Retrieval results should become source-linked receipts that can be shown in chat, review, and
  note analysis.

### Tasks, Proposals, And Review

Tasks and proposals are product records, not sidebar badges.

Owned state:

- selected review item
- optimistic accept, dismiss, or complete state while a mutation is pending
- local filter/sort state for the review queue

Canonical product state:

- task/proposal record
- source note and source block
- status and decision history
- due date, confidence, explanation, and next action
- review receipt

Current interactions:

- review cards can accept, mark done, or dismiss through the surface engine client
- review counts drive sidebar badges and Today summary

Agent interaction:

- The agent can create tasks from note blocks and propose review items.
- The agent should not silently create commitments. It can draft tasks or proposals, then route them
  through review when the action affects user obligations, memory, external tools, or future
  reminders.
- Every derived task should preserve `sourceNoteId`, `sourceBlockId`, and the agent run/tool call
  that produced it.

### Notification Tray

Notifications are a workspace event projection.

Owned state:

- tray open/closed state
- selected notification
- read/unread local view state if not already persisted

Canonical product state:

- notification or event records
- review item references
- task references
- source update references
- delivery/read receipts when the product needs cross-device behavior

Current placeholder or incomplete interactions:

- the bell in the sidebar is not yet clickable and does not open a tray
- the active dot is derived from pending action/source counts

Agent interaction:

- The agent can create reviewable events, source updates, and task changes that flow into the tray.
- The tray should not be a separate source of truth. It should group records from tasks, proposals,
  sources, sync events, and agent receipts.

### Capture And Attachments

Capture is a product write surface that feeds notes, signals, and future review.

Owned state:

- composer body
- attachment picker state
- local attachment list before upload
- color or sticky note preference where relevant
- submit pending/error state

Canonical product state:

- capture record
- signal record
- uploaded source files or media
- draft proposal or review item created by analysis

Current interactions:

- quick capture submits through the API and reports drafted/captured status
- note composer attachment affordances exist in the UI library, but the chat variant does not yet
  wire real file, image, drawing, or voice flows

Agent interaction:

- Captures can trigger analysis that creates note blocks, tasks, proposals, or memory candidates.
- Attachment ingestion should create source records first; the agent should operate on source
  references and receipts rather than raw UI attachment state.

### User, Workspace, And Settings

Settings and profile state bridge auth, workspace preferences, and desktop-specific preferences.

Owned state:

- profile popover open state
- settings form draft state
- desktop shortcut draft state
- pending/error state for settings saves

Canonical product state:

- user profile from auth/session
- workspace identity
- workspace preferences
- desktop settings through the desktop bridge where applicable

Current interactions:

- user profile popover opens settings
- settings screen shows identity/session/surface/engine data
- desktop shortcut settings read and write through the desktop bridge

Agent interaction:

- The agent may explain settings, request permission, or guide the user to a setting.
- The agent should not change identity, permissions, shortcuts, notification preferences, or data
  deletion/export settings without explicit user confirmation.

### Desktop And Auth Runtime State

Desktop update, desktop auth, Raycast auth, Clerk, and Convex auth are runtime integration state.

Owned state:

- sign-in loading/error state
- desktop auth bridge status
- Raycast OAuth bridge status
- desktop update toast status and pending update action

Canonical product state:

- auth session
- workspace session
- update state from the desktop bridge

Agent interaction:

- The agent may surface runtime problems and suggest recovery steps.
- Runtime/auth state should not be mixed with note, task, or chat domain state.

## Notes And Derived Tasks

Daily notes should be modeled as more than one opaque text blob once paragraph-level analysis is
implemented. The durable model should preserve stable note block IDs so tasks and proposals can
point back to the exact paragraph or block that produced them.

Recommended shape:

- a daily note record keyed by user, workspace, and local date
- ordered note blocks with stable IDs
- optional TipTap/ProseMirror JSON if rich formatting becomes product-visible
- plain text or normalized markdown for search, analysis, and fallback rendering
- derived tasks/proposals linked to `sourceNoteId` and `sourceBlockId`

The editor may start with plain text while the product is still narrow, but analysis and task
creation should be designed around stable block identity rather than string matching.

## Concurrency Rules

The note can have multiple writers: user typing, autosave, agent commands, background analysis,
and review decisions. Avoid whole-document replacement once those writers exist.

Use one of these strategies before introducing multi-writer mutations:

- versioned saves with conflict detection
- block-level commands with stable IDs
- patch-based updates against a known note version
- review proposals for sensitive or surprising changes

Silent agent writes to the active note should be rare. Prefer visible patches, review proposals,
or user-confirmed commands when the change affects meaning, commitments, memory, or external work.

## Implementation Guidance

Start boring and local, then name the state seam when coordination grows:

1. Keep TipTap editor state inside the editor.
2. Add a `useDailyNoteState(localDate)` hook for body, draft, save status, and conflicts.
3. Add a `useAgentThreadState(scope)` hook for chat stream state and command results.
4. Add a `useDerivedTasksState(noteId)` hook or query for tasks linked to note blocks.
5. Move shared hooks into `@nudge/surface` when web and desktop both need them.
6. Introduce Effect Atom for frontend domain coordination when notes, chat, and task projections
   need one reactive graph across multiple panels.

React Query or Convex hooks are acceptable read/write adapters. They should not leak throughout
presentation components once note/chat/task coordination becomes cross-surface behavior.

## Read This Before

Read this document before implementing or refactoring:

- note editor persistence or autosave
- TipTap document serialization
- agent chat messages that modify notes or tasks
- derived tasks, proposals, or reviews from note content
- optimistic updates that affect more than one panel
- web and desktop shared state hooks
- Zustand, Effect Atom, React Query, or Convex state ownership decisions

Also read `docs/architecture/layers-and-services.md` before changing runtime seams, and read
`docs/adr/0016-convex-canonical-store-cloudflare-runtime.md` before changing durable product
storage.
