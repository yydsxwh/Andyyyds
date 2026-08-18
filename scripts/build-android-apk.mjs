/**
 * 在 Windows / macOS / Linux 上调用 Gradle 打 debug APK，并复制到 public/app/yyds.apk
 * 供站点 /app 页下载。需本机已配置 ANDROID_HOME + JDK 21（Capacitor 8）。
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(root, "android");
const isWin = process.platform === "win32";
const gradlew = path.join(androidDir, isWin ? "gradlew.bat" : "gradlew");
const apkSrc = path.join(
  androidDir,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);
const apkDestDir = path.join(root, "public", "app");
const apkDest = path.join(apkDestDir, "yyds.apk");

if (!existsSync(gradlew)) {
  console.error("未找到 android/gradlew，请先执行: npx cap add android");
  process.exit(1);
}

const env = { ...process.env };
if (!env.ANDROID_HOME && env.ANDROID_SDK_ROOT) {
  env.ANDROID_HOME = env.ANDROID_SDK_ROOT;
}
if (!env.ANDROID_HOME && isWin) {
  const guess = path.join(env.LOCALAPPDATA || "", "Android", "Sdk");
  if (existsSync(guess)) env.ANDROID_HOME = guess;
}

console.log("Building debug APK via Gradle…");
const result = spawnSync(
  gradlew,
  ["assembleDebug", "--no-daemon"],
  {
    cwd: androidDir,
    env,
    stdio: "inherit",
    shell: isWin,
  }
);

if (result.status !== 0) {
  console.error("Gradle assembleDebug 失败");
  process.exit(result.status || 1);
}

if (!existsSync(apkSrc)) {
  console.error("未找到 APK:", apkSrc);
  process.exit(1);
}

mkdirSync(apkDestDir, { recursive: true });
copyFileSync(apkSrc, apkDest);
console.log("APK ready:", apkDest);
