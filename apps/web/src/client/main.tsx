import { ClerkProvider, SignIn, UserButton, useAuth, useClerk } from "@clerk/react";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
} from "@tanstack/react-router";
import { ConvexReactClient, useConvex, useConvexAuth } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { type PointerEvent, type ReactNode, StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  type AppSurface,
  type SurfaceActionItem,
  type SurfaceAgentRun,
  type SurfaceRefreshContext,
  todayLocalDate,
} from "@nudge/surface";
import {
  CalendarActivitySurface,
  CaptureResultSurface,
  DailyOperatingLoopSurface,
  NoteComposerSurface,
  ReviewActionSurface,
  SettingsSurface,
  type StickyColor,
} from "@nudge/ui";
import { api } from "../../../../convex/_generated/api";
import { apiClient, createWebSurfaceEngineClient, setSessionTokenResolver } from "./api-client";
import {
  normalizeWebMediaMimeType,
  preferredBrowserVoiceMimeType,
  webMediaAttachmentDraft,
} from "./browser-media";
import { JournalStack } from "./journal-stack";
import {
  anonymousUiEnabled,
  currentAppSurface,
  surfaceContextRefetchInterval,
} from "./surface-runtime";
import {
  captureResultFromSavedWebCapture,
  saveWebCapture,
  type WebMediaAttachmentDraft,
  type WebMediaMimeType,
  type WebCaptureResult,
} from "./web-capture";
import {
  clearWebLocalDraft,
  loadWebLocalDraft,
  saveWebLocalDraft,
  type WebDraftStorage,
} from "./web-draft";
// oxlint-disable-next-line import/no-unassigned-import -- Vite loads the Tailwind entrypoint through this side-effect import.
import "./styles.css";

const queryClient = new QueryClient();
const convexUrl =
  import.meta.env.VITE_CONVEX_URL ?? "https://grandiose-hamster-855.eu-west-1.convex.cloud";
const convexClient = new ConvexReactClient(convexUrl);
const clerkPublishableKey = anonymousUiEnabled() ? null : requiredClerkPublishableKey();
const logoLongSrc =
  import.meta.env.VITE_NUDGE_LOGO_LONG_SRC ?? "/icons/nudge-logo-lockup-blobby-n-transparent.svg";

function requiredClerkPublishableKey() {
  const value = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? import.meta.env.CLERK_PUBLISHABLE_KEY;
  if (typeof value === "string" && value.startsWith("pk_")) return value;
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is required to run Nudge");
}

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: NotesScreen,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsScreen,
});

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, settingsRoute]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function AppShell() {
  if (anonymousUiEnabled()) return <AuthenticatedAppShell />;
  return <ClerkAppShell />;
}

function ClerkAppShell() {
  const auth = useAuth();

  if (!auth.isLoaded) {
    return <main className="min-h-dvh bg-[#eef1f5]" aria-label="Loading Nudge" />;
  }
  if (!auth.isSignedIn) return <ClerkSignInScreen />;
  return <AuthenticatedAppShell />;
}

function ClerkSignInScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#111] px-4 py-8">
      <img className="h-9 w-auto" src={logoLongSrc} alt="Nudge" />
      <SignIn routing="hash" />
    </main>
  );
}

function AuthenticatedAppShell() {
  const session = useSession();
  if (!session.data) {
    return <main className="min-h-dvh bg-[#eef1f5]" aria-label="Loading Nudge" />;
  }

  return <Outlet />;
}

