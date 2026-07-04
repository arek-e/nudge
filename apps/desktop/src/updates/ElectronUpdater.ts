import { createRequire } from "node:module";
import { Context, Effect, Layer } from "effect";

const requireElectronUpdater = createRequire(import.meta.url);
const electronUpdater: typeof import("electron-updater") =
  requireElectronUpdater("electron-updater");

export type ElectronUpdaterEventName =
  | "checking-for-update"
  | "download-progress"
  | "error"
  | "update-available"
  | "update-downloaded"
  | "update-not-available";

export type ElectronUpdaterListener = (payload: unknown) => void;

export interface ElectronUpdaterService {
  readonly checkForUpdates: Effect.Effect<void, Error>;
  readonly downloadUpdate: Effect.Effect<void, Error>;
  readonly on: (
    eventName: ElectronUpdaterEventName,
    listener: ElectronUpdaterListener,
  ) => Effect.Effect<void>;
  readonly quitAndInstall: Effect.Effect<void, Error>;
  readonly setAutoDownload: (value: boolean) => Effect.Effect<void>;
  readonly setAutoInstallOnAppQuit: (value: boolean) => Effect.Effect<void>;
}

export class ElectronUpdater extends Context.Service<ElectronUpdater, ElectronUpdaterService>()(
  "nudge/desktop/ElectronUpdater",
) {}

export const ElectronUpdaterLive = Layer.effect(
  ElectronUpdater,
  Effect.sync(() =>
    ElectronUpdater.of({
      checkForUpdates: Effect.tryPromise({
        catch: updateErrorFromUnknown,
        try: async () => {
          await getAutoUpdater().checkForUpdates();
        },
      }),
      downloadUpdate: Effect.tryPromise({
        catch: updateErrorFromUnknown,
        try: async () => {
          await getAutoUpdater().downloadUpdate();
        },
      }),
      on: (eventName, listener) =>
        Effect.sync(() => {
          registerElectronUpdaterListener(eventName, listener);
        }),
      quitAndInstall: Effect.try({
        catch: updateErrorFromUnknown,
        try: () => {
          getAutoUpdater().quitAndInstall(false, true);
        },
      }),
      setAutoDownload: (value) =>
        Effect.sync(() => {
          getAutoUpdater().autoDownload = value;
        }),
      setAutoInstallOnAppQuit: (value) =>
        Effect.sync(() => {
          getAutoUpdater().autoInstallOnAppQuit = value;
        }),
    }),
  ),
);

function registerElectronUpdaterListener(
  eventName: ElectronUpdaterEventName,
  listener: ElectronUpdaterListener,
) {
  switch (eventName) {
    case "checking-for-update":
      getAutoUpdater().on("checking-for-update", () => listener(null));
      break;
    case "download-progress":
      getAutoUpdater().on("download-progress", (progress) => listener(progress));
      break;
    case "error":
      getAutoUpdater().on("error", (error) => listener(error));
      break;
    case "update-available":
      getAutoUpdater().on("update-available", (info) => listener(info));
      break;
    case "update-downloaded":
      getAutoUpdater().on("update-downloaded", (info) => listener(info));
      break;
    case "update-not-available":
      getAutoUpdater().on("update-not-available", (info) => listener(info));
      break;
  }
}

function getAutoUpdater() {
  return electronUpdater.autoUpdater;
}

function updateErrorFromUnknown(error: unknown) {
  if (error instanceof Error) return error;
  return new Error(String(error));
}
