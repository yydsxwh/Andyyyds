/**
 * 构建 Windows 便携客户端，并发布到 public/app：
 * - yyds-windows.exe（直链）
 * - yyds-windows.zip（推荐：Edge/Chrome 对 zip 拦截更少）
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

if (!existsSync(path.join(desktopDir, "package.json"))) {
  console.error("未找到 desktop/package.json");
  process.exit(1);
}

if (!existsSync(path.join(desktopDir, "node_modules", "electron"))) {
  console.log("Installing desktop dependencies…");
  run("npm", ["install"], desktopDir);
}

console.log("Packaging Windows portable client…");
run("npm", ["run", "pack"], desktopDir);

mkdirSync(outDir, { recursive: true });

let built = path.join(distDir, "yyds-windows.exe");
if (!existsSync(built)) {
  // electron-builder 偶发把产物放在子目录或带空格命名
  const candidates = existsSync(distDir)
    ? readdirSync(distDir)
        .filter((name) => name.toLowerCase().endsWith(".exe"))
        .map((name) => path.join(distDir, name))
    : [];
  if (candidates.length === 0) {
    console.error("未找到构建产物 .exe，请检查 desktop/dist");
    process.exit(1);
  }
  built = candidates[0];
}

copyFileSync(built, outExe);
zipExe(outExe, outZip);
console.log("Windows client ready:", outExe);
console.log("Windows zip ready:", outZip);