function NotesScreen() {
  const navigate = useNavigate();
  const session = useSession();
  const localDate = todayLocalDate();
  const surfaceContext = useSurfaceContext(localDate);
  const signedInAs =
    surfaceContext.data?.session.user?.displayName ?? session.data?.user?.displayName ?? "You";
  const pendingActions = pendingActionItems(surfaceContext.data?.actions.actions ?? []);
  const latestRun = surfaceContext.data?.actions.latestRun;
  const statusMessage = surfaceContext.isLoading
    ? "Updating context"
    : latestRun
      ? agentRunText(latestRun)
      : "Connected";
  const signalCount = surfaceContext.data?.signals.length ?? 0;

  return (
    <DailyOperatingLoopSurface
      actionCount={pendingActions.length}
      activitySlot={
        <CalendarActivitySurface
          currentDate={localDate}
          days={surfaceContext.data?.calendarDays ?? []}
        />
      }
      captureSlot={
        <NewNoteComposer
          actionCount={pendingActions.length}
          existingJournalText={surfaceContext.data?.journal?.bodyText}
          localDate={localDate}
          signalCount={signalCount}
        />
      }
      currentDate={localDate}
      journalSlot={
        <JournalStack
          journal={surfaceContext.data?.journal}
          signedInAs={signedInAs}
          signals={surfaceContext.data?.signals ?? []}
        />
      }
      navigationSlot={
        <>
          <button
            className="flex min-h-10 items-center gap-3 rounded-md border border-white/7 bg-[#131518] px-3 text-left text-sm font-semibold text-[#edeae0] shadow-sm"
            type="button"
            onClick={() => navigate({ to: "/" })}
          >
            <img className="h-7 w-auto" src={logoLongSrc} alt="Nudge" />
          </button>
          <div className="flex items-center gap-2">
            <button
              className="min-h-10 rounded-md border border-white/7 bg-[#1f2125] px-3 text-sm font-semibold text-[#edeae0] shadow-sm"
              type="button"
              onClick={() => navigate({ to: "/settings" })}
            >
              Settings
            </button>
            {anonymousUiEnabled() ? <AnonymousSessionPill /> : <ClerkSignOutButton />}
          </div>
        </>
      }
      reviewSlot={
        <ActionReviewPanel context={surfaceContext.data} loading={surfaceContext.isLoading} />
      }
      signalCount={signalCount}
      signedInAs={signedInAs}
      statusMessage={statusMessage}
    />
  );
}

function AnonymousSessionPill() {
  return (
    <div className="flex min-h-10 items-center rounded-md border border-white/7 bg-[#1f2125] px-3 text-sm font-semibold text-[#edeae0] shadow-sm">
      Local
    </div>
  );
}

function ClerkSignOutButton() {
  const clerk = useClerk();
  const signOut = useMutation({
    mutationFn: async () => {
      await clerk.signOut();
    },
    onSettled: () => {
      setSessionTokenResolver(null);
      queryClient.clear();
    },
  });

  return (
    <button
      className="min-h-10 rounded-md bg-[#579ef5] px-3 text-sm font-semibold text-[#07111d] shadow-sm disabled:opacity-60"
      disabled={signOut.isPending}
      type="button"
      onClick={() => signOut.mutate()}
    >
      Sign out
    </button>
  );
}

