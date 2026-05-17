import { app, BrowserWindow, Menu, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const productionConfig = packageJson.transcriptAi || {};
const productionAppUrl = process.env.DESKTOP_APP_URL || productionConfig.productionAppUrl || "";

app.setPath("userData", path.join(app.getPath("appData"), "Transcript AI"));
app.setPath("sessionData", path.join(app.getPath("userData"), "session"));

const isDev = Boolean(process.env.ELECTRON_START_URL);

// Serve static files via HTTP in production (required for Clerk OAuth redirects)
function startStaticServer(distPath) {
  const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".json": "application/json",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      let filePath = path.join(distPath, url.pathname === "/" ? "index.html" : url.pathname);

      // SPA fallback - serve index.html for non-file routes (for Clerk redirects)
      // SPA fallback - serve index.html for non-file routes (for Clerk redirects)
      if (!existsSync(filePath) || (!path.extname(filePath) && !url.pathname.endsWith("/"))) {
        filePath = path.join(distPath, "index.html");
      }

      try {
        const content = readFileSync(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      console.log(`Static server running at http://127.0.0.1:${port}`);
      resolve(`http://127.0.0.1:${port}`);
    });
    server.on("error", reject);
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    autoHideMenuBar: false,
    show: false,
    backgroundColor: "#f4f6fa",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Failed to load:", errorCode, errorDescription);
    if (!isDev) {
      mainWindow.webContents.send("load-error", { code: errorCode, description: errorDescription });
    }
  });

  mainWindow.webContents.on("render-process-gone", (event, details) => {
    console.error("Render process gone:", details);
  });

  const externalHosts = ["youtube.com", "youtu.be"];

  // Handle Clerk auth popup windows within Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const urlObj = new URL(url);
    // Allow Clerk and Google auth windows to open inside Electron
    if (
      urlObj.hostname.includes("clerk.com") ||
      urlObj.hostname.includes("accounts.dev") ||
      urlObj.hostname.includes("clerk.accounts.dev") ||
      urlObj.hostname.includes("accounts.google.com")
    ) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
        },
      };
    }
    // Allow the app's own URLs to open in Electron
    if (isDev && url.startsWith(process.env.ELECTRON_START_URL)) {
      return { action: "allow" };
    }
    // For other external URLs, open in system browser
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowedDevOrigin = process.env.ELECTRON_START_URL;
    const sameDevOrigin = allowedDevOrigin && url.startsWith(allowedDevOrigin.replace(/\/$/, ""));

    if (sameDevOrigin) return;

    try {
      const target = new URL(url);
      if (externalHosts.some((host) => target.hostname.endsWith(host))) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else if (productionAppUrl) {
    mainWindow.loadURL(productionAppUrl).catch((error) => {
      console.error("Failed to load configured production app URL:", error);
      loadBundledApp(mainWindow);
    });
  } else {
    loadBundledApp(mainWindow);
  }
}

function loadBundledApp(mainWindow) {
  // Start local HTTP server and load from there (required for Clerk OAuth redirects).
  startStaticServer(path.join(__dirname, "..", "dist")).then((serverUrl) => {
    mainWindow.loadURL(serverUrl);
  }).catch((error) => {
    console.error("Failed to start bundled static server:", error);
    // Fallback to file:// so the UI is still visible even if auth is limited.
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [{ role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
  ]));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
