/**
 * 倾斜视差（裸眼感）本地偏好。
 * 为何用 localStorage 而非装扮 JSON：这是「本机体验」开关，
 * 不该改全站装扮配置，也避免微信里给所有访客强开陀螺仪授权打扰。
 */

export const TILT_STORAGE_KEY = "yyds-tilt-parallax";
export const TILT_PROMPT_KEY = "yyds-tilt-parallax-prompted";

/** 默认关：避免微信/iOS 一进页就弹权限 */
export const TILT_DEFAULT_ENABLED = false;

export function readTiltEnabled(): boolean {
  if (typeof window === "undefined") return TILT_DEFAULT_ENABLED;
  try {
    const raw = window.localStorage.getItem(TILT_STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    /* 隐私模式等读失败时静默降级 */
  }
  return TILT_DEFAULT_ENABLED;
}

export function writeTiltEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TILT_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function readTiltPrompted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(TILT_PROMPT_KEY) === "1";
  } catch {
    return true;
  }
}

export function writeTiltPrompted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TILT_PROMPT_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
