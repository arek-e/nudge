import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { createContext, StrictMode, useContext, useState, useTransition } from "react";
import { createRoot } from "react-dom/client";
import {
  AddActionSheet,
  BottomNav,
  CheckInForm,
  CommitmentPanel,
  DashboardHeader,
  deriveJourneyDayGroups,
  deriveLoopInsights,
  deriveTodayNextAction,
  HomeDashboard,
  InsightsPanel,
  JourneyTimeline,
  LaresAppShell,
  OutcomePanel,
  plainTextToRichTextDocument,
  ProposalReviewPanel,
  type RichTextDocument,
  Surface,
  SynthesisPanel,
  WritingDrawer,
} from "@lares/ui";
import { apiClient } from "./api-client";
// oxlint-disable-next-line import/no-unassigned-import -- Vite loads the Tailwind entrypoint through this side-effect import.
import "./styles.css";

const queryClient = new QueryClient();

interface CaptureContextValue {
  readonly status: string;
  readonly saving: boolean;
  readonly openCapture: () => void;
}

const CaptureContext = createContext<CaptureContextValue | null>(null);

function useCapture() {
  const context = useContext(CaptureContext);
  if (!context) throw new Error("useCapture must be used inside AppShell");
  return context;
}

const titleFromEditorText = (text: string, fallback: string) => {
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? fallback
  );
};

const bodyFromEditorText = (text: string) => {
  const lines = text.split("\n");
  const [, ...rest] = lines;
  const body = rest.join("\n").trim();
  return body || text.trim();
};

const scrollToLoopSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" });
};

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TodayScreen,
});
const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/journey",
  component: JourneyScreen,
});
const loopRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/loop",
  component: LoopScreen,
});
const insightsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/insights",
  component: InsightsScreen,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsScreen,
});

