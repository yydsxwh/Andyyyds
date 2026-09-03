"use client";

/**
 * 奢华模拟表盘：七套装扮共用同一套走时，只换圈层、金工与针型。
 * 广告级默认姿态可用 10:10，前台走真实时区。
 */

import { useId } from "react";
import type { HomeClockStyle } from "@andyyyds/shared/home-clock";

type FaceTheme = {
  face0: string;
  face1: string;
  face2: string;
  rim0: string;
  rim1: string;
  innerRing: string;
  tick: string;
  hour: string;
  minute: string;
  second: string;
  hub: string;
  hubCore: string;
  numeral?: string;
};

const FACE_THEME: Record<HomeClockStyle, FaceTheme> = {
  imperial: {
    face0: "color-mix(in srgb, var(--brand) 22%, transparent)",
    face1: "color-mix(in srgb, var(--brand) 8%, transparent)",
    face2: "transparent",
    rim0: "var(--brand)",
    rim1: "var(--brand-strong)",
    innerRing: "currentColor",
    tick: "currentColor",
    hour: "currentColor",
    minute: "currentColor",
    second: "var(--brand-strong)",
    hub: "var(--brand)",
    hubCore: "#fff",
  },
  obsidian: {
    face0: "#2a2214",
    face1: "#100e0c",
    face2: "#070605",
    rim0: "#f0d48a",
    rim1: "#8a6a28",
    innerRing: "#c9a35a",
    tick: "#e8d5a3",
    hour: "#f3e6c4",
    minute: "#e4cf8f",
    second: "#d4af37",
    hub: "#d4af37",
    hubCore: "#1a140c",
    numeral: "#f0d48a",
  },
  champagne: {
    face0: "#fff6e4",
    face1: "#f3e2bc",
    face2: "#e8d2a0",
    rim0: "#f2d48a",
    rim1: "#b8893a",
    innerRing: "#c9a35a",
    tick: "#7a5a28",
    hour: "#5c4318",
    minute: "#7a5a28",
    second: "#b8893a",
    hub: "#c9a35a",
    hubCore: "#fff8ea",
    numeral: "#6b4e1e",
  },
  emerald: {
    face0: "#1c3d2c",
    face1: "#0c1f18",
    face2: "#07140f",
    rim0: "#e4c878",
    rim1: "#8a6e2c",
    innerRing: "#c9a84c",
    tick: "#e6d59a",
    hour: "#f2e6b8",
    minute: "#dcc878",
    second: "#f0d060",
    hub: "#d4af37",
    hubCore: "#0a1610",
    numeral: "#e8d48a",
  },
  sapphire: {
    face0: "#1a2748",
    face1: "#0b1224",
    face2: "#060910",
    rim0: "#e8eef6",
    rim1: "#8a97ab",
    innerRing: "#c5d0e0",
    tick: "#dce4f0",
    hour: "#f4f7fb",
    minute: "#cfd8e6",
    second: "#9eb4d4",
    hub: "#e8eef6",
    hubCore: "#0b1224",
    numeral: "#e4ebf4",
  },
  rose: {
    face0: "#3a221c",
    face1: "#1a1014",
    face2: "#0c0809",
    rim0: "#f0c4a4",
    rim1: "#8a4e3a",
    innerRing: "#d4a574",
    tick: "#efd0b8",
    hour: "#f6ddd0",
    minute: "#e2b89a",
    second: "#e8a888",
    hub: "#d4a574",
    hubCore: "#1a1014",
    numeral: "#f0c4a4",
  },
  ivory: {
    face0: "#fffdf6",
    face1: "#f4ead4",
    face2: "#e8dcc0",
    rim0: "#d8b56a",
    rim1: "#8a7040",
    innerRing: "#bfa46a",
    tick: "#6a5430",
    hour: "#3f331c",
    minute: "#5c4a2a",
    second: "#a07838",
    hub: "#c9a84c",
    hubCore: "#fffaf0",
    numeral: "#5a4524",
  },
  platinum: {
    face0: "#f7f9fc",
    face1: "#dce3ee",
    face2: "#b8c3d4",
    rim0: "#f4f7fb",
    rim1: "#8a96a8",
    innerRing: "#c5cedb",
    tick: "#4a5568",
    hour: "#1c2430",
    minute: "#3a4556",
    second: "#8a96a8",
    hub: "#e8eef6",
    hubCore: "#2a3344",
    numeral: "#2a3344",
  },
  burgundy: {
    face0: "#5a1c28",
    face1: "#2a0c14",
    face2: "#14080c",
    rim0: "#f0d48a",
    rim1: "#8a5a24",
    innerRing: "#d4af37",
    tick: "#f0d48a",
    hour: "#f6e6b8",
    minute: "#e4c878",
    second: "#f0c060",
    hub: "#d4af37",
    hubCore: "#1a080c",
    numeral: "#f0d48a",
  },
};

