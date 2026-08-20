/**
 * 构建 Windows 客户端并发布到 public/app：
 * - yyds-windows-setup.exe（NSIS 安装包：可选路径 + 桌面/开始菜单快捷方式）
 * - yyds-windows.exe（便携版）
 * - yyds-windows.zip（便携版压缩，浏览器拦截更少）
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopDir = path.join(root, "desktop");
const distDir = path.join(desktopDir, "dist");
const outDir = path.join(root, "public", "app");
const outSetup = path.join(outDir, "yyds-windows-setup.exe");
const outExe = path.join(outDir, "yyds-windows.exe");
const outZip = path.join(outDir, "yyds-windows.zip");
const isWin = process.platform === "win32";

function run(cmd, args, cwd) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    shell: isWin,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

/** 用系统压缩打 zip，避免浏览器对裸 .exe 的「通常不会下载」拦截 */
function zipExe(exePath, zipPath) {
  if (existsSync(zipPath)) unlinkSync(zipPath);
  if (isWin) {
    const ps = [
      "Compress-Archive",
      "-LiteralPath",
      exePath,
      "-DestinationPath",
      zipPath,
      "-Force",
    ];
    run("powershell", ["-NoProfile", "-Command", ps.join(" ")], outDir);
    return;
  }
  run("zip", ["-j", zipPath, exePath], outDir);
}

function findArtifact(preferredNames, fallbackPredicate) {
  for (const name of preferredNames) {
    const p = path.join(distDir, name);
    if (existsSync(p)) return p;
  }
  if (!existsSync(distDir)) return null;
  const hits = readdirSync(distDir)
    .filter((name) => fallbackPredicate(name.toLowerCase()))
    .map((name) => path.join(distDir, name));
  return hits[0] || null;
}

if (!existsSync(path.join(desktopDir, "package.json"))) {
  console.error("未找到 desktop/package.json");
  process.exit(1);
}

if (!existsSync(path.join(desktopDir, "node_modules", "electron"))) {
  console.log("Installing desktop dependencies…");
  run("npm", ["install"], desktopDir);
}

console.log("Packaging Windows NSIS installer + portable…");
run("npm", ["run", "pack"], desktopDir);

mkdirSync(outDir, { recursive: true });

const setupBuilt = findArtifact(
  ["yyds-windows-setup.exe"],
  (n) => n.endsWith(".exe") && (n.includes("setup") || n.includes("安装")),
);
const portableBuilt = findArtifact(
  ["yyds-windows.exe"],
  (n) =>
    n.endsWith(".exe") &&
    !n.includes("setup") &&
    !n.includes("安装") &&
    !n.includes("uninstall"),
);

if (!setupBuilt && !portableBuilt) {
  console.error("未找到构建产物 .exe，请检查 desktop/dist");
  process.exit(1);
}

if (setupBuilt) {
  copyFileSync(setupBuilt, outSetup);
  console.log("Windows setup ready:", outSetup);
} else {
  console.warn("未生成 NSIS 安装包（yyds-windows-setup.exe）");
}

if (portableBuilt) {
  copyFileSync(portableBuilt, outExe);
  zipExe(outExe, outZip);
  console.log("Windows portable ready:", outExe);
  console.log("Windows zip ready:", outZip);
} else {
  console.warn("未生成便携版（yyds-windows.exe）");
}