function NewNoteComposer(props: {
  readonly actionCount: number;
  readonly existingJournalText: string | undefined;
  readonly localDate: string;
  readonly signalCount: number;
}) {
  const initialDraftRef = useRef<WebInitialLocalDraft | null>(null);
  if (initialDraftRef.current === null) {
    initialDraftRef.current = initialWebLocalDraft(props.localDate);
  }
  const initialDraft = initialDraftRef.current;
  const [bodyText, setBodyText] = useState(initialDraft.bodyText);
  const [color, setColor] = useState<StickyColor>("yellow");
  const [continuationText, setContinuationText] = useState(initialDraft.continuationText);
  const [captureResult, setCaptureResult] = useState<WebCaptureResult | null>(null);
  const [mediaAttachments, setMediaAttachments] = useState<ReadonlyArray<WebMediaAttachmentDraft>>(
    [],
  );
  const [statusMessage, setStatusMessage] = useState(
    initialDraft.restored ? "Saved on this device" : "",
  );
  const [drawingPadOpen, setDrawingPadOpen] = useState(false);
  const [voiceRecorderOpen, setVoiceRecorderOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const voiceInputRef = useRef<HTMLInputElement | null>(null);
  const capture = useMutation({
    mutationFn: async () => {
      const leadingNote = bodyText.trim();
      const trailingNote = continuationText.trim();
      const attachmentNote = mediaAttachments.map((attachment) => attachment.label).join("\n");
      const noteText = leadingNote || (trailingNote ? "" : attachmentNote);
      const captureTitle =
        [leadingNote, trailingNote].filter((text) => text.length > 0).join("\n\n") ||
        attachmentNote;
      const saved = await saveWebCapture({
        attachments: { color },
        ...(props.existingJournalText !== undefined
          ? { existingJournalText: props.existingJournalText }
          : {}),
        localDate: props.localDate,
        mediaAttachments,
        note: noteText,
        ...(trailingNote ? { trailingNote } : {}),
      });
      return { noteText: captureTitle, saved };
    },
    onError: (error) =>
      setStatusMessage(error instanceof Error ? error.message : "Could not capture note."),
    onSuccess: (data) => {
      setCaptureResult(
        captureResultFromSavedWebCapture({
          actionCount: props.actionCount,
          noteText: data.noteText,
          saved: data.saved,
          signalCount: props.signalCount,
        }),
      );
      setBodyText("");
      setContinuationText("");
      setMediaAttachments([]);
      clearCurrentWebLocalDraft(props.localDate);
      setStatusMessage("Captured");
      void queryClient.invalidateQueries({ queryKey: ["surface-context"] });
    },
  });

  useEffect(() => {
    const draft = initialWebLocalDraft(props.localDate);
    setBodyText(draft.bodyText);
    setContinuationText(draft.continuationText);
    if (draft.restored) setStatusMessage("Saved on this device");
  }, [props.localDate]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const draft = saveCurrentWebLocalDraft({
        bodyText,
        continuationText,
        localDate: props.localDate,
      });
      if (draft) setStatusMessage("Saved on this device");
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [bodyText, continuationText, props.localDate]);

  return (
    <div className="grid gap-3">
      <input
        accept="image/jpeg,image/png"
        className="sr-only"
        ref={imageInputRef}
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.item(0);
          event.currentTarget.value = "";
          if (!file) return;
          void appendMediaAttachment(
            file,
            {
              defaultLabel: "Photo",
              kind: "image",
              mimeTypes: ["image/jpeg", "image/png"],
              presentationKind: "photo",
              statusMessage: "Photo attached",
              unsupportedMessage: "Choose a JPEG or PNG image.",
            },
            setMediaAttachments,
            setStatusMessage,
          );
        }}
      />
      <input
        accept="audio/mp4,audio/webm"
        className="sr-only"
        ref={voiceInputRef}
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.item(0);
          event.currentTarget.value = "";
          if (!file) return;
          void appendMediaAttachment(
            file,
            {
              defaultLabel: "Voice recording",
              kind: "voice",
              mimeTypes: ["audio/mp4", "audio/webm"],
              presentationKind: "voice",
              statusMessage: "Voice attached",
              unsupportedMessage: "Choose an MP4 or WebM audio recording.",
            },
            setMediaAttachments,
            setStatusMessage,
          );
          setVoiceRecorderOpen(false);
        }}
      />
      <NoteComposerSurface
        attachments={mediaAttachments.map((attachment) => ({
          id: attachment.id,
          kind: attachment.presentationKind ?? (attachment.kind === "voice" ? "voice" : "photo"),
          label: attachment.label,
        }))}
        bodyText={bodyText}
        color={color}
        continuationText={continuationText}
        disabled={capture.isPending}
        statusMessage={statusMessage}
        onAttachDrawing={() => setDrawingPadOpen(true)}
        onAttachImage={() => imageInputRef.current?.click()}
        onAttachVoice={() => setVoiceRecorderOpen(true)}
        onBodyTextChange={setBodyText}
        onChange={setColor}
        onContinuationTextChange={setContinuationText}
        onRemoveAttachment={(id) =>
          setMediaAttachments((attachments) =>
            attachments.filter((attachment) => attachment.id !== id),
          )
        }
        onSubmit={() => capture.mutate()}
      />
      <DrawingCaptureDialog
        open={drawingPadOpen}
        onAttach={(dataURL) => {
          appendPreparedMediaAttachment(
            {
              dataURL,
              id: crypto.randomUUID(),
              kind: "image",
              label: "Drawing",
              mimeType: "image/png",
              presentationKind: "drawing",
            },
            {
              defaultLabel: "Drawing",
              kind: "image",
              mimeTypes: ["image/png"],
              presentationKind: "drawing",
              statusMessage: "Drawing attached",
              unsupportedMessage: "Could not prepare drawing.",
            },
            setMediaAttachments,
            setStatusMessage,
          );
        }}
        onClose={() => setDrawingPadOpen(false)}
      />
      <VoiceCaptureDialog
        open={voiceRecorderOpen}
        onAttach={(blob) => {
          void appendBlobMediaAttachment(
            blob,
            "Voice recording",
            {
              defaultLabel: "Voice recording",
              kind: "voice",
              mimeTypes: ["audio/mp4", "audio/webm"],
              presentationKind: "voice",
              statusMessage: "Voice attached",
              unsupportedMessage: "Could not prepare voice recording.",
            },
            setMediaAttachments,
            setStatusMessage,
          );
          setVoiceRecorderOpen(false);
        }}
        onClose={() => setVoiceRecorderOpen(false)}
        onImportAudio={() => voiceInputRef.current?.click()}
      />
      {captureResult ? (
        <CaptureResultSurface
          actionCount={captureResult.actionCount}
          items={captureResult.items}
          references={captureResult.references}
          signalCount={captureResult.signalCount}
          sourceCount={captureResult.sourceCount}
          summary={captureResult.summary}
          title={captureResult.title}
        />
      ) : null}
    </div>
  );
}

