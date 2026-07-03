import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { DesktopUpdates, makeDesktopUpdatesLayer } from "./DesktopUpdates";
import {
  ElectronUpdater,
  type ElectronUpdaterEventName,
  type ElectronUpdaterListener,
} from "./ElectronUpdater";

describe("DesktopUpdates", () => {
  test("checks, downloads, and installs an available update", async () => {
    const emittedStatuses: string[] = [];
    const listeners = new Map<ElectronUpdaterEventName, ElectronUpdaterListener[]>();
    let quitAndInstallCalls = 0;

    const emit = (eventName: ElectronUpdaterEventName, payload: unknown) => {
      const eventListeners = listeners.get(eventName) ?? [];
      for (const listener of eventListeners) listener(payload);
    };

    const fakeUpdater = ElectronUpdater.of({
      checkForUpdates: Effect.sync(() => {
        emit("update-available", { version: "0.2.0" });
      }),
      downloadUpdate: Effect.sync(() => {
        emit("download-progress", { percent: 42 });
        emit("update-downloaded", { version: "0.2.0" });
      }),
      on: (eventName, listener) =>
        Effect.sync(() => {
          const eventListeners = listeners.get(eventName) ?? [];
          listeners.set(eventName, [...eventListeners, listener]);
        }),
      quitAndInstall: Effect.sync(() => {
        quitAndInstallCalls += 1;
      }),
      setAutoDownload: () => Effect.void,
      setAutoInstallOnAppQuit: () => Effect.void,
    });

    const layer = makeDesktopUpdatesLayer({
      currentVersion: "0.1.0",
      emitState: (state) => {
        emittedStatuses.push(state.status);
      },
      enabled: true,
    }).pipe(Layer.provide(Layer.succeed(ElectronUpdater, fakeUpdater)));

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const updates = yield* DesktopUpdates;
        yield* updates.configure;
        const checked = yield* updates.check("manual");
        const downloaded = yield* updates.download();
        const installed = yield* updates.install();
        const state = yield* updates.getState;
        return { checked, downloaded, installed, state };
      }).pipe(Effect.provide(layer)),
    );

    expect(result.checked.state).toMatchObject({
      availableVersion: "0.2.0",
      status: "available",
    });
    expect(result.downloaded.state).toMatchObject({
      downloadPercent: 100,
      downloadedVersion: "0.2.0",
      status: "downloaded",
    });
    expect(result.installed).toMatchObject({
      accepted: true,
      completed: true,
    });
    expect(result.state.status).toBe("downloaded");
    expect(quitAndInstallCalls).toBe(1);
    expect(emittedStatuses).toEqual([
      "idle",
      "checking",
      "available",
      "downloading",
      "downloading",
      "downloaded",
    ]);
  });
});
