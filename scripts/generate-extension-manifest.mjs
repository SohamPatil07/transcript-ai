import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, "package.json");
const cliMode = readCliMode(process.argv.slice(2));
const isProduction = cliMode === "production";
const envPath = path.join(rootDir, isProduction ? ".env.production" : ".env");
const manifestPath = path.join(rootDir, "extension", "public", "manifest.json");

const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
const env = await readEnvFile(envPath);
const productionConfig = packageJson.transcriptAi || {};

const backendBaseUrl =
  env.VITE_EXTENSION_API_BASE_URL ||
  productionConfig.productionApiUrl ||
  env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8888";
const hostPermissions = unique([
  "https://www.youtube.com/*",
  "https://youtube.com/*",
  "https://m.youtube.com/*",
  "https://youtu.be/*",
  toHostPermission(backendBaseUrl),
]);

const connectSrc = unique([
  "'self'",
  normalizeOrigin(backendBaseUrl),
]);

const frameSrc = unique([
  "'self'",
]);

const manifest = {
  manifest_version: 3,
  name: "Transcript AI",
  description: "Fetch YouTube transcripts from a Chrome side panel using Transcript AI.",
  version: packageJson.version,
  permissions: ["sidePanel", "activeTab", "tabs", "storage"],
  host_permissions: hostPermissions,
  action: {
    default_title: "Open Transcript AI",
  },
  background: {
    service_worker: "background.js",
  },
  side_panel: {
    default_path: "sidepanel.html",
  },
  content_security_policy: {
    extension_pages: `script-src 'self'; object-src 'self'; connect-src ${connectSrc.join(" ")}; frame-src ${frameSrc.join(" ")};`,
  },
};

await fs.mkdir(path.dirname(manifestPath), { recursive: true });
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

function readCliMode(args) {
  const modeIndex = args.indexOf("--mode");
  if (modeIndex >= 0 && args[modeIndex + 1]) {
    return args[modeIndex + 1] === "production" ? "production" : "development";
  }

  return process.env.NODE_ENV === "production" ? "production" : "development";
}

async function readEnvFile(targetPath) {
  try {
    const contents = await fs.readFile(targetPath, "utf8");
    const pairs = {};

    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (key) pairs[key] = value;
    }

    return pairs;
  } catch {
    return {};
  }
}

function toHostPermission(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}/*`;
  } catch {
    return "http://127.0.0.1:8888/*";
  }
}

function normalizeOrigin(rawUrl) {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return "http://127.0.0.1:8888";
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
