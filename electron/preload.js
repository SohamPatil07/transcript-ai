import path from "node:path";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { contextBridge, ipcRenderer } = require("electron");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const productionConfig = packageJson.transcriptAi || {};
const resolvedApiBaseUrl =
  process.env.DESKTOP_API_BASE_URL ||
  productionConfig.productionApiUrl ||
  productionConfig.productionAppUrl ||
  "";

contextBridge.exposeInMainWorld("desktopApp", {
  isDesktop: true,
  apiBaseUrl: resolvedApiBaseUrl,
  onLoadError: (callback) => {
    ipcRenderer.on("load-error", (event, error) => callback(error));
  },
});
