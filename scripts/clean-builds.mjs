#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

const isWindows = process.platform === "win32";
const args = process.argv.slice(2);
const isForce = args.includes("--force") || args.includes("-f") || args.includes("-Force");
const isHelp = args.includes("--help") || args.includes("-h") || args.includes("-Help");

if (isHelp) {
  console.log("Forge Wisper Build Cleanup Utility");
  console.log("\nUsage: node scripts/clean-builds.mjs [--force] [--help]");
  console.log("\nOptions:");
  console.log("  --force, -f    Bypass confirmation prompt (non-interactive mode)");
  console.log("  --help, -h     Show this help message");
  process.exit(0);
}

if (isWindows) {
  const scriptPath = path.join(__dirname, "clean-windows-builds.ps1");
  const psArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath];
  if (isForce) psArgs.push("-Force");

  const child = spawn("powershell.exe", psArgs, {
    stdio: "inherit",
    cwd: workspaceRoot,
    shell: false,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
} else {
  // macOS / Linux cleanup
  const targets = [
    path.join(workspaceRoot, "target"),
    path.join(workspaceRoot, "apps", "desktop", "dist"),
    path.join(workspaceRoot, "apps", "desktop", "node_modules", ".vite"),
  ];

  const existing = targets.filter((p) => fs.existsSync(p));

  if (existing.length === 0) {
    console.log("[OK] No build artifacts to clean. Workspace is clean.");
    process.exit(0);
  }

  console.log("Build targets identified for cleanup:");
  existing.forEach((p) => console.log(`  - ${p}`));

  const performClean = () => {
    let count = 0;
    for (const p of existing) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
        console.log(`[OK] Removed: ${p}`);
        count++;
      } catch (err) {
        console.error(`[!] Failed to remove ${p}:`, err.message);
      }
    }
    console.log(`[OK] Cleaned ${count} directory/directories successfully.`);
  };

  if (isForce) {
    performClean();
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Are you sure you want to delete these build artifacts? (y/N) ", (ans) => {
      rl.close();
      if (/^[yY]([eE][sS])?$/.test(ans.trim())) {
        performClean();
      } else {
        console.log("[i] Cleanup cancelled by user.");
      }
    });
  }
}