function getZonedHms(
  now: Date,
  timeZone: string,
): { hour: number; minute: number; second: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const num = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value || 0);
    return {
      hour: num("hour"),
      minute: num("minute"),
      second: num("second"),
    };
  } catch {
    return {
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
    };
  }
}

const ROMANS = ["XII", "III", "VI", "IX"] as const;

export function HomeClockFace({
  now,
  timeZone,
  style,
  className = "",
}: {
  now: Date;
  timeZone: string;
  style: HomeClockStyle;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const faceId = `clkFace-${uid}`;
  const rimId = `clkRim-${uid}`;
  const theme = FACE_THEME[style] || FACE_THEME.imperial;
  const { hour, minute, second } = getZonedHms(now, timeZone);
  const secondDeg = second * 6;
  const minuteDeg = minute * 6 + second * 0.1;
  const hourDeg = (hour % 12) * 30 + minute * 0.5 + second * (0.5 / 60);
  const showRomans = Boolean(theme.numeral);

  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <radialGradient id={faceId} cx="48%" cy="36%" r="64%">
          <stop offset="0%" stopColor={theme.face0} />
          <stop offset="58%" stopColor={theme.face1} />
          <stop offset="100%" stopColor={theme.face2} />
        </radialGradient>
        <linearGradient id={rimId} x1="10" y1="6" x2="54" y2="58">
          <stop offset="0%" stopColor={theme.rim0} />
          <stop offset="100%" stopColor={theme.rim1} />
        </linearGradient>
      </defs>

      <circle cx="32" cy="32" r="31.2" fill={`url(#${rimId})`} />
      {Array.from({ length: 72 }, (_, i) => (
        <line
          key={`flute-${i}`}
          x1="32"
          y1="1.05"
          x2="32"
          y2="2.55"
          stroke={theme.rim0}
          strokeWidth="0.55"
          opacity="0.55"
          transform={`rotate(${i * 5} 32 32)`}
        />
      ))}
      <circle cx="32" cy="32" r="28.6" fill={`url(#${faceId})`} />
      <circle
        cx="32"
        cy="32"
        r="28.2"
        stroke={`url(#${rimId})`}
        strokeWidth="1.15"
      />
      <circle
        cx="32"
        cy="32"
        r="26.2"
        stroke={theme.innerRing}
        strokeWidth="0.45"
        opacity="0.5"
      />
      <circle
        cx="32"
        cy="32"
        r="23.6"
        stroke={theme.innerRing}
        strokeWidth="0.3"
        opacity="0.22"
      />
      <path
        d="M18 16.5 C24 11.2 40 11.2 46 16.5"
        stroke={theme.rim0}
        strokeWidth="1.1"
        opacity="0.28"
        strokeLinecap="round"
      />

      {Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0;
        if (showRomans && i % 15 === 0) return null;
        return (
          <line
            key={i}
            x1="32"
            y1={major ? 9.2 : 9.8}
            x2="32"
            y2={major ? 13.2 : 11.4}
            stroke={theme.tick}
            strokeWidth={major ? 1.45 : 0.45}
            strokeLinecap="round"
            opacity={major ? 0.88 : 0.35}
            transform={`rotate(${i * 6} 32 32)`}
          />
        );
      })}

      {showRomans
        ? ROMANS.map((text, index) => {
            const pos = [
              { x: 32, y: 16.2 },
              { x: 48.4, y: 34.2 },
              { x: 32, y: 52.4 },
              { x: 15.6, y: 34.2 },
            ][index]!;
            return (
              <text
                key={text}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                fill={theme.numeral}
                fontSize="5.2"
                fontFamily="Georgia, 'Times New Roman', serif"
                fontWeight="600"
                letterSpacing="0.4"
              >
                {text}
              </text>
            );
          })
        : null}

      <g transform={`rotate(${hourDeg} 32 32)`}>
        <line
          x1="32"
          y1="33.2"
          x2="32"
          y2="18.2"
          stroke={theme.hour}
          strokeWidth="2.55"
          strokeLinecap="round"
        />
      </g>
      <g transform={`rotate(${minuteDeg} 32 32)`}>
        <line
          x1="32"
          y1="34"
          x2="32"
          y2="12.2"
          stroke={theme.minute}
          strokeWidth="1.65"
          strokeLinecap="round"
        />
      </g>
      <g transform={`rotate(${secondDeg} 32 32)`}>
        <line
          x1="32"
          y1="38.5"
          x2="32"
          y2="10.2"
          stroke={theme.second}
          strokeWidth="0.95"
          strokeLinecap="round"
        />
        <circle cx="32" cy="40" r="1.25" fill={theme.second} />
      </g>

      <circle cx="32" cy="32" r="2.7" fill={theme.hub} />
      <circle cx="32" cy="32" r="1.15" fill={theme.hubCore} />
    </svg>
  );
}

