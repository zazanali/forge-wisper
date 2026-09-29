#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const desktopDir = path.resolve(workspaceRoot, "apps", "desktop");

const isWindows = process.platform === "win32";
const args = process.argv.slice(2);

if (isWindows) {
  const scriptPath = path.join(__dirname, "windows-dev.ps1");
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args],
    {
      stdio: "inherit",
      cwd: workspaceRoot,
      shell: false,
    }
  );

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
} else {
  const tauriCmd = args[0] || "dev";
  const extraArgs = args.slice(1);
  const child = spawn("npx", ["tauri", tauriCmd, ...extraArgs], {
    stdio: "inherit",
    cwd: desktopDir,
    shell: true,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}