interface WebInitialLocalDraft {
  readonly bodyText: string;
  readonly continuationText: string;
  readonly restored: boolean;
}

function initialWebLocalDraft(localDate: string) {
  const storage = browserDraftStorage();
  if (!storage) return { bodyText: "", continuationText: "", restored: false };
  const draft = loadWebLocalDraft({
    localDate,
    storage,
    surface: currentAppSurface(),
  });
  return draft
    ? {
        bodyText: draft.bodyText,
        continuationText: draft.continuationText,
        restored: true,
      }
    : { bodyText: "", continuationText: "", restored: false };
}

function saveCurrentWebLocalDraft(input: {
  readonly bodyText: string;
  readonly continuationText: string;
  readonly localDate: string;
}) {
  const storage = browserDraftStorage();
  if (!storage) return null;
  return saveWebLocalDraft({
    bodyText: input.bodyText,
    continuationText: input.continuationText,
    localDate: input.localDate,
    storage,
    surface: currentAppSurface(),
  });
}

function clearCurrentWebLocalDraft(localDate: string) {
  const storage = browserDraftStorage();
  if (!storage) return;
  clearWebLocalDraft({
    localDate,
    storage,
    surface: currentAppSurface(),
  });
}

function browserDraftStorage(): WebDraftStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

async function appendMediaAttachment(
  file: File,
  options: AppendMediaAttachmentOptions,
  setMediaAttachments: (
    updater: (
      attachments: ReadonlyArray<WebMediaAttachmentDraft>,
    ) => ReadonlyArray<WebMediaAttachmentDraft>,
  ) => void,
  setStatusMessage: (message: string) => void,
) {
  await appendBlobMediaAttachment(
    file,
    file.name.trim() || options.defaultLabel,
    options,
    setMediaAttachments,
    setStatusMessage,
  );
}

async function appendBlobMediaAttachment(
  blob: Blob,
  label: string,
  options: AppendMediaAttachmentOptions,
  setMediaAttachments: (
    updater: (
      attachments: ReadonlyArray<WebMediaAttachmentDraft>,
    ) => ReadonlyArray<WebMediaAttachmentDraft>,
  ) => void,
  setStatusMessage: (message: string) => void,
) {
  const mimeType = mediaAttachmentMimeType(blob.type, options.mimeTypes);
  if (!mimeType) {
    setStatusMessage(options.unsupportedMessage);
    return;
  }

  try {
    const dataURL = await blobDataURL(blob);
    appendPreparedMediaAttachment(
      {
        dataURL,
        id: crypto.randomUUID(),
        kind: options.kind,
        label,
        mimeType,
        presentationKind: options.presentationKind,
      },
      options,
      setMediaAttachments,
      setStatusMessage,
    );
  } catch {
    setStatusMessage("Could not read attachment.");
  }
}

