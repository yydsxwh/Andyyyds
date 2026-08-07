"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clamp,
  prefersReducedMotion,
  readTiltEnabled,
  readTiltPrompted,
  writeTiltEnabled,
  writeTiltPrompted,
} from "@/lib/tilt-parallax";

type TiltContextValue = {
  enabled: boolean;
  reducedMotion: boolean;
  /** 开启/关闭；开启时在用户手势里尝试 iOS 权限 */
  setEnabled: (next: boolean) => Promise<void>;
};

const TiltContext = createContext<TiltContextValue | null>(null);

export function useTiltParallax(): TiltContextValue {
  const ctx = useContext(TiltContext);
  if (!ctx) {
    return {
      enabled: false,
      reducedMotion: true,
      setEnabled: async () => {},
    };
  }
  return ctx;
}

type DeviceOrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

async function requestOrientationPermission(): Promise<boolean> {
  try {
    const DOE = window.DeviceOrientationEvent as DeviceOrientationConstructor;
    if (typeof DOE?.requestPermission === "function") {
      // iOS 13+：必须在用户手势回调里调，否则永远拿不到 gamma/beta
      const result = await DOE.requestPermission();
      return result === "granted";
    }
    return true;
  } catch {
    // 微信/旧内核无权限 API 或拒绝：静默降级，不 toast 刷屏
    return false;
  }
}

function applyTiltCss(x: number, y: number, on: boolean) {
  const root = document.documentElement;
  root.style.setProperty("--tilt-x", on ? x.toFixed(3) : "0");
  root.style.setProperty("--tilt-y", on ? y.toFixed(3) : "0");
  root.classList.toggle("tilt-on", on);
}

/**
 * 全站倾斜视差驱动：把设备倾角/鼠标位移写成 CSS 变量，
 * 仅关键层（.tilt-*）读取；列表卡用轻量整卡位移，避免多层 blur 叠加卡顿。
 */
export function TiltParallaxProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const enabledRef = useRef(false);
  const rafRef = useRef(0);
  const pendingRef = useRef({ x: 0, y: 0 });

  const flush = useCallback(() => {
    rafRef.current = 0;
    const { x, y } = pendingRef.current;
    applyTiltCss(x, y, enabledRef.current && !prefersReducedMotion());
  }, []);

  const schedule = useCallback(
    (x: number, y: number) => {
      pendingRef.current = { x, y };
      if (rafRef.current) return;
      // rAF 节流：传感器/鼠标事件远高于刷新率，合并到每帧一次
      rafRef.current = window.requestAnimationFrame(flush);
    },
    [flush],
  );

  useEffect(() => {
    const reduced = prefersReducedMotion();
    setReducedMotion(reduced);
    const stored = reduced ? false : readTiltEnabled();
    setEnabledState(stored);
    enabledRef.current = stored;
    applyTiltCss(0, 0, stored && !reduced);
    setHydrated(true);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      const nextReduced = mq.matches;
      setReducedMotion(nextReduced);
      if (nextReduced) {
        enabledRef.current = false;
        setEnabledState(false);
        applyTiltCss(0, 0, false);
      }
    };
    mq.addEventListener?.("change", onMotion);
    return () => mq.removeEventListener?.("change", onMotion);
  }, []);

  useEffect(() => {
    if (!hydrated || !enabled || reducedMotion) {
      applyTiltCss(0, 0, false);
      return;
    }

    enabledRef.current = true;

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (!enabledRef.current) return;
      // gamma: 左右；beta: 前后。绕「手持约 45°」归零，幅度压到轻微错位
      const gamma = typeof e.gamma === "number" ? e.gamma : 0;
      const beta = typeof e.beta === "number" ? e.beta : 45;
      const x = clamp(gamma / 28, -1, 1);
      const y = clamp((beta - 45) / 28, -1, 1);
      schedule(x, y);
    };

    const onMotion = (e: DeviceMotionEvent) => {
      // 部分安卓微信只有 DeviceMotion；用重力加速度近似倾角
      if (!enabledRef.current) return;
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null || g.y == null) return;
      const x = clamp(-(g.x || 0) / 7, -1, 1);
      const y = clamp(((g.y || 0) - 6) / 7, -1, 1);
      schedule(x, y);
    };

    const onMouse = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      // 桌面轻量鼠标视差：相对视口中心归一化，强度低于陀螺仪
      const nx = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 1.2;
      const ny = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 1.2;
      schedule(clamp(nx, -1, 1), clamp(ny, -1, 1));
    };

    let usedOrientation = false;
    try {
      window.addEventListener("deviceorientation", onOrientation, true);
      usedOrientation = true;
    } catch {
      /* ignore */
    }
    try {
      window.addEventListener("devicemotion", onMotion, true);
    } catch {
      /* ignore */
    }
    // 桌面/无传感器：鼠标可选视差
    window.addEventListener("mousemove", onMouse, { passive: true });

    return () => {
      if (usedOrientation) {
        window.removeEventListener("deviceorientation", onOrientation, true);
      }
      window.removeEventListener("devicemotion", onMotion, true);
      window.removeEventListener("mousemove", onMouse);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      applyTiltCss(0, 0, false);
    };
  }, [enabled, hydrated, reducedMotion, schedule]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (next && prefersReducedMotion()) {
        // 系统要求减弱动效时强制关，忽略用户打开
        writeTiltEnabled(false);
        setEnabledState(false);
        enabledRef.current = false;
        applyTiltCss(0, 0, false);
        setReducedMotion(true);
        return;
      }
      if (next) {
        await requestOrientationPermission();
        // 即使权限被拒也仍可开鼠标视差；传感器无数据时 CSS 保持 0
      }
      writeTiltEnabled(next);
      writeTiltPrompted();
      setEnabledState(next);
      enabledRef.current = next;
      if (!next) applyTiltCss(0, 0, false);
    },
    [],
  );

  const value = useMemo(
    () => ({ enabled, reducedMotion, setEnabled }),
    [enabled, reducedMotion, setEnabled],
  );

  return (
    <TiltContext.Provider value={value}>
      {children}
      {hydrated ? <TiltParallaxHomeTip /> : null}
    </TiltContext.Provider>
  );
}

