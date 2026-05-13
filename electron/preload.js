import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("desktopApp", {
  isDesktop: true,
  apiBaseUrl: process.env.DESKTOP_API_BASE_URL || "",
});
