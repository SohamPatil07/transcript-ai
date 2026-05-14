import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopApp", {
  isDesktop: true,
  apiBaseUrl: process.env.DESKTOP_API_BASE_URL || "",
  onLoadError: (callback) => {
    ipcRenderer.on("load-error", (event, error) => callback(error));
  },
});
