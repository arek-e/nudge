import { Context, Effect, Layer, Ref } from "effect";
import { ElectronUpdater } from "./ElectronUpdater.js";

export type DesktopUpdateStatus =
  | "available"
  | "checking"
  | "disabled"
  | "downloaded"
  | "downloading"
  | "error"
  | "idle"
  | "up-to-date";

export type DesktopUpdateCheckReason = "manual" | "periodic" | "startup";

export interface DesktopUpdateState {
  readonly availableVersion: string | null;
  readonly canRetry: boolean;
  readonly currentVersion: string;
  readonly downloadedVersion: string | null;
  readonly downloadPercent: number | null;
  readonly enabled: boolean;
  readonly message: string | null;
  readonly status: DesktopUpdateStatus;
}

export interface DesktopUpdateActionResult {
  readonly accepted: boolean;
  readonly completed: boolean;
  readonly state: DesktopUpdateState;
}

export interface DesktopUpdatesService {
  readonly check: (reason: DesktopUpdateCheckReason) => Effect.Effect<DesktopUpdateActionResult>;
  readonly configure: Effect.Effect<void>;
  readonly download: () => Effect.Effect<DesktopUpdateActionResult>;
  readonly getState: Effect.Effect<DesktopUpdateState>;
  readonly install: () => Effect.Effect<DesktopUpdateActionResult>;
}

interface MakeDesktopUpdatesLayerInput {
  readonly currentVersion: string;
  readonly emitState: (state: DesktopUpdateState) => Promise<void> | void;
  readonly enabled: boolean;
}

export class DesktopUpdates extends Context.Service<DesktopUpdates, DesktopUpdatesService>()(
  "nudge/desktop/DesktopUpdates",
) {}

export function makeDesktopUpdatesLayer(input: MakeDesktopUpdatesLayerInput) {
  return Layer.effect(
    DesktopUpdates,
    Effect.gen(function* () {
      const updater = yield* ElectronUpdater;
      const stateRef = yield* Ref.make(initialDesktopUpdateState(input));
      const configuredRef = yield* Ref.make(false);

      const emitState = (state: DesktopUpdateState) =>
        Effect.tryPromise({
          catch: errorFromUnknown,
          try: async () => {
            await input.emitState(state);
          },
        }).pipe(Effect.catch(() => Effect.void));

      const setState = (state: DesktopUpdateState) =>
        Effect.gen(function* () {
          yield* Ref.set(stateRef, state);
          yield* emitState(state);
          return state;
        });

      const patchState = (patch: (state: DesktopUpdateState) => DesktopUpdateState) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          return yield* setState(patch(state));
        });

      const registerHandlers = Effect.gen(function* () {
        yield* updater.on("checking-for-update", () => {
          runEventEffect(
            patchState((state) => ({
              ...state,
              canRetry: false,
              message: null,
              status: "checking",
            })),
          );
        });
        yield* updater.on("update-available", (payload) => {
          const version = versionFromPayload(payload);
          runEventEffect(
            patchState((state) => ({
              ...state,
              availableVersion: version ?? state.availableVersion,
              canRetry: false,
              downloadPercent: null,
              message: null,
              status: "available",
            })),
          );
        });
        yield* updater.on("update-not-available", () => {
          runEventEffect(
            patchState((state) => ({
              ...state,
              availableVersion: null,
              canRetry: false,
              downloadPercent: null,
              downloadedVersion: null,
              message: null,
              status: "up-to-date",
            })),
          );
        });
        yield* updater.on("download-progress", (payload) => {
          const downloadPercent = percentFromPayload(payload);
          runEventEffect(
            patchState((state) => ({
              ...state,
              downloadPercent: downloadPercent ?? state.downloadPercent,
              status: "downloading",
            })),
          );
        });
        yield* updater.on("update-downloaded", (payload) => {
          const version = versionFromPayload(payload);
          runEventEffect(
            patchState((state) => ({
              ...state,
              canRetry: false,
              downloadPercent: 100,
              downloadedVersion: version ?? state.availableVersion,
              message: null,
              status: "downloaded",
            })),
          );
        });
        yield* updater.on("error", (payload) => {
          runEventEffect(
            patchState((state) => ({
              ...state,
              canRetry: true,
              message: errorMessageFromUnknown(payload),
              status: "error",
            })),
          );
        });
      });

      const configure = Effect.gen(function* () {
        const configured = yield* Ref.get(configuredRef);
        if (configured) return;
        yield* Ref.set(configuredRef, true);

        if (!input.enabled) {
          yield* setState(initialDesktopUpdateState(input));
          return;
        }

        yield* updater.setAutoDownload(false);
        yield* updater.setAutoInstallOnAppQuit(false);
        yield* registerHandlers;
        yield* setState(initialDesktopUpdateState(input));
      });

      const check = (reason: DesktopUpdateCheckReason) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (!canCheckForUpdate(state, reason)) return ignoredResult(state);

          yield* setState({
            ...state,
            canRetry: false,
            message: null,
            status: "checking",
          });
          yield* updater.checkForUpdates.pipe(
            Effect.catch((error) =>
              Effect.gen(function* () {
                yield* patchState((current) => ({
                  ...current,
                  canRetry: true,
                  message: error.message,
                  status: "error",
                }));
              }),
            ),
          );
          const nextState = yield* Ref.get(stateRef);
          return {
            accepted: true,
            completed: nextState.status === "available" || nextState.status === "up-to-date",
            state: nextState,
          };
        });

      const download = () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (!canDownloadUpdate(state)) return ignoredResult(state);

          yield* setState({
            ...state,
            canRetry: false,
            downloadPercent: 0,
            message: null,
            status: "downloading",
          });
          yield* updater.downloadUpdate.pipe(
            Effect.catch((error) =>
              Effect.gen(function* () {
                yield* patchState((current) => ({
                  ...current,
                  canRetry: true,
                  message: error.message,
                  status: "error",
                }));
              }),
            ),
          );
          const nextState = yield* Ref.get(stateRef);
          return {
            accepted: true,
            completed: nextState.status === "downloaded",
            state: nextState,
          };
        });

      const install = () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (state.status !== "downloaded") return ignoredResult(state);

          yield* updater.quitAndInstall.pipe(
            Effect.catch((error) =>
              Effect.gen(function* () {
                yield* patchState((current) => ({
                  ...current,
                  canRetry: true,
                  message: error.message,
                  status: "error",
                }));
              }),
            ),
          );
          const nextState = yield* Ref.get(stateRef);
          return {
            accepted: true,
            completed: nextState.status === "downloaded",
            state: nextState,
          };
        });

      return DesktopUpdates.of({
        check,
        configure,
        download,
        getState: Ref.get(stateRef),
        install,
      });
    }),
  );
}

