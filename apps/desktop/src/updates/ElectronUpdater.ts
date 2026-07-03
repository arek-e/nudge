import { autoUpdater } from "electron-updater";
import { Context, Effect, Layer } from "effect";

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
          await autoUpdater.checkForUpdates();
        },
      }),
      downloadUpdate: Effect.tryPromise({
        catch: updateErrorFromUnknown,
        try: async () => {
          await autoUpdater.downloadUpdate();
        },
      }),
      on: (eventName, listener) =>
        Effect.sync(() => {
          registerElectronUpdaterListener(eventName, listener);
        }),
      quitAndInstall: Effect.try({
        catch: updateErrorFromUnknown,
        try: () => {
          autoUpdater.quitAndInstall(false, true);
        },
      }),
      setAutoDownload: (value) =>
        Effect.sync(() => {
          autoUpdater.autoDownload = value;
        }),
      setAutoInstallOnAppQuit: (value) =>
        Effect.sync(() => {
          autoUpdater.autoInstallOnAppQuit = value;
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
      autoUpdater.on("checking-for-update", () => listener(null));
      break;
    case "download-progress":
      autoUpdater.on("download-progress", (progress) => listener(progress));
      break;
    case "error":
      autoUpdater.on("error", (error) => listener(error));
      break;
    case "update-available":
      autoUpdater.on("update-available", (info) => listener(info));
      break;
    case "update-downloaded":
      autoUpdater.on("update-downloaded", (info) => listener(info));
      break;
    case "update-not-available":
      autoUpdater.on("update-not-available", (info) => listener(info));
      break;
  }
}

function updateErrorFromUnknown(error: unknown) {
  if (error instanceof Error) return error;
  return new Error(String(error));
}
