import { expect, test } from "@playwright/test";

test("desktop-mounted web UI edits a note and asks Nudge through shared Engine APIs", async ({
  page,
}) => {
  const requests: Array<{
    readonly body?: unknown;
    readonly client: string | null;
    readonly method: string;
    readonly path: string;
  }> = [];
  let savedJournalBodyText = "Morning plan";
  let capturedNote = "";
  let latestRunStatus = "completed";
  let actionStatus = "proposed";

  await page.addInitScript(() => {
    const updateState = {
      availableVersion: null,
      canRetry: false,
      currentVersion: "e2e",
      downloadedVersion: null,
      downloadPercent: null,
      enabled: false,
      message: null,
      status: "disabled",
    };
    const updateResult = {
      accepted: false,
      completed: true,
      state: updateState,
    };
    const settings = { quickCaptureShortcut: "CommandOrControl+Shift+Space" };
    Object.defineProperty(window, "nudgeDesktop", {
      configurable: true,
      value: {
        appVersion: "e2e",
        authCallbackUrl: "nudge://auth/callback",
        checkForUpdate: () => Promise.resolve(updateResult),
        downloadUpdate: () => Promise.resolve(updateResult),
        getSettings: () => Promise.resolve({ ok: true, settings }),
        getUpdateState: () => Promise.resolve(updateState),
        installUpdate: () => Promise.resolve(updateResult),
        onUpdateState: () => () => {},
        openExternalAuth: () => Promise.resolve({ ok: true }),
        setSettings: () => Promise.resolve({ ok: true, settings }),
        surface: "desktop",
      },
    });
  });

  await page.route(/http:\/\/127\.0\.0\.1:\d+\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.method() === "POST" ? await request.postDataJSON() : undefined;
    requests.push({
      ...(body !== undefined ? { body } : {}),
      client: request.headers()["x-nudge-client"] ?? null,
      method: request.method(),
      path: url.pathname,
    });

    if (url.pathname === "/api/session") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          authMode: "anonymous",
          user: { displayName: "Anonymous User", id: "anon_desktop_e2e" },
          workspace: { id: "anon_desktop_e2e", label: "Anonymous User's workspace" },
        },
      });
      return;
    }

    if (url.pathname === "/api/calendar/days") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          days: [{ localDate: "2026-07-03", noteCount: 1, signalCount: capturedNote ? 1 : 0 }],
        },
      });
      return;
    }

    if (url.pathname === "/api/actions") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          actions: [
            {
              body: "Confirm the desktop app review.",
              confidence: 0.91,
              createdAt: "2026-07-03T08:30:00.000Z",
              id: "action-1",
              kind: "follow_up",
              status: actionStatus,
              title: "Confirm desktop review",
              updatedAt: "2026-07-03T08:30:00.000Z",
            },
          ],
          latestRun: {
            id: "run-1",
            metadata: { itemCount: 1 },
            sourceId: "revision-1",
            sourceType: "note_revision",
            startedAt: "2026-07-03T08:30:00.000Z",
            status: latestRunStatus,
            triggerType: "note_inactivity",
            userId: "user-1",
          },
        },
      });
      return;
    }

    if (url.pathname === "/api/signals") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          signals: capturedNote
            ? [
                {
                  createdAt: "2026-07-03T08:30:01.000Z",
                  id: "event-1",
                  occurredAt: "2026-07-03T08:30:00.000Z",
                  payload: { note: capturedNote },
                  schemaVersion: 1,
                  source: "desktop_app",
                  type: "manual_check_in_submitted",
                  userId: "user-1",
                },
              ]
            : [],
        },
      });
      return;
    }

    if (url.pathname === "/api/media") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          byteLength: readNumberProperty(body, "byteLength") ?? 1,
          id: readStringProperty(body, "id") ?? "drawing-1",
          kind: "image",
          label: readStringProperty(body, "label") ?? "Drawing",
          mimeType: readStringProperty(body, "mimeType") ?? "image/png",
          url: `/api/media/${readStringProperty(body, "id") ?? "drawing-1"}`,
        },
      });
      return;
    }

    if (url.pathname.startsWith("/api/journal/")) {
      await route.fulfill({
        contentType: "application/json",
        json: {
          document: {
            bodyText: savedJournalBodyText,
            createdAt: "2026-07-03T08:30:00.000Z",
            id: "journal-1",
            localDate: "2026-07-03",
            title: "2026-07-03",
            updatedAt: "2026-07-03T08:30:00.000Z",
            userId: "user-1",
          },
        },
      });
      return;
    }

    if (url.pathname === "/api/journal") {
      savedJournalBodyText = readStringProperty(body, "bodyText") ?? savedJournalBodyText;
      latestRunStatus = "queued";
      await route.fulfill({
        contentType: "application/json",
        json: {
          analysisRun: {
            id: "run-2",
            metadata: { itemCount: 1 },
            sourceId: "revision-2",
            sourceType: "note_revision",
            startedAt: "2026-07-03T08:31:00.000Z",
            status: "queued",
            triggerType: "note_inactivity",
            userId: "user-1",
          },
          document: {
            bodyText: savedJournalBodyText,
            createdAt: "2026-07-03T08:30:00.000Z",
            id: "journal-1",
            localDate: "2026-07-03",
            title: "2026-07-03",
            updatedAt: "2026-07-03T08:31:00.000Z",
            userId: "user-1",
          },
          revision: {
            bodyText: savedJournalBodyText,
            changeHash: "desktop-e2e",
            changedText: capturedNote,
            createdAt: "2026-07-03T08:31:00.000Z",
            documentId: "journal-1",
            id: "revision-2",
            revisionNumber: 2,
            userId: "user-1",
          },
        },
      });
      return;
    }

    if (url.pathname === "/api/actions/action-1/status") {
      actionStatus = readStringProperty(body, "status") ?? actionStatus;
      await route.fulfill({
        contentType: "application/json",
        json: {
          action: {
            body: "Confirm the desktop app review.",
            confidence: 0.91,
            createdAt: "2026-07-03T08:30:00.000Z",
            id: "action-1",
            kind: "follow_up",
            status: actionStatus,
            title: "Confirm desktop review",
            updatedAt: "2026-07-03T08:32:00.000Z",
          },
        },
      });
      return;
    }

    if (url.pathname === "/api/conversations/default/messages/stream") {
      await route.fulfill({
        body: "Nudge can review the edited note and track follow-through.",
        contentType: "text/plain",
      });
      return;
    }

    if (url.pathname === "/api/captures") {
      const payload = readObjectProperty(body, "payload");
      capturedNote = readStringProperty(payload, "note") ?? "";
      await route.fulfill({
        contentType: "application/json",
        json: {
          createdAt: "2026-07-03T08:31:01.000Z",
          id: "event-1",
          occurredAt: "2026-07-03T08:31:00.000Z",
          payload,
          schemaVersion: 1,
          source: "desktop_app",
          type: "manual_check_in_submitted",
          userId: "user-1",
        },
      });
      return;
    }

    await route.fulfill({ body: "missing route", status: 404 });
  });

  await page.goto("/");

  await expect(page.getByRole("main", { name: "Nudge workspace shell" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open user settings" })).toContainText(
    "Anonymous User",
  );
  await expect(page.getByRole("region", { name: "Nudge notes workspace" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Today's note editor" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Open Today's note/ })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Ask Nudge agent panel" })).toBeVisible();

  await expect(page.getByTestId("page-editor")).toBeVisible();
  const title = `Desktop workspace note ${Date.now()}`;
  const titleInput = page.getByRole("textbox", { name: "Note title" });
  await titleInput.fill(title);
  await expect(titleInput).toHaveValue(title);
  await expect(page.getByText("Unsaved").first()).toBeVisible();
  await titleInput.press("Enter");
  await expect(
    page.getByRole("tab", { name: new RegExp(`Open ${escapeRegExp(title)}`) }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Context window" }).click();
  await expect(page.getByRole("region", { name: "Agent context window" })).toBeVisible();
  await page.getByRole("button", { name: "Select AI model" }).click();
  await expect(page.getByRole("region", { name: "Agent model picker" })).toBeVisible();
  await page.getByRole("button", { name: "5.5 thinking" }).click();

  const ask = "What follow-through matters in this note?";
  await page.getByPlaceholder("Ask for follow-up changes").fill(ask);
  await page.getByRole("button", { name: "Send Ask Nudge message" }).click();

  await expect(page.getByText(ask)).toBeVisible();
  await expect(
    page.getByText("Nudge can review the edited note and track follow-through."),
  ).toBeVisible();
  await expect(page.getByText("Reply ready")).toBeVisible();

  const streamPost = requests.find(
    (request) =>
      request.method === "POST" && request.path === "/api/conversations/default/messages/stream",
  );
  expect(streamPost?.client).toBe("desktop");
  expect(streamPost?.body).toEqual({ message: ask });
  expect(requests.map((request) => request.path)).toEqual(
    expect.arrayContaining([
      "/api/session",
      "/api/calendar/days",
      "/api/actions",
      "/api/signals",
      "/api/conversations/default/messages/stream",
    ]),
  );
});

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function readStringProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "string" ? property : undefined;
}

function readNumberProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "number" ? property : undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