function initialDesktopUpdateState(input: MakeDesktopUpdatesLayerInput): DesktopUpdateState {
  return {
    availableVersion: null,
    canRetry: false,
    currentVersion: input.currentVersion,
    downloadedVersion: null,
    downloadPercent: null,
    enabled: input.enabled,
    message: null,
    status: input.enabled ? "idle" : "disabled",
  };
}

function canCheckForUpdate(state: DesktopUpdateState, reason: DesktopUpdateCheckReason) {
  if (!state.enabled) return false;
  if (state.status === "checking" || state.status === "downloading") return false;
  if (state.status === "downloaded") return false;
  return reason === "manual" || state.status !== "error";
}

function canDownloadUpdate(state: DesktopUpdateState) {
  if (!state.enabled) return false;
  if (state.status === "downloading" || state.status === "downloaded") return false;
  return (
    state.availableVersion !== null && (state.status === "available" || state.status === "error")
  );
}

function ignoredResult(state: DesktopUpdateState): DesktopUpdateActionResult {
  return {
    accepted: false,
    completed: false,
    state,
  };
}

function versionFromPayload(payload: unknown) {
  return stringField(payload, "version");
}

function percentFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const percent = Reflect.get(payload, "percent");
  if (typeof percent !== "number" || !Number.isFinite(percent)) return null;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function stringField(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const field = Reflect.get(value, key);
  const stringValue = typeof field === "string" ? field.trim() : "";
  return stringValue.length > 0 ? stringValue : null;
}

function errorMessageFromUnknown(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return "Desktop update failed.";
}

function errorFromUnknown(value: unknown) {
  if (value instanceof Error) return value;
  return new Error(errorMessageFromUnknown(value));
}

function runEventEffect(effect: Effect.Effect<void>) {
  void Effect.runPromise(effect);
}
