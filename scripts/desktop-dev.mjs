import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const ansiPattern = /\u001B\[[0-9;]*m/g;
const viteCommand = isWindows ? ".\\node_modules\\.bin\\vite.cmd --host 127.0.0.1" : "./node_modules/.bin/vite --host 127.0.0.1";
const electronCommand = isWindows ? ".\\node_modules\\.bin\\electron.cmd ." : "./node_modules/.bin/electron .";

const vite = spawnCommand(viteCommand, {
  stdio: ["inherit", "pipe", "pipe"],
});

let electronStarted = false;
let shuttingDown = false;
let electronProcess = null;

vite.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);

  if (electronStarted) return;

  const normalizedText = text.replace(ansiPattern, "");
  const urlMatch = normalizedText.match(/Local:\s+(http:\/\/[^\s]+)/i);
  if (!urlMatch?.[1]) return;

  electronStarted = true;
  const startUrl = urlMatch[1].replace("localhost", "127.0.0.1");
  process.stdout.write(`\n[desktop] Launching Electron at ${startUrl}\n`);
  electronProcess = spawnCommand(electronCommand, {
    env: {
      ...process.env,
      ELECTRON_START_URL: startUrl,
    },
    stdio: "inherit",
  });

  electronProcess.on("exit", (code) => {
    if (!shuttingDown) {
      shuttingDown = true;
      vite.kill();
      process.exit(code ?? 0);
    }
  });
});

vite.stderr.on("data", (chunk) => {
  process.stderr.write(chunk.toString());
});

vite.on("exit", (code) => {
  if (!shuttingDown) {
    shuttingDown = true;
    if (electronProcess) electronProcess.kill();
    process.exit(code ?? 0);
  }
});

setTimeout(() => {
  if (!electronStarted) {
    process.stderr.write(
      "\n[desktop] Vite started but Electron was not launched. If you do not see a 'Launching Electron' line, paste this terminal output here.\n",
    );
  }
}, 6000);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (electronProcess) electronProcess.kill(signal);
    vite.kill(signal);
  });
}

function spawnCommand(command, options = {}) {
  return spawn(command, {
    cwd: process.cwd(),
    env: process.env,
    shell: isWindows,
    ...options,
  });
}