export const HOME_CLOCK_FRAME_CLASS: Record<HomeClockStyle, string> = {
  imperial:
    "border-[var(--line)] bg-white/50 text-[var(--ink)] shadow-[var(--glass-inset)]",
  obsidian:
    "border-[#c9a35a]/70 bg-[#0c0b0a]/92 text-[#f3e6c4] shadow-[0_10px_28px_rgba(12,8,4,0.45),inset_0_1px_0_rgba(240,212,138,0.28)]",
  champagne:
    "border-[#d4b06a]/80 bg-[#f7edd8]/92 text-[#5c4318] shadow-[0_10px_26px_rgba(120,80,24,0.18),inset_0_1px_0_rgba(255,248,230,0.8)]",
  emerald:
    "border-[#c9a84c]/70 bg-[#0c1f18]/92 text-[#e6d59a] shadow-[0_10px_28px_rgba(6,16,10,0.42),inset_0_1px_0_rgba(228,200,120,0.25)]",
  sapphire:
    "border-[#c5d0e0]/55 bg-[#0b1224]/92 text-[#e8eef6] shadow-[0_10px_28px_rgba(6,10,20,0.45),inset_0_1px_0_rgba(232,238,246,0.22)]",
  rose:
    "border-[#d4a574]/70 bg-[#1a1014]/92 text-[#f6ddd0] shadow-[0_10px_28px_rgba(18,8,10,0.42),inset_0_1px_0_rgba(240,196,164,0.28)]",
  ivory:
    "border-[#bfa46a]/75 bg-[#f7f1e6]/94 text-[#3f331c] shadow-[0_10px_26px_rgba(90,70,30,0.16),inset_0_1px_0_rgba(255,252,244,0.9)]",
  platinum:
    "border-[#c5cedb]/70 bg-[#eef2f7]/94 text-[#1c2430] shadow-[0_10px_26px_rgba(40,50,70,0.16),inset_0_1px_0_rgba(255,255,255,0.85)]",
  burgundy:
    "border-[#d4af37]/65 bg-[#1a080c]/92 text-[#f6e6b8] shadow-[0_10px_28px_rgba(20,6,8,0.48),inset_0_1px_0_rgba(240,212,138,0.28)]",
};
