import { expect, test } from "@playwright/test";

test("desktop-mounted web UI captures a note through the shared Engine APIs", async ({ page }) => {
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
    Object.defineProperty(window, "nudgeDesktop", {
      configurable: true,
      value: { appVersion: "e2e", surface: "desktop" },
    });
  });

  await page.route("**/api/**", async (route) => {
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

  await expect(page.getByRole("heading", { name: "Daily Operating Loop" })).toBeVisible();
  await expect(page.getByText("Anonymous User")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Capture" })).toBeVisible();

  const note = `Desktop UI capture ${Date.now()}`;
  const continuation = "Send the drawing to the launch reviewer.";
  await page.getByPlaceholder("What matters now?").fill(note);
  await page.getByRole("button", { name: "Attach drawing" }).click();
  const canvas = page.getByLabel("Drawing canvas");
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Missing drawing canvas box");
  await page.mouse.move(canvasBox.x + 24, canvasBox.y + 24);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 84, canvasBox.y + 72);
  await page.mouse.up();
  await page
    .getByRole("dialog", { name: "Drawing" })
    .getByRole("button", { name: "Attach drawing" })
    .click();
  await expect(page.getByLabel("Continuation note")).toBeVisible();
  await page.getByLabel("Continuation note").fill(continuation);
  await page.getByRole("button", { name: "Capture" }).click();

  await expect(page.getByText("Capture saved")).toBeVisible();
  await expect(page.getByText(note).first()).toBeVisible();
  await expect(page.getByText(continuation).first()).toBeVisible();
  await expect(page.getByText("Desktop App", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Queued", { exact: true }).first()).toBeVisible();

  const mediaPost = requests.find(
    (request) => request.method === "POST" && request.path === "/api/media",
  );
  const journalPost = requests.find(
    (request) => request.method === "POST" && request.path === "/api/journal",
  );
  const capturePost = requests.find(
    (request) => request.method === "POST" && request.path === "/api/captures",
  );

  expect(mediaPost?.client).toBe("desktop");
  expect(mediaPost?.body).toEqual(
    expect.objectContaining({
      kind: "image",
      label: "Drawing",
      mimeType: "image/png",
    }),
  );
  expect(journalPost?.client).toBe("desktop");
  expect(capturePost?.client).toBe("desktop");
  expect(journalPost?.body).toEqual(
    expect.objectContaining({
      bodyDocument: expect.arrayContaining([
        expect.objectContaining({ type: "img" }),
        expect.objectContaining({
          children: [{ text: continuation }],
          type: "p",
        }),
      ]),
      bodyText: `Morning plan\n\n${note}\n\n${continuation}`,
      localDate: expect.any(String),
    }),
  );
  expect(capturePost?.body).toEqual(
    expect.objectContaining({
      payload: expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            kind: "image",
            label: "Drawing",
            mimeType: "image/png",
          }),
        ]),
        note: `${note}\n\n${continuation}`,
      }),
      source: "desktop_app",
      type: "manual_check_in_submitted",
    }),
  );

  await page.getByRole("button", { name: "Accept" }).click();
  await expect
    .poll(() => requests.some((request) => request.path === "/api/actions/action-1/status"))
    .toBe(true);
  await expect(page.getByText("FOLLOW_UP · ACCEPTED")).toBeVisible();

  const actionStatusPost = requests.find(
    (request) => request.method === "POST" && request.path === "/api/actions/action-1/status",
  );
  expect(actionStatusPost?.client).toBe("desktop");
  expect(actionStatusPost?.body).toEqual({ itemId: "action-1", status: "accepted" });
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
