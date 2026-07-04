import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

const desktopAuthCallbackUrl = "nudge://auth/callback";
const desktopAppVersionArgumentPrefix = "--nudge-app-version=";

contextBridge.exposeInMainWorld("nudgeDesktop", {
  appVersion: desktopAppVersionFromArguments(),
  authCallbackUrl: desktopAuthCallbackUrl,
  checkForUpdate: () => ipcRenderer.invoke("nudge:update-check"),
  downloadUpdate: () => ipcRenderer.invoke("nudge:update-download"),
  getSettings: () => ipcRenderer.invoke("nudge:desktop-settings-get"),
  getUpdateState: () => ipcRenderer.invoke("nudge:update-get-state"),
  installUpdate: () => ipcRenderer.invoke("nudge:update-install"),
  onUpdateState: (listener: (state: unknown) => void) => {
    const subscription = (_event: IpcRendererEvent, state: unknown) => {
      listener(state);
    };
    ipcRenderer.on("nudge:update-state", subscription);
    return () => {
      ipcRenderer.removeListener("nudge:update-state", subscription);
    };
  },
  openExternalAuth: (url: string) => ipcRenderer.invoke("nudge:open-external-auth", url),
  setSettings: (settings: unknown) => ipcRenderer.invoke("nudge:desktop-settings-set", settings),
  surface: "desktop",
});

contextBridge.exposeInMainWorld("nudgeDesktopQuickCapture", {
  close: () => ipcRenderer.invoke("nudge:quick-capture-close"),
  submitted: () => ipcRenderer.invoke("nudge:quick-capture-submitted"),
});

function desktopAppVersionFromArguments() {
  const argument = process.argv.find((value) => value.startsWith(desktopAppVersionArgumentPrefix));
  const version = argument?.slice(desktopAppVersionArgumentPrefix.length).trim();
  return version && version.length > 0 ? version : "0.0.0";
}