const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    eventsRoute,
    loopRoute,
    insightsRoute,
    settingsRoute,
  ]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [note, setNote] = useState("");
  const [noteDocument, setNoteDocument] = useState<RichTextDocument>(
    plainTextToRichTextDocument(""),
  );
  const [addOpen, setAddOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const saveCheckIn = useMutation({
    mutationFn: async (value: string) => {
      await apiClient.captures.append({
        type: "manual_check_in_submitted",
        source: "today_app",
        occurredAt: new Date().toISOString(),
        schemaVersion: 1,
        payload: { note: value },
      });
    },
    onSuccess: async () => {
      setNote("");
      setNoteDocument(plainTextToRichTextDocument(""));
      setCaptureOpen(false);
      setStatus("Saved. This is now in the user-owned event log.");
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: () => {
      setStatus("Could not save. Check the deployment logs.");
    },
  });

  return (
    <CaptureContext.Provider
      value={{
        status,
        saving: saveCheckIn.isPending || isPending,
        openCapture: () => setCaptureOpen(true),
      }}
    >
      <Outlet />
      <AddActionSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCaptureNote={() => {
          setAddOpen(false);
          setCaptureOpen(true);
        }}
      />
      <WritingDrawer
        eyebrow="Capture"
        drawerTitle="Write capture"
        description="Capture the raw note first. Lares will turn it into context after you save."
        bodyLabel="Capture body"
        submitLabel="Save capture"
        open={captureOpen}
        body={note}
        bodyDocument={noteDocument}
        onBodyChange={setNote}
        onBodyDocumentChange={setNoteDocument}
        onAiDraft={() => {
          const draft = "Today I need to clarify priorities, constraints, and the next follow-up.";
          setNote(draft);
          setNoteDocument(plainTextToRichTextDocument(draft));
        }}
        onCancel={() => setCaptureOpen(false)}
        onCommit={() => {
          const value = note.trim();
          if (!value) {
            setStatus("Write a short check-in first.");
            return;
          }
          setStatus("Saving...");
          startTransition(() => saveCheckIn.mutate(value));
        }}
      />
      {addOpen || captureOpen ? null : (
        <BottomNav
          active={
            pathname === "/loop"
              ? "loop"
              : pathname === "/journey"
                ? "journey"
                : pathname === "/insights"
                  ? "insights"
                  : "today"
          }
          onCapture={() => setAddOpen(true)}
        />
      )}
    </CaptureContext.Provider>
  );
}

function LoopScreen() {
  const events = useEvents();
  const latestSynthesis = useLatestSynthesis();
  const proposals = usePendingProposals();
  const commitments = useActiveCommitments();
  const outcomes = useRecentOutcomes();
  const nextAction = deriveTodayNextAction({
    activeCommitmentCount: commitments.data?.commitments.length ?? 0,
    hasSynthesis: latestSynthesis.data?.synthesis !== undefined,
    pendingProposalCount: proposals.data?.proposals.length ?? 0,
    signalCount: events.data?.events.length ?? 0,
  });

  return (
    <LaresAppShell>
      <DashboardHeader title="Loop" />
      <Surface eyebrow="Current state" title="Daily Operating Loop">
        <p className="summary">
          Capture → Signal → Frame → Synthesis → Proposal → Review → Commitment → Outcome
        </p>
        <div className="mt-4 grid gap-3">
          {[
            ["Signals", events.data?.events.length ?? 0],
            ["Pending proposals", proposals.data?.proposals.length ?? 0],
            ["Active commitments", commitments.data?.commitments.length ?? 0],
            ["Closed outcomes", outcomes.data?.outcomes.length ?? 0],
          ].map(([label, value]) => (
            <div className="rounded-2xl bg-white/4 p-4" key={label}>
              <p className="m-0 text-xs font-semibold tracking-[0.14em] text-neutral-400 uppercase">
                {label}
              </p>
              <strong className="mt-1 block text-2xl text-white">{value}</strong>
            </div>
          ))}
        </div>
      </Surface>
      <Surface eyebrow="Next" title={nextAction.label} primary>
        <p className="summary">{nextAction.detail}</p>
      </Surface>
    </LaresAppShell>
  );
}

function SettingsScreen() {
  const session = useSession();
  const exportData = useMutation({
    mutationFn: async () => apiClient.dataExport(),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lares-export-${new Date().toISOString()}.json`;
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
    <LaresAppShell>
      <DashboardHeader title="Settings" />
      <Surface eyebrow="Workspace" title={session.data?.workspace.label ?? "Workspace"}>
        <p className="summary">
          {session.data
            ? `Signed in as ${session.data.user.displayName}. Auth mode: ${session.data.authMode}.`
            : "Loading workspace..."}
        </p>
      </Surface>
      <Surface eyebrow="Data controls" title="Your data">
        <p className="summary">
          Export a JSON copy of your current workspace or delete the local MVP data for this user.
        </p>
        <div className="mt-4 grid gap-2">
          <button
            className="min-h-12 rounded-full bg-[#f4f1eb] px-4 text-sm font-semibold text-[#080808]"
            type="button"
            onClick={() => exportData.mutate()}
          >
            Export data
          </button>
          <button
            className="min-h-12 rounded-full bg-white/5 px-4 text-sm font-semibold text-neutral-100"
            type="button"
            onClick={() => deleteData.mutate()}
          >
            Delete local data
          </button>
        </div>
      </Surface>
    </LaresAppShell>
  );
}

function TodayScreen() {
  const capture = useCapture();
  const [proposalEditor, setProposalEditor] = useState<{
    readonly proposalId: string;
    readonly body: string;
    readonly bodyDocument: RichTextDocument;
  } | null>(null);
  const events = useEvents();
  const latestSynthesis = useLatestSynthesis();
  const proposals = usePendingProposals();
  const commitments = useActiveCommitments();
  const outcomes = useRecentOutcomes();
  const generateSynthesis = useMutation({
    mutationFn: async () => {
      await apiClient.syntheses.create({ frameKey: "current_state" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["synthesis", "current_state"] });
    },
  });
  const generateProposals = useMutation({
    mutationFn: async () => {
      await apiClient.proposals.generate({ frameKey: "current_state" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
      await queryClient.invalidateQueries({ queryKey: ["commitments"] });
    },
  });
  const recordOutcome = useMutation({
    mutationFn: async (commitmentId: string) => {
      await apiClient.outcomes.create({
        commitmentId,
        result: "completed",
        note: `Marked complete from the Today loop at ${new Date().toISOString()}.`,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["commitments"] });
      await queryClient.invalidateQueries({ queryKey: ["outcomes"] });
    },
  });
  const reviewProposal = useMutation({
    mutationFn: async (input: {
      readonly proposalId: string;
      readonly decision: "accepted" | "edited" | "rejected";
      readonly editedTitle?: string;
      readonly editedBody?: string;
      readonly editedBodyDocument?: unknown;
    }) => {
      await apiClient.reviews.create(input);
    },
    onSuccess: async () => {
      setProposalEditor(null);
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
      await queryClient.invalidateQueries({ queryKey: ["commitments"] });
    },
  });
  const nextAction = deriveTodayNextAction({
    activeCommitmentCount: commitments.data?.commitments.length ?? 0,
    hasSynthesis: latestSynthesis.data?.synthesis !== undefined,
    pendingProposalCount: proposals.data?.proposals.length ?? 0,
    signalCount: events.data?.events.length ?? 0,
  });
  const openNextAction = () => {
    switch (nextAction.stage) {
      case "Capture":
        capture.openCapture();
        return;
      case "Synthesis":
        generateSynthesis.mutate();
        scrollToLoopSection("synthesis-title");
        return;
      case "Proposal":
        generateProposals.mutate();
        scrollToLoopSection("proposals-title");
        return;
      case "Review":
        scrollToLoopSection("proposals-title");
        return;
      case "Outcome":
        scrollToLoopSection("commitments-title");
        return;
    }
  };

  return (
    <LaresAppShell>
      <DashboardHeader title="Home" />

      <HomeDashboard
        eventCount={events.data?.events.length ?? 0}
        loading={events.isLoading}
        nextAction={nextAction}
        onOpenLoop={openNextAction}
      />

      <Surface id="today-title" eyebrow="Today" title="Start with the current state">
        <p className="summary">
          Capture priorities, constraints, energy, and follow-ups. Lares keeps this as user-owned
          context for the loop, not as hidden automation.
        </p>
      </Surface>

      <Surface id="synthesis-title" eyebrow="Synthesis" title="What matters now?">
        <SynthesisPanel
          synthesis={latestSynthesis.data?.synthesis}
          loading={latestSynthesis.isLoading}
          generating={generateSynthesis.isPending}
          onGenerate={() => generateSynthesis.mutate()}
        />
      </Surface>

      <Surface id="proposals-title" eyebrow="Review" title="Proposals">
        <ProposalReviewPanel
          proposals={proposals.data?.proposals}
          loading={proposals.isLoading}
          generating={generateProposals.isPending}
          reviewingId={reviewProposal.variables?.proposalId}
          editingProposalId={proposalEditor?.proposalId}
          onGenerate={() => generateProposals.mutate()}
          onAccept={(proposalId) => reviewProposal.mutate({ proposalId, decision: "accepted" })}
          onReject={(proposalId) => reviewProposal.mutate({ proposalId, decision: "rejected" })}
          onStartEdit={(proposal) =>
            setProposalEditor({
              proposalId: proposal.id,
              body: `${proposal.title}\n${proposal.body}`,
              bodyDocument: plainTextToRichTextDocument(`${proposal.title}\n${proposal.body}`),
            })
          }
        />
      </Surface>

      <Surface id="commitments-title" eyebrow="Commit" title="Active commitments">
        <CommitmentPanel
          commitments={commitments.data?.commitments}
          loading={commitments.isLoading}
          completingId={recordOutcome.variables}
          onComplete={(commitmentId) => recordOutcome.mutate(commitmentId)}
        />
      </Surface>

      <Surface id="closed-loop-title" eyebrow="Outcome" title="Closed loop">
        <OutcomePanel outcomes={outcomes.data?.outcomes} loading={outcomes.isLoading} />
      </Surface>

      <WritingDrawer
        eyebrow="Edit proposal"
        drawerTitle="Commit this as your own"
        description="Use the first line as the Commitment title, then write the body below it. Type /ai for a draft."
        bodyLabel="Commitment body"
        submitLabel="Commit edited proposal"
        open={proposalEditor !== null}
        body={proposalEditor?.body ?? ""}
        bodyDocument={proposalEditor?.bodyDocument}
        onBodyChange={(body) =>
          setProposalEditor((editor) => (editor ? { ...editor, body } : editor))
        }
        onBodyDocumentChange={(bodyDocument) =>
          setProposalEditor((editor) => (editor ? { ...editor, bodyDocument } : editor))
        }
        onAiDraft={() => {
          const draft =
            "Confirm travel follow-up\nI will send the follow-up and confirm the next concrete step today.";
          setProposalEditor((editor) =>
            editor
              ? { ...editor, body: draft, bodyDocument: plainTextToRichTextDocument(draft) }
              : editor,
          );
        }}
        onCancel={() => setProposalEditor(null)}
        onCommit={() => {
          if (!proposalEditor) return;
          reviewProposal.mutate({
            proposalId: proposalEditor.proposalId,
            decision: "edited",
            editedTitle: titleFromEditorText(proposalEditor.body, "Edited commitment"),
            editedBody: bodyFromEditorText(proposalEditor.body),
            editedBodyDocument: proposalEditor.bodyDocument,
          });
        }}
      />

      <Surface id="check-in-title" title="Capture" primary>
        <CheckInForm status={capture.status} saving={capture.saving} onOpen={capture.openCapture} />
      </Surface>
    </LaresAppShell>
  );
}

function JourneyScreen() {
  const events = useEvents();
  const groups = events.data ? deriveJourneyDayGroups(events.data.events) : undefined;

  return (
    <LaresAppShell>
      <DashboardHeader title="Journey" />

      <Surface id="events-title" eyebrow="Loop history" title="Journey timeline">
        <JourneyTimeline groups={groups} loading={events.isLoading} error={events.isError} />
      </Surface>
    </LaresAppShell>
  );
}

function InsightsScreen() {
  const commitments = useActiveCommitments();
  const outcomes = useRecentOutcomes();
  const activeCount = commitments.data?.commitments.length ?? 0;
  const insights = deriveLoopInsights({
    activeCommitmentCount: activeCount,
    outcomes: outcomes.data?.outcomes ?? [],
  });

  return (
    <LaresAppShell>
      <DashboardHeader title="Insights" />

      <Surface id="insights-title" eyebrow="Loop intelligence" title="Completion trend">
        <InsightsPanel insights={insights} />
      </Surface>
    </LaresAppShell>
  );
}

function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const body = await apiClient.signals.list({ limit: 50 });
      return { events: body.signals };
    },
  });
}

function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => apiClient.session(),
  });
}

function useLatestSynthesis() {
  return useQuery({
    queryKey: ["synthesis", "current_state"],
    queryFn: async () => {
      return apiClient.syntheses.latest({ frameKey: "current_state" });
    },
  });
}

function usePendingProposals() {
  return useQuery({
    queryKey: ["proposals"],
    queryFn: async () => {
      return apiClient.proposals.list({ limit: 20 });
    },
  });
}

function useActiveCommitments() {
  return useQuery({
    queryKey: ["commitments"],
    queryFn: async () => {
      return apiClient.commitments.list({ limit: 20 });
    },
  });
}

function useRecentOutcomes() {
  return useQuery({
    queryKey: ["outcomes"],
    queryFn: async () => {
      return apiClient.outcomes.list({ limit: 10 });
    },
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
