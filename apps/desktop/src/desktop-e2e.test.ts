import { afterEach, describe, expect, test } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = import.meta.dir.replace(/\/src$/, "");
const desktopRuntimeBinary = join(root, "node_modules/.bin/electron");
const webDistRoot = join(root, "../web/dist/client");
const shouldRun = process.env.NUDGE_DESKTOP_E2E === "1";
const runDesktopE2eTest = shouldRun ? test : test.skip;

let server: ReturnType<typeof Bun.serve> | undefined;
let desktopProcess: ChildProcess | undefined;
let tempDirectory: string | undefined;

afterEach(async () => {
  server?.stop(true);
  server = undefined;

  if (desktopProcess && !desktopProcess.killed) {
    desktopProcess.kill();
  }
  desktopProcess = undefined;

  if (tempDirectory) {
    await rm(tempDirectory, { force: true, recursive: true });
    tempDirectory = undefined;
  }
});

describe("Desktop e2e", () => {
  runDesktopE2eTest(
    "captures through the mounted built web UI",
    async () => {
      const engineRequests: Array<{
        readonly body?: unknown;
        readonly client: string | null;
        readonly method: string;
        readonly path: string;
      }> = [];
      let savedJournalBodyText = "Morning plan";
      let capturedNote = "";
      let latestRunStatus = "completed";
      let actionStatus = "proposed";
      server = Bun.serve({
        fetch: async (request) => {
          const url = new URL(request.url);
          const body = request.method === "POST" ? await request.json() : undefined;
          if (url.pathname.startsWith("/api/")) {
            engineRequests.push({
              ...(body !== undefined ? { body } : {}),
              client: request.headers.get("x-nudge-client"),
              method: request.method,
              path: url.pathname,
            });
          }

          if (url.pathname === "/" || url.pathname === "/index.html") {
            return new Response(await desktopBuiltWebIndexHtml(), {
              headers: { "content-type": "text/html" },
            });
          }
          if (url.pathname.startsWith("/api/")) {
            if (url.pathname === "/api/journal" && request.method === "POST") {
              savedJournalBodyText = readStringProperty(body, "bodyText") ?? savedJournalBodyText;
              latestRunStatus = "queued";
            }
            if (url.pathname === "/api/captures" && request.method === "POST") {
              const payload = readObjectProperty(body, "payload");
              capturedNote = readStringProperty(payload, "note") ?? "";
            }
            if (url.pathname === "/api/actions/action-1/status" && request.method === "POST") {
              actionStatus = readStringProperty(body, "status") ?? actionStatus;
            }
            const response = desktopBuiltWebApiResponse(url, body, {
              actionStatus,
              capturedNote,
              latestRunStatus,
              savedJournalBodyText,
            });
            return jsonResponse(response);
          }
          return await serveBuiltWebAsset(url.pathname);
        },
        port: 0,
      });
      tempDirectory = await mkdtemp(join(tmpdir(), "nudge-desktop-real-web-e2e-"));
      const readyFile = join(tempDirectory, "ready.json");
      const desktopOutput = startDesktopOutputBuffer();

      desktopProcess = spawn(desktopRuntimeBinary, [root], {
        env: {
          ...process.env,
          NUDGE_DESKTOP_E2E_READY_FILE: readyFile,
          NUDGE_WEB_APP_URL: `http://127.0.0.1:${server.port}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      captureDesktopOutput(desktopProcess, desktopOutput);

      const receipt = await waitForJsonFile(readyFile).catch((error: unknown) => {
        throw new Error(`${errorMessage(error)}\nDesktop runtime output:\n${desktopOutput.text()}`);
      });
      expect(receipt).toMatchObject({
        appVersion: "0.1.0",
        appResult: {
          captureResultVisible: true,
          captureSource: "desktop_app",
          reviewStatusVisible: true,
          journalBodyText: expect.stringContaining("Desktop real UI capture"),
          surface: "desktop",
        },
        surface: "desktop",
        title: "Nudge Daily Operating Loop",
        url: `http://127.0.0.1:${server.port}/`,
      });

      const journalPost = engineRequests.find(
        (request) => request.method === "POST" && request.path === "/api/journal",
      );
      const capturePost = engineRequests.find(
        (request) => request.method === "POST" && request.path === "/api/captures",
      );
      const actionStatusPost = engineRequests.find(
        (request) => request.method === "POST" && request.path === "/api/actions/action-1/status",
      );
      expect(journalPost?.client).toBe("desktop");
      expect(capturePost?.client).toBe("desktop");
      expect(actionStatusPost?.client).toBe("desktop");
      expect(capturePost?.body).toEqual(
        expect.objectContaining({
          payload: expect.objectContaining({
            note: expect.stringContaining("Desktop real UI capture"),
          }),
          source: "desktop_app",
          type: "manual_check_in_submitted",
        }),
      );
      expect(actionStatusPost?.body).toEqual({ itemId: "action-1", status: "accepted" });
    },
    20_000,
  );

  runDesktopE2eTest(
    "mounts a web app URL with the desktop preload bridge",
    async () => {
      const engineRequests: Array<{
        readonly body?: unknown;
        readonly client: string | null;
        readonly method: string;
        readonly path: string;
      }> = [];
      server = Bun.serve({
        fetch: async (request) => {
          const url = new URL(request.url);
          const body = request.method === "POST" ? await request.json() : undefined;
          if (url.pathname !== "/") {
            engineRequests.push({
              ...(body !== undefined ? { body } : {}),
              client: request.headers.get("x-nudge-client"),
              method: request.method,
              path: url.pathname,
            });
          }

          if (url.pathname === "/") {
            return new Response(desktopE2eHarnessHtml(), {
              headers: { "content-type": "text/html" },
            });
          }
          if (url.pathname === "/api/media") {
            return jsonResponse({
              byteLength: 11,
              id: "550e8400-e29b-41d4-a716-446655440000",
              kind: "image",
              label: "Desktop photo",
              mimeType: "image/png",
              url: "/api/media/550e8400-e29b-41d4-a716-446655440000",
            });
          }
          if (url.pathname === "/api/journal") {
            return jsonResponse({
              analysisRun: {
                id: "run-1",
                metadata: { itemCount: 1 },
                sourceId: "revision-1",
                sourceType: "note_revision",
                startedAt: "2026-07-03T08:30:00.000Z",
                status: "queued",
                triggerType: "note_inactivity",
                userId: "user-1",
              },
              document: {
                bodyDocument: body?.bodyDocument,
                bodyText: "Desktop launch review",
                createdAt: "2026-07-03T08:30:00.000Z",
                id: "journal-1",
                localDate: "2026-07-03",
                title: "2026-07-03",
                updatedAt: "2026-07-03T08:30:00.000Z",
                userId: "user-1",
              },
              revision: {
                bodyText: "Desktop launch review",
                changeHash: "21:Desktop launch review",
                changedText: "Desktop launch review",
                createdAt: "2026-07-03T08:30:00.000Z",
                documentId: "journal-1",
                id: "revision-1",
                revisionNumber: 1,
                userId: "user-1",
              },
            });
          }
          if (url.pathname === "/api/captures") {
            return jsonResponse({
              createdAt: "2026-07-03T08:30:01.000Z",
              id: "event-1",
              idempotencyKey: "desktop:e2e",
              occurredAt: "2026-07-03T08:30:00.000Z",
              payload: body?.payload,
              schemaVersion: 1,
              source: "desktop_app",
              type: "manual_check_in_submitted",
              userId: "user-1",
            });
          }
          if (url.pathname === "/api/session") {
            return jsonResponse({
              authMode: "desktop-e2e",
              user: { displayName: "Desktop User", id: "user-1" },
              workspace: { id: "workspace-1", label: "Desktop workspace" },
            });
          }
          if (url.pathname === "/api/calendar/days") {
            return jsonResponse({
              days: [{ localDate: "2026-07-03", noteCount: 1, signalCount: 1 }],
            });
          }
          if (url.pathname === "/api/actions") {
            return jsonResponse({
              actions: [
                {
                  body: "Confirm the desktop app review.",
                  confidence: 0.91,
                  createdAt: "2026-07-03T08:30:00.000Z",
                  id: "action-1",
                  kind: "follow_up",
                  status: "proposed",
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
                status: "queued",
                triggerType: "note_inactivity",
                userId: "user-1",
              },
            });
          }
          if (url.pathname === "/api/signals") {
            return jsonResponse({
              signals: [
                {
                  createdAt: "2026-07-03T08:30:01.000Z",
                  id: "event-1",
                  occurredAt: "2026-07-03T08:30:00.000Z",
                  payload: { note: "Desktop launch review" },
                  schemaVersion: 1,
                  source: "desktop_app",
                  type: "manual_check_in_submitted",
                  userId: "user-1",
                },
              ],
            });
          }
          if (url.pathname === "/api/journal/2026-07-03") {
            return jsonResponse({
              document: {
                bodyText: "Desktop launch review",
                createdAt: "2026-07-03T08:30:00.000Z",
                id: "journal-1",
                localDate: "2026-07-03",
                title: "2026-07-03",
                updatedAt: "2026-07-03T08:30:00.000Z",
                userId: "user-1",
              },
            });
          }
          return new Response("missing route", { status: 404 });
        },
        port: 0,
      });
      tempDirectory = await mkdtemp(join(tmpdir(), "nudge-desktop-e2e-"));
      const readyFile = join(tempDirectory, "ready.json");

      desktopProcess = spawn(desktopRuntimeBinary, [root], {
        env: {
          ...process.env,
          NUDGE_DESKTOP_E2E_READY_FILE: readyFile,
          NUDGE_WEB_APP_URL: `http://127.0.0.1:${server.port}`,
        },
        stdio: "ignore",
      });

      const receipt = await waitForJsonFile(readyFile);
      expect(receipt).toMatchObject({
        appVersion: "0.1.0",
        bodyText: "Desktop saved 2026-07-03 from desktop_app",
        appResult: {
          captureSource: "desktop_app",
          mediaUrl: "/api/media/550e8400-e29b-41d4-a716-446655440000",
          journalTitle: "2026-07-03",
          openActionCount: 1,
          signalSource: "desktop_app",
          surface: "desktop",
          userDisplayName: "Desktop User",
        },
        surface: "desktop",
        title: "Nudge E2E",
        url: `http://127.0.0.1:${server.port}/`,
      });
      expect(engineRequests.map((request) => request.path)).toEqual([
        "/api/media",
        "/api/journal",
        "/api/captures",
        "/api/session",
        "/api/calendar/days",
        "/api/actions",
        "/api/signals",
        "/api/journal/2026-07-03",
      ]);
      for (const request of engineRequests) {
        expect(request.client).toBe("desktop");
      }
    },
    20_000,
  );
});

async function desktopBuiltWebIndexHtml() {
  const index = Bun.file(join(webDistRoot, "index.html"));
  const html = await index.text();
  return html.replace("</body>", `${desktopBuiltWebE2eScript()}</body>`);
}

function desktopBuiltWebE2eScript() {
  return `<script>
      window.nudgeDesktopE2E = (async () => {
        const note = "Desktop real UI capture " + Date.now();
        const waitFor = async (predicate, label) => {
          const started = Date.now();
          while (Date.now() - started < 9000) {
            const value = predicate();
            if (value) return value;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          throw new Error("Timed out waiting for " + label);
        };
        try {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith("nudge.desktop.local-draft.")) localStorage.removeItem(key);
          }
        } catch {
        }
        const textarea = await waitFor(
          () => document.querySelector('textarea[placeholder="What matters now?"]'),
          "composer"
        );
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
        if (valueSetter) {
          valueSetter.call(textarea, note);
        } else {
          textarea.value = note;
        }
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        const captureButton = await waitFor(
          () => Array.from(document.querySelectorAll("button")).find((button) =>
            button.textContent?.trim() === "Capture" && !button.disabled
          ),
          "capture button"
        );
        captureButton.click();
        await waitFor(
          () => document.body.innerText.toLowerCase().includes("capture saved"),
          "capture result"
        );
        const acceptButton = await waitFor(
          () => Array.from(document.querySelectorAll("button")).find((button) =>
            button.textContent?.trim() === "Accept" && !button.disabled
          ),
          "accept button"
        );
        acceptButton.click();
        await waitFor(
          () => document.body.innerText.toLowerCase().includes("follow_up · accepted"),
          "accepted review status"
        );
        return {
          captureResultVisible: document.body.innerText.toLowerCase().includes("capture saved"),
          captureSource: document.body.innerText.includes("Desktop App") ? "desktop_app" : "missing",
          journalBodyText: document.body.innerText,
          note,
          reviewStatusVisible: document.body.innerText.toLowerCase().includes("follow_up · accepted"),
          surface: window.nudgeDesktop?.surface ?? "missing"
        };
      })();
    </script>`;
}

function desktopBuiltWebApiResponse(
  url: URL,
  body: unknown,
  state: {
    readonly actionStatus: string;
    readonly capturedNote: string;
    readonly latestRunStatus: string;
    readonly savedJournalBodyText: string;
  },
) {
  if (url.pathname === "/api/session") {
    return {
      authMode: "anonymous",
      user: { displayName: "Anonymous User", id: "anon_desktop_e2e" },
      workspace: { id: "anon_desktop_e2e", label: "Anonymous User's workspace" },
    };
  }

  if (url.pathname === "/api/calendar/days") {
    return {
      days: [
        {
          localDate: "2026-07-03",
          noteCount: 1,
          signalCount: state.capturedNote ? 1 : 0,
        },
      ],
    };
  }

  if (url.pathname === "/api/actions") {
    return {
      actions: [
        {
          body: "Confirm the desktop app review.",
          confidence: 0.91,
          createdAt: "2026-07-03T08:30:00.000Z",
          id: "action-1",
          kind: "follow_up",
          status: state.actionStatus,
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
        status: state.latestRunStatus,
        triggerType: "note_inactivity",
        userId: "user-1",
      },
    };
  }

  if (url.pathname === "/api/signals") {
    return {
      signals: state.capturedNote
        ? [
            {
              createdAt: "2026-07-03T08:30:01.000Z",
              id: "event-1",
              occurredAt: "2026-07-03T08:30:00.000Z",
              payload: { note: state.capturedNote },
              schemaVersion: 1,
              source: "desktop_app",
              type: "manual_check_in_submitted",
              userId: "user-1",
            },
          ]
        : [],
    };
  }

  if (url.pathname.startsWith("/api/journal/")) {
    return {
      document: {
        bodyText: state.savedJournalBodyText,
        createdAt: "2026-07-03T08:30:00.000Z",
        id: "journal-1",
        localDate: "2026-07-03",
        title: "2026-07-03",
        updatedAt: "2026-07-03T08:30:00.000Z",
        userId: "user-1",
      },
    };
  }

  if (url.pathname === "/api/journal") {
    return {
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
        bodyText: state.savedJournalBodyText,
        createdAt: "2026-07-03T08:30:00.000Z",
        id: "journal-1",
        localDate: "2026-07-03",
        title: "2026-07-03",
        updatedAt: "2026-07-03T08:31:00.000Z",
        userId: "user-1",
      },
      revision: {
        bodyText: state.savedJournalBodyText,
        changeHash: "desktop-e2e",
        changedText: readStringProperty(body, "bodyText") ?? "",
        createdAt: "2026-07-03T08:31:00.000Z",
        documentId: "journal-1",
        id: "revision-2",
        revisionNumber: 2,
        userId: "user-1",
      },
    };
  }

  if (url.pathname === "/api/actions/action-1/status") {
    return {
      action: {
        body: "Confirm the desktop app review.",
        confidence: 0.91,
        createdAt: "2026-07-03T08:30:00.000Z",
        id: "action-1",
        kind: "follow_up",
        status: state.actionStatus,
        title: "Confirm desktop review",
        updatedAt: "2026-07-03T08:32:00.000Z",
      },
    };
  }

  if (url.pathname === "/api/captures") {
    const payload = readObjectProperty(body, "payload");
    return {
      createdAt: "2026-07-03T08:31:01.000Z",
      id: "event-1",
      occurredAt: "2026-07-03T08:31:00.000Z",
      payload,
      schemaVersion: 1,
      source: "desktop_app",
      type: "manual_check_in_submitted",
      userId: "user-1",
    };
  }

  return { error: "missing route" };
}

async function serveBuiltWebAsset(pathname: string) {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const relativePath = decodeURIComponent(normalizedPath.replace(/^\/+/, ""));
  if (!relativePath || relativePath.includes("..")) {
    return new Response("missing route", { status: 404 });
  }

  const filePath = join(webDistRoot, relativePath);
  const file = Bun.file(filePath);
  if (!(await file.exists())) return new Response("missing route", { status: 404 });

  return new Response(file, {
    headers: { "content-type": contentTypeFor(filePath) },
  });
}

function contentTypeFor(filePath: string) {
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  if (filePath.endsWith(".js")) return "text/javascript";
  if (filePath.endsWith(".json") || filePath.endsWith(".webmanifest")) {
    return "application/json";
  }
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function desktopE2eHarnessHtml() {
  return `<!doctype html>
<html>
  <head><title>Nudge E2E</title></head>
  <body>
    <main>Loading Nudge Desktop</main>
    <script>
      window.nudgeDesktopE2E = (async () => {
        const surface = window.nudgeDesktop?.surface ?? "missing";
        const headers = { "content-type": "application/json", "x-nudge-client": surface };
        const mediaResponse = await fetch("/api/media", {
          method: "POST",
          headers,
          body: JSON.stringify({
            byteLength: 11,
            dataBase64: "aW1hZ2UgYnl0ZXM=",
            id: "550e8400-e29b-41d4-a716-446655440000",
            kind: "image",
            label: "Desktop photo",
            mimeType: "image/png"
          })
        });
        const media = await mediaResponse.json();
        const journalResponse = await fetch("/api/journal", {
          method: "POST",
          headers,
          body: JSON.stringify({
            bodyDocument: [
              { type: "p", children: [{ text: "Desktop launch review" }] },
              {
                type: "img",
                attrs: {
                  alt: media.label,
                  id: media.id,
                  mimeType: media.mimeType,
                  src: media.url
                }
              }
            ],
            bodyText: "Desktop launch review",
            localDate: "2026-07-03",
            title: "2026-07-03"
          })
        });
        const journal = await journalResponse.json();
        const captureResponse = await fetch("/api/captures", {
          method: "POST",
          headers,
          body: JSON.stringify({
            idempotencyKey: "desktop:e2e",
            occurredAt: "2026-07-03T08:30:00.000Z",
            payload: {
              attachments: [{
                id: media.id,
                kind: media.kind,
                label: media.label,
                mimeType: media.mimeType,
                url: media.url
              }],
              note: "Desktop launch review"
            },
            schemaVersion: 1,
            source: "desktop_app",
            type: "manual_check_in_submitted"
          })
        });
        const capture = await captureResponse.json();
        const [session, calendarDays, actions, signals, refreshedJournal] = await Promise.all([
          fetch("/api/session", { headers }).then((response) => response.json()),
          fetch("/api/calendar/days?timeZone=Europe%2FStockholm", { headers }).then((response) => response.json()),
          fetch("/api/actions?limit=24", { headers }).then((response) => response.json()),
          fetch("/api/signals?limit=24", { headers }).then((response) => response.json()),
          fetch("/api/journal/2026-07-03", { headers }).then((response) => response.json())
        ]);
        const result = {
          calendarDayCount: calendarDays.days.length,
          captureAttachmentCount: capture.payload.attachments.length,
          captureSource: capture.source,
          journalHasMedia: journal.document.bodyDocument.some((block) => block.type === "img"),
          journalTitle: journal.document.title,
          mediaUrl: media.url,
          openActionCount: actions.actions.length,
          refreshedJournalTitle: refreshedJournal.document.title,
          signalSource: signals.signals[0].source,
          surface,
          userDisplayName: session.user.displayName
        };
        document.body.innerHTML = "<main>Desktop saved " + result.journalTitle + " from " + result.captureSource + "</main>";
        return result;
      })();
    </script>
  </body>
</html>`;
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function readStringProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "string" ? property : undefined;
}

function startDesktopOutputBuffer() {
  const chunks: string[] = [];
  return {
    push: (chunk: Buffer) => {
      chunks.push(chunk.toString("utf8"));
      if (chunks.join("").length > 12_000) chunks.splice(0, chunks.length - 8);
    },
    text: () => chunks.join("").trim(),
  };
}

function captureDesktopOutput(
  childProcess: ChildProcess,
  output: ReturnType<typeof startDesktopOutputBuffer>,
) {
  childProcess.stdout?.on("data", output.push);
  childProcess.stderr?.on("data", output.push);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function waitForJsonFile(path: string) {
  return await new Promise<unknown>((resolve, reject) => {
    let lastError: unknown;
    let reading = false;
    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Timed out waiting for ${path}: ${String(lastError)}`));
    }, 15_000);
    const read = () => {
      if (reading) return;
      reading = true;
      void readFile(path, "utf8")
        .then((text) => {
          if (!text.trim()) return;
          let receipt: unknown;
          try {
            receipt = JSON.parse(text);
          } catch (error) {
            lastError = error;
            return;
          }
          clearTimeout(timeout);
          clearInterval(interval);
          resolve(receipt);
        })
        .catch((error: unknown) => {
          lastError = error;
        })
        .finally(() => {
          reading = false;
        });
    };
    const interval = setInterval(read, 100);

    read();
  });
}
