import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { StrictMode, useState, useTransition } from "react";
import { createRoot } from "react-dom/client";
import {
  CheckInForm,
  CommitmentPanel,
  DashboardHeader,
  EventTable,
  HomeDashboard,
  injectStyles,
  LaresAppShell,
  OutcomePanel,
  plainTextToRichTextDocument,
  ProposalEditorDrawer,
  ProposalReviewPanel,
  type RichTextDocument,
  Surface,
  SynthesisPanel,
} from "@lares/ui";
import styles from "@lares/ui/styles.css?inline";
import { apiClient } from "./api-client";

const queryClient = new QueryClient();

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TodayScreen,
});
const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/events",
  component: EventsScreen,
});

const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, eventsRoute]) });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function AppShell() {
  return <Outlet />;
}

function TodayScreen() {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [proposalEditor, setProposalEditor] = useState<{
    readonly proposalId: string;
    readonly title: string;
    readonly body: string;
    readonly bodyDocument: RichTextDocument;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const events = useEvents();
  const latestSynthesis = useLatestSynthesis();
  const proposals = usePendingProposals();
  const commitments = useActiveCommitments();
  const outcomes = useRecentOutcomes();
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
      setStatus("Saved. This is now in the user-owned event log.");
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: () => {
      setStatus("Could not save. Check the deployment logs.");
    },
  });
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

  return (
    <LaresAppShell>
      <DashboardHeader
        title="Home"
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onMenuClose={() => setMenuOpen(false)}
      />

      <HomeDashboard eventCount={events.data?.events.length ?? 0} loading={events.isLoading} />

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
          editedTitle={proposalEditor?.title ?? ""}
          editedBody={proposalEditor?.body ?? ""}
          onGenerate={() => generateProposals.mutate()}
          onAccept={(proposalId) => reviewProposal.mutate({ proposalId, decision: "accepted" })}
          onReject={(proposalId) => reviewProposal.mutate({ proposalId, decision: "rejected" })}
          onStartEdit={(proposal) =>
            setProposalEditor({
              proposalId: proposal.id,
              title: proposal.title,
              body: proposal.body,
              bodyDocument: plainTextToRichTextDocument(proposal.body),
            })
          }
          onEditTitle={(title) =>
            setProposalEditor((editor) => (editor ? { ...editor, title } : editor))
          }
          onEditBody={(body) =>
            setProposalEditor((editor) => (editor ? { ...editor, body } : editor))
          }
          onCancelEdit={() => setProposalEditor(null)}
          onCommitEdit={() => {
            if (!proposalEditor) return;
            reviewProposal.mutate({
              proposalId: proposalEditor.proposalId,
              decision: "edited",
              editedTitle: proposalEditor.title,
              editedBody: proposalEditor.body,
            });
          }}
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

      <ProposalEditorDrawer
        open={proposalEditor !== null}
        title={proposalEditor?.title ?? ""}
        body={proposalEditor?.body ?? ""}
        bodyDocument={proposalEditor?.bodyDocument}
        onTitleChange={(title) =>
          setProposalEditor((editor) => (editor ? { ...editor, title } : editor))
        }
        onBodyChange={(body) =>
          setProposalEditor((editor) => (editor ? { ...editor, body } : editor))
        }
        onBodyDocumentChange={(bodyDocument) =>
          setProposalEditor((editor) => (editor ? { ...editor, bodyDocument } : editor))
        }
        onAiDraft={() => {
          const draft = "I will send the follow-up and confirm the next concrete step today.";
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
            editedTitle: proposalEditor.title,
            editedBody: proposalEditor.body,
            editedBodyDocument: proposalEditor.bodyDocument,
          });
        }}
      />

      <Surface id="check-in-title" title="Capture" primary>
        <CheckInForm
          note={note}
          status={status}
          saving={saveCheckIn.isPending || isPending}
          onNoteChange={setNote}
          onSubmit={() => {
            const value = note.trim();
            if (!value) {
              setStatus("Write a short check-in first.");
              return;
            }
            setStatus("Saving...");
            startTransition(() => saveCheckIn.mutate(value));
          }}
        />
      </Surface>
    </LaresAppShell>
  );
}

function EventsScreen() {
  const [menuOpen, setMenuOpen] = useState(false);
  const events = useEvents();

  return (
    <LaresAppShell>
      <DashboardHeader
        title="Events"
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onMenuClose={() => setMenuOpen(false)}
      />

      <Surface id="events-title" eyebrow="Signals" title="Signal log">
        <EventTable
          events={events.data?.events}
          loading={events.isLoading}
          error={events.isError}
        />
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

injectStyles(styles);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
