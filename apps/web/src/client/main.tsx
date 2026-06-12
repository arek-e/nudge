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
  DashboardHeader,
  EventTable,
  HomeDashboard,
  injectStyles,
  LaresAppShell,
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
  const [isPending, startTransition] = useTransition();
  const events = useEvents();
  const latestSynthesis = useLatestSynthesis();
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

injectStyles(styles);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