function appendPreparedMediaAttachment(
  input: {
    readonly dataURL: string;
    readonly id: string;
    readonly kind: "image" | "voice";
    readonly label: string;
    readonly mimeType: string;
    readonly presentationKind: "drawing" | "photo" | "voice";
  },
  options: AppendMediaAttachmentOptions,
  setMediaAttachments: (
    updater: (
      attachments: ReadonlyArray<WebMediaAttachmentDraft>,
    ) => ReadonlyArray<WebMediaAttachmentDraft>,
  ) => void,
  setStatusMessage: (message: string) => void,
) {
  const draft = webMediaAttachmentDraft(input);
  if (!draft || !mediaAttachmentMimeType(draft.mimeType, options.mimeTypes)) {
    setStatusMessage(options.unsupportedMessage);
    return;
  }

  setMediaAttachments((attachments) => [...attachments, draft]);
  setStatusMessage(options.statusMessage);
}

interface AppendMediaAttachmentOptions {
  readonly defaultLabel: string;
  readonly kind: "image" | "voice";
  readonly mimeTypes: ReadonlyArray<WebMediaMimeType>;
  readonly presentationKind: "drawing" | "photo" | "voice";
  readonly statusMessage: string;
  readonly unsupportedMessage: string;
}

function mediaAttachmentMimeType(value: string, allowed: ReadonlyArray<WebMediaMimeType>) {
  const normalized = normalizeWebMediaMimeType(value);
  if (!normalized) return null;
  for (const mimeType of allowed) {
    if (normalized === mimeType) return mimeType;
  }
  return null;
}

async function blobDataURL(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read attachment."));
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read attachment."));
    };
    reader.readAsDataURL(blob);
  });
}

function DrawingCaptureDialog(props: {
  readonly open: boolean;
  readonly onAttach: (dataURL: string) => void;
  readonly onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    prepareDrawingCanvas(canvasRef.current);
    drawingRef.current = false;
    pointerIdRef.current = null;
    setHasDrawing(false);
  }, [props.open]);

  if (!props.open) return null;

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;

    drawingRef.current = true;
    pointerIdRef.current = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    const point = drawingCanvasPoint(canvas, event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    setHasDrawing(true);
  };

  const continueDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || pointerIdRef.current !== event.pointerId) return;
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;

    const point = drawingCanvasPoint(canvas, event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const finishDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    drawingRef.current = false;
    pointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const clearDrawing = () => {
    prepareDrawingCanvas(canvasRef.current);
    drawingRef.current = false;
    pointerIdRef.current = null;
    setHasDrawing(false);
  };

  const attachDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawing) return;
    props.onAttach(canvas.toDataURL("image/png"));
    props.onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6">
      <section
        aria-label="Drawing"
        aria-modal="true"
        className="grid w-full max-w-3xl gap-4 rounded-lg border border-white/7 bg-[#131518] p-4 text-[#edeae0] shadow-[0_24px_90px_rgba(0,0,0,0.45)]"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold">Drawing</h2>
          <button
            className="min-h-9 rounded-md border border-white/7 bg-[#1f2125] px-3 text-sm font-semibold text-[#edeae0]"
            type="button"
            onClick={props.onClose}
          >
            Close
          </button>
        </header>
        <canvas
          aria-label="Drawing canvas"
          className="h-72 w-full touch-none rounded-md border border-white/10 bg-[#f5eecf]"
          height={540}
          ref={canvasRef}
          width={960}
          onPointerCancel={finishDrawing}
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={finishDrawing}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            className="min-h-10 rounded-md border border-white/7 bg-[#1f2125] px-4 text-sm font-semibold text-[#edeae0]"
            type="button"
            onClick={clearDrawing}
          >
            Clear
          </button>
          <button
            className="min-h-10 rounded-md bg-[#579ef5] px-4 text-sm font-semibold text-[#07111d] shadow-sm disabled:opacity-50"
            disabled={!hasDrawing}
            type="button"
            onClick={attachDrawing}
          >
            Attach drawing
          </button>
        </div>
      </section>
    </div>
  );
}