/** 个人中心 / 装扮页共用的开关卡片 */
export function TiltParallaxToggle({ className = "" }: { className?: string }) {
  const { enabled, reducedMotion, setEnabled } = useTiltParallax();
  const [busy, setBusy] = useState(false);

  async function onToggle() {
    if (reducedMotion || busy) return;
    setBusy(true);
    try {
      await setEnabled(!enabled);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`surface rounded-[28px] p-5 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">倾斜视差（裸眼感）</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            手机倾斜时，首页主视觉、约搭卡片与玻璃顶栏轻微分层错位。非真立体屏；
            默认关闭，偏好保存在本机。系统「减弱动态效果」开启时会强制关闭。
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled && !reducedMotion}
          disabled={reducedMotion || busy}
          onClick={() => void onToggle()}
          className={`btn btn-compact min-w-[5.5rem] touch-manipulation ${
            enabled && !reducedMotion ? "btn-primary" : "btn-secondary"
          }`}
        >
          {reducedMotion ? "已禁用" : enabled ? "已开启" : "已关闭"}
        </button>
      </div>
      {reducedMotion ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          检测到系统 prefers-reduced-motion，已强制关闭视差。
        </p>
      ) : null}
    </div>
  );
}

/** 首页首次轻提示：不自动开，点「试试」才在手势里申请权限 */
function TiltParallaxHomeTip() {
  const { enabled, reducedMotion, setEnabled } = useTiltParallax();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (reducedMotion || enabled || readTiltPrompted()) return;
    // 仅窄屏提示：桌面用鼠标视差，不必打扰
    const narrow = window.matchMedia("(max-width: 900px)").matches;
    if (!narrow) {
      writeTiltPrompted();
      return;
    }
    if (window.location.pathname !== "/") return;
    setShow(true);
  }, [enabled, reducedMotion]);

  if (!show) return null;

  return (
    <div
      className="glass-panel fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md p-4 sm:inset-x-auto"
      role="status"
    >
      <p className="text-sm leading-6 text-[var(--ink)]">
        可开启「倾斜视差」：轻轻晃动手机，主视觉与玻璃层有轻微裸眼分层感。随时可在个人中心关闭。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary btn-compact touch-manipulation"
          onClick={() => {
            void setEnabled(true).then(() => setShow(false));
          }}
        >
          试试
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-compact touch-manipulation"
          onClick={() => {
            writeTiltPrompted();
            setShow(false);
          }}
        >
          暂不
        </button>
      </div>
    </div>
  );
}
