import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("nudgeDesktop", {
  appVersion: "0.1.0",
  surface: "desktop",
});