type VoiceRecordingState = "idle" | "ready" | "recording";

function VoiceCaptureDialog(props: {
  readonly open: boolean;
  readonly onAttach: (blob: Blob) => void;
  readonly onClose: () => void;
  readonly onImportAudio: () => void;
}) {
  const chunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingState, setRecordingState] = useState<VoiceRecordingState>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    return () => {
      cleanupVoiceResources(timerRef, streamRef, recorderRef);
    };
  }, []);

  useEffect(() => {
    if (!props.open) return;
    chunksRef.current = [];
    setElapsedSeconds(0);
    setRecordedBlob(null);
    setRecordingState("idle");
    setStatusMessage("");
  }, [props.open]);

  if (!props.open) return null;

  const startRecording = async () => {
    setStatusMessage("");
    setRecordedBlob(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatusMessage("Microphone unavailable.");
      return;
    }

    const preferredMimeType = preferredBrowserVoiceMimeType();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current = [...chunksRef.current, event.data];
        }
      };
      recorder.onstop = () => {
        const recorderMimeType = normalizeWebMediaMimeType(recorder.mimeType);
        const mimeType = recorderMimeType ?? preferredMimeType;
        const chunks = chunksRef.current;
        cleanupVoiceResources(timerRef, streamRef, recorderRef);
        if (!mimeType || chunks.length === 0) {
          setRecordingState("idle");
          setStatusMessage("No recording captured.");
          return;
        }
        setRecordedBlob(new Blob(chunks, { type: mimeType }));
        setRecordingState("ready");
        setStatusMessage("Recording ready");
      };

      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      setRecordingState("recording");
      timerRef.current = window.setInterval(() => {
        const startedAt = startedAtRef.current;
        if (startedAt === null) return;
        setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);
    } catch {
      cleanupVoiceResources(timerRef, streamRef, recorderRef);
      setRecordingState("idle");
      setStatusMessage("Microphone unavailable.");
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  };

  const close = () => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    cleanupVoiceResources(timerRef, streamRef, recorderRef);
    chunksRef.current = [];
    props.onClose();
  };

  const attachRecording = () => {
    if (!recordedBlob) return;
    props.onAttach(recordedBlob);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6">
      <section
        aria-label="Voice"
        aria-modal="true"
        className="grid w-full max-w-md gap-4 rounded-lg border border-white/7 bg-[#131518] p-4 text-[#edeae0] shadow-[0_24px_90px_rgba(0,0,0,0.45)]"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold">Voice</h2>
          <button
            className="min-h-9 rounded-md border border-white/7 bg-[#1f2125] px-3 text-sm font-semibold text-[#edeae0]"
            type="button"
            onClick={close}
          >
            Close
          </button>
        </header>
        <div className="grid min-h-28 place-items-center rounded-lg border border-white/7 bg-[#090a0b]/55 p-4">
          <p className="m-0 text-4xl font-semibold tabular-nums">
            {formatElapsedSeconds(elapsedSeconds)}
          </p>
          {statusMessage ? (
            <p className="m-0 mt-2 text-sm font-medium text-[#a1a6ad]">{statusMessage}</p>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {recordingState === "recording" ? (
            <button
              className="min-h-10 rounded-md bg-[#d65f84] px-4 text-sm font-semibold text-white shadow-sm"
              type="button"
              onClick={stopRecording}
            >
              Stop
            </button>
          ) : (
            <button
              className="min-h-10 rounded-md bg-[#579ef5] px-4 text-sm font-semibold text-[#07111d] shadow-sm disabled:opacity-50"
              disabled={recordingState === "ready"}
              type="button"
              onClick={() => void startRecording()}
            >
              Record
            </button>
          )}
          <button
            className="min-h-10 rounded-md border border-white/7 bg-[#1f2125] px-4 text-sm font-semibold text-[#edeae0]"
            type="button"
            onClick={props.onImportAudio}
          >
            Import audio
          </button>
        </div>
        <button
          className="min-h-10 rounded-md bg-[#40c792] px-4 text-sm font-semibold text-[#07111d] shadow-sm disabled:opacity-50"
          disabled={!recordedBlob}
          type="button"
          onClick={attachRecording}
        >
          Attach recording
        </button>
      </section>
    </div>
  );
}

function prepareDrawingCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#f5eecf";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 7;
  context.strokeStyle = "#15181d";
}

function drawingCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent<HTMLCanvasElement>) {
  const rect = canvas.getBoundingClientRect();
  const x = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * canvas.width : 0;
  const y = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * canvas.height : 0;
  return { x, y };
}

function cleanupVoiceResources(
  timerRef: { current: number | null },
  streamRef: { current: MediaStream | null },
  recorderRef: { current: MediaRecorder | null },
) {
  if (timerRef.current !== null) {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  }
  const stream = streamRef.current;
  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    streamRef.current = null;
  }
  recorderRef.current = null;
}

function formatElapsedSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ActionReviewPanel(props: {
  readonly context: SurfaceRefreshContext | undefined;
  readonly loading: boolean;
}) {
  const latestRun = props.context?.actions.latestRun;
  const pendingActions = pendingActionItems(props.context?.actions.actions ?? []);
  const updateStatus = useMutation({
    mutationFn: async (input: {
      readonly itemId: string;
      readonly status: "accepted" | "dismissed" | "completed";
    }) => {
      const client = await createWebSurfaceEngineClient();
      await client.updateActionStatus(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["surface-context"] });
    },
  });

  return (
    <>
      <p className="m-0 text-sm leading-6 text-[#a1a6ad]">
        {latestRun ? agentRunText(latestRun) : props.loading ? "Loading review queue." : "Idle"}
      </p>
      <section className="grid gap-3">
        {pendingActions.length > 0 ? (
          pendingActions.map((action) => (
            <ReviewActionSurface
              body={action.body}
              confidencePercent={Math.round(action.confidence * 100)}
              disabled={updateStatus.isPending}
              followThroughText={followThroughText(action)}
              key={action.id}
              kind={action.kind}
              status={action.status}
              title={action.title}
              onAccept={() => updateStatus.mutate({ itemId: action.id, status: "accepted" })}
              onComplete={() => updateStatus.mutate({ itemId: action.id, status: "completed" })}
              onDismiss={() => updateStatus.mutate({ itemId: action.id, status: "dismissed" })}
            />
          ))
        ) : (
          <section className="rounded-lg border border-dashed border-white/12 bg-[#131518]/70 p-4">
            <p className="m-0 text-sm font-medium text-[#a1a6ad]">No suggestions waiting.</p>
          </section>
        )}
      </section>
    </>
  );
}

function SettingsScreen() {
  const navigate = useNavigate();
  const session = useSession();
  const sessionUser = session.data?.user;
  const workspace = session.data?.workspace;
  const exportData = useMutation({
    mutationFn: async () => apiClient.dataExport(),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nudge-export-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
  const deleteData = useMutation({
    mutationFn: async () => apiClient.account.delete(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });

  return (
    <SettingsSurface
      accountName={sessionUser?.displayName ?? "You"}
      accountSlot={anonymousUiEnabled() ? undefined : <UserButton />}
      deleteDisabled={deleteData.isPending}
      engineLabel={window.location.origin}
      exportDisabled={exportData.isPending}
      sessionLabel={session.data?.authMode ?? "Loading"}
      surfaceLabel={surfaceDisplayName(currentAppSurface())}
      workspaceLabel={workspace?.label ?? "Workspace"}
      onBack={() => navigate({ to: "/" })}
      onDeleteData={() => deleteData.mutate()}
      onExportData={() => exportData.mutate()}
    />
  );
}

function useSurfaceContext(localDate: string) {
  return useQuery({
    queryKey: ["surface-context", localDate],
    queryFn: async () => {
      const client = await createWebSurfaceEngineClient();
      return await client.refreshContext({
        actionLimit: 100,
        localDate,
        signalLimit: 100,
        timeZone: currentTimeZone(),
      });
    },
    refetchInterval: (query) => surfaceContextRefetchInterval(query.state.data),
    staleTime: 30 * 1000,
  });
}

function currentTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function pendingActionItems(actions: ReadonlyArray<SurfaceActionItem>) {
  return actions.filter((action) => action.status === "proposed" || action.status === "accepted");
}

function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => apiClient.session(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function agentRunText(run: SurfaceAgentRun) {
  const itemCountValue = readObjectProperty(run.metadata, "itemCount");
  const itemCount = typeof itemCountValue === "number" ? itemCountValue : undefined;
  if (run.status === "completed") {
    return itemCount === 0
      ? "Last pass found no actions."
      : `Last pass found ${itemCount ?? "some"} item${itemCount === 1 ? "" : "s"}.`;
  }
  if (run.status === "failed") return "Last pass failed.";
  return "Analysis is running.";
}

function followThroughText(action: SurfaceActionItem) {
  if (action.kind === "event") {
    return action.eventStartsAt
      ? `Calendar proposal for ${formatDateTime(action.eventStartsAt)}.`
      : "Calendar proposal.";
  }
  if (action.kind === "reminder") {
    return action.remindAt
      ? `Reminder proposal for ${formatDateTime(action.remindAt)}.`
      : "Reminder proposal.";
  }
  if (action.kind === "task" || action.kind === "follow_up") return "Task proposal.";
  if (action.kind === "memory") return "Saved into user memory when accepted.";
  return "Review proposal.";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString();
}

function surfaceDisplayName(surface: AppSurface) {
  switch (surface) {
    case "desktop":
      return "Desktop";
    case "ios":
      return "iOS";
    case "raycast":
      return "Raycast";
    case "web":
      return "Web";
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");

function NudgeConvexProvider(props: { readonly children: ReactNode }) {
  if (anonymousUiEnabled()) return <>{props.children}</>;
  if (!clerkPublishableKey) throw new Error("VITE_CLERK_PUBLISHABLE_KEY is required to run Nudge");

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        <ClerkTokenBridge>
          <ConvexUserMaterializer>{props.children}</ConvexUserMaterializer>
        </ClerkTokenBridge>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function ClerkTokenBridge(props: { readonly children: ReactNode }) {
  const auth = useAuth();
  if (anonymousUiEnabled()) {
    setSessionTokenResolver(null);
    return <>{props.children}</>;
  }

  const expectedState = auth.isSignedIn ? "signed-in" : "signed-out";
  const [readyState, setReadyState] = useState<"loading" | "signed-in" | "signed-out">("loading");

  useEffect(() => {
    if (!auth.isLoaded) {
      setReadyState("loading");
      return;
    }

    if (!auth.isSignedIn) {
      setSessionTokenResolver(null);
      setReadyState("signed-out");
      return;
    }

    setSessionTokenResolver(async () => auth.getToken());
    setReadyState("signed-in");
    return () => setSessionTokenResolver(null);
  }, [auth.getToken, auth.isLoaded, auth.isSignedIn]);

  if (!auth.isLoaded || readyState !== expectedState) {
    return <main className="min-h-dvh bg-[#eef1f5]" aria-label="Loading Nudge" />;
  }

  return <>{props.children}</>;
}

function ConvexUserMaterializer(props: { readonly children: ReactNode }) {
  const convex = useConvex();
  const convexAuth = useConvexAuth();

  useEffect(() => {
    if (convexAuth.isLoading || !convexAuth.isAuthenticated) return;

    void convex.mutation(api.users.store, {}).catch(() => undefined);
  }, [convex, convexAuth.isAuthenticated, convexAuth.isLoading]);

  return <>{props.children}</>;
}

createRoot(rootElement).render(
  <StrictMode>
    <NudgeConvexProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </NudgeConvexProvider>
  </StrictMode>,
);
