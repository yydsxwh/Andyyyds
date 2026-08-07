"""根据 theme_covers_manifest.json 生成 site-theme-backgrounds-extra.ts"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts" / "theme_covers_manifest.json"
OUT = ROOT / "src" / "lib" / "site-theme-backgrounds-extra.ts"

VEIL = {
    "light": "PHOTO_VEIL_LIGHT",
    "warm": "PHOTO_VEIL_WARM",
    "cool": "PHOTO_VEIL_COOL",
    "cyber": "PHOTO_VEIL_CYBER",
}

GRADIENTS = [
    (
        "grad-pearl-sky",
        "珍珠白空",
        "radial-gradient(ellipse 80% 50% at 12% -8%, rgba(56,189,248,0.28), transparent 55%), linear-gradient(180deg,#ffffff,#eef6ff 55%,#e8f0f8)",
        "radial-gradient(ellipse 80% 50% at 12% -8%, rgba(56,189,248,0.16), transparent 55%), radial-gradient(ellipse 50% 35% at 90% 10%, rgba(14,165,233,0.08), transparent 50%), linear-gradient(180deg,#ffffff 0%, var(--bg) 48%, #e8f0f8 100%)",
    ),
    (
        "grad-graphite",
        "石墨商务",
        "linear-gradient(145deg,#f8fafc,#cbd5e1 40%,#475569)",
        "radial-gradient(ellipse 60% 40% at 20% 0%, rgba(71,85,105,0.12), transparent 55%), linear-gradient(180deg,#ffffff 0%, var(--bg) 50%, #e2e8f0 100%)",
    ),
    (
        "grad-ocean-ink",
        "海蓝墨色",
        "radial-gradient(ellipse at 20% 0%, rgba(3,105,161,0.35), transparent 50%), linear-gradient(180deg,#f0f9ff,#e0f2fe)",
        "radial-gradient(ellipse 70% 45% at 15% -8%, rgba(3,105,161,0.18), transparent 55%), linear-gradient(180deg,#ffffff 0%, var(--bg) 50%, #dbeafe 100%)",
    ),
    (
        "grad-champagne",
        "香槟金辉",
        "radial-gradient(ellipse at 80% 0%, rgba(217,119,6,0.22), transparent 50%), linear-gradient(180deg,#fffbeb,#fef3c7)",
        "radial-gradient(ellipse 65% 40% at 85% 0%, rgba(217,119,6,0.12), transparent 55%), linear-gradient(180deg,#fffdf7 0%, var(--bg) 48%, #fef3c7 100%)",
    ),
    (
        "grad-mint-corp",
        "薄荷机构",
        "radial-gradient(ellipse at 15% 0%, rgba(13,148,136,0.28), transparent 50%), linear-gradient(180deg,#f0fdfa,#ccfbf1)",
        "radial-gradient(ellipse 70% 45% at 12% -8%, rgba(13,148,136,0.14), transparent 55%), linear-gradient(180deg,#ffffff 0%, var(--bg) 50%, #ccfbf1 100%)",
    ),
    (
        "grad-midnight-navy",
        "午夜海军蓝",
        "radial-gradient(ellipse at 20% 0%, rgba(30,64,175,0.45), transparent 50%), linear-gradient(180deg,#0f172a,#020617)",
        "radial-gradient(ellipse 75% 48% at 12% -10%, rgba(59,130,246,0.22), transparent 55%), linear-gradient(180deg,#1e293b 0%, var(--bg) 48%, #020617 100%)",
    ),
    (
        "grad-silver-mesh",
        "银灰织网",
        "linear-gradient(90deg,rgba(100,116,139,0.1) 1px,transparent 1px),linear-gradient(rgba(100,116,139,0.1) 1px,transparent 1px),#f1f5f9",
        "linear-gradient(180deg,rgba(255,255,255,0.8),rgba(241,245,249,0.92)),linear-gradient(90deg,rgba(100,116,139,0.05) 1px,transparent 1px) 0 0/32px 32px,linear-gradient(rgba(100,116,139,0.05) 1px,transparent 1px) 0 0/32px 32px,linear-gradient(180deg,#ffffff 0%,var(--bg) 100%)",
    ),
    (
        "grad-aurora-soft",
        "柔光极光",
        "radial-gradient(ellipse at 10% 0%, rgba(34,211,238,0.3), transparent 45%), radial-gradient(ellipse at 90% 20%, rgba(125,211,252,0.25), transparent 45%), linear-gradient(180deg,#f8fafc,#e0f2fe)",
        "radial-gradient(ellipse 70% 45% at 8% -8%, rgba(34,211,238,0.14), transparent 55%), radial-gradient(ellipse 55% 38% at 92% 8%, rgba(125,211,252,0.12), transparent 52%), linear-gradient(180deg,#ffffff 0%, var(--bg) 48%, #e0f2fe 100%)",
    ),
    (
        "grad-sandstone",
        "砂岩暖昼",
        "radial-gradient(ellipse at 70% 0%, rgba(180,83,9,0.18), transparent 50%), linear-gradient(180deg,#fff7ed,#ffedd5)",
        "radial-gradient(ellipse 65% 40% at 80% 0%, rgba(180,83,9,0.1), transparent 55%), linear-gradient(180deg,#fffaf5 0%, var(--bg) 48%, #ffedd5 100%)",
    ),
    (
        "grad-ice-crystal",
        "冰晶冷调",
        "radial-gradient(ellipse at 50% 0%, rgba(186,230,253,0.7), transparent 55%), linear-gradient(180deg,#f0f9ff,#bae6fd)",
        "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(125,211,252,0.2), transparent 55%), linear-gradient(180deg,#ffffff 0%, var(--bg) 50%, #e0f2fe 100%)",
    ),
    (
        "grad-executive-ink",
        "高管墨蓝",
        "linear-gradient(160deg,#1e3a5f,#0c1929 60%,#082f49)",
        "radial-gradient(ellipse 60% 40% at 15% 0%, rgba(56,189,248,0.15), transparent 55%), linear-gradient(180deg,#1e293b 0%, var(--bg) 50%, #0c1929 100%)",
    ),
    (
        "grad-cloud-layer",
        "层云柔白",
        "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.9), transparent 50%), linear-gradient(180deg,#f8fafc,#e2e8f0)",
        "radial-gradient(ellipse 70% 50% at 25% 10%, rgba(255,255,255,0.7), transparent 55%), linear-gradient(180deg,#ffffff 0%, var(--bg) 55%, #e2e8f0 100%)",
    ),
    (
        "grad-copper-line",
        "铜线勾勒",
        "radial-gradient(ellipse at 90% 0%, rgba(234,88,12,0.25), transparent 45%), linear-gradient(180deg,#fff7ed,#ffedd5)",
        "radial-gradient(ellipse 55% 38% at 92% 0%, rgba(234,88,12,0.12), transparent 52%), linear-gradient(180deg,#fffdf9 0%, var(--bg) 48%, #ffedd5 100%)",
    ),
    (
        "grad-forest-glass",
        "林间玻璃",
        "radial-gradient(ellipse at 20% 0%, rgba(22,163,74,0.22), transparent 50%), linear-gradient(180deg,#f0fdf4,#dcfce7)",
        "radial-gradient(ellipse 70% 45% at 15% -8%, rgba(22,163,74,0.12), transparent 55%), linear-gradient(180deg,#ffffff 0%, var(--bg) 50%, #dcfce7 100%)",
    ),
    (
        "grad-steel-horizon",
        "钢色地平",
        "linear-gradient(180deg,#f1f5f9 0%,#94a3b8 45%,#334155 100%)",
        "linear-gradient(180deg,rgba(255,255,255,0.85),rgba(241,245,249,0.5)), linear-gradient(180deg,#ffffff 0%, var(--bg) 40%, #cbd5e1 100%)",
    ),
    (
        "grad-twin-beam",
        "双束光柱",
        "radial-gradient(ellipse at 0% 0%, rgba(14,165,233,0.35), transparent 40%), radial-gradient(ellipse at 100% 0%, rgba(6,182,212,0.3), transparent 40%), #f8fafc",
        "radial-gradient(ellipse 55% 40% at 0% -5%, rgba(14,165,233,0.16), transparent 50%), radial-gradient(ellipse 55% 40% at 100% -5%, rgba(6,182,212,0.14), transparent 50%), linear-gradient(180deg,#ffffff 0%, var(--bg) 55%, #f1f5f9 100%)",
    ),
    (
        "grad-obsidian",
        "黑曜镜面",
        "radial-gradient(ellipse at 50% 0%, rgba(51,65,85,0.5), transparent 50%), linear-gradient(180deg,#0f172a,#020617)",
        "radial-gradient(ellipse 70% 45% at 50% -10%, rgba(148,163,184,0.12), transparent 55%), linear-gradient(180deg,#1e293b 0%, var(--bg) 50%, #020617 100%)",
    ),
    (
        "grad-porcelain",
        "瓷白细纹",
        "radial-gradient(rgba(15,23,42,0.06) 0.8px, transparent 1px) 0 0/14px 14px, #fafafa",
        "radial-gradient(rgba(15,23,42,0.05) 0.8px, transparent 1px) 0 0/16px 16px, linear-gradient(180deg,#ffffff 0%, var(--bg) 60%, #f4f4f5 100%)",
    ),
    (
        "grad-blueprint",
        "蓝图网格",
        "linear-gradient(90deg,rgba(37,99,235,0.12) 1px,transparent 1px),linear-gradient(rgba(37,99,235,0.12) 1px,transparent 1px),#eff6ff",
        "linear-gradient(180deg,rgba(255,255,255,0.75),rgba(239,246,255,0.9)),linear-gradient(90deg,rgba(37,99,235,0.06) 1px,transparent 1px) 0 0/24px 24px,linear-gradient(rgba(37,99,235,0.06) 1px,transparent 1px) 0 0/24px 24px,linear-gradient(180deg,#ffffff 0%,var(--bg) 100%)",
    ),
    (
        "grad-sunset-glass",
        "暮色玻璃",
        "radial-gradient(ellipse at 80% 0%, rgba(251,146,60,0.3), transparent 45%), radial-gradient(ellipse at 10% 100%, rgba(14,165,233,0.2), transparent 45%), #fff7ed",
        "radial-gradient(ellipse 55% 38% at 88% 0%, rgba(251,146,60,0.14), transparent 52%), radial-gradient(ellipse 50% 35% at 8% 100%, rgba(14,165,233,0.1), transparent 50%), linear-gradient(180deg,#fffdf9 0%, var(--bg) 50%, #ffedd5 100%)",
    ),
    (
        "grad-alpine",
        "高山清冽",
        "radial-gradient(ellipse at 40% 0%, rgba(125,211,252,0.4), transparent 50%), linear-gradient(180deg,#f0f9ff,#e0f2fe)",
        "radial-gradient(ellipse 75% 48% at 40% -10%, rgba(56,189,248,0.16), transparent 55%), linear-gradient(180deg,#ffffff 0%, var(--bg) 50%, #e0f2fe 100%)",
    ),
    (
        "grad-carbon",
        "碳纤维纹",
        "repeating-linear-gradient(45deg, #1e293b, #1e293b 2px, #0f172a 2px, #0f172a 6px)",
        "linear-gradient(180deg,rgba(15,23,42,0.55),rgba(2,6,23,0.75)), repeating-linear-gradient(45deg,rgba(51,65,85,0.35),rgba(51,65,85,0.35) 2px,transparent 2px,transparent 8px), linear-gradient(180deg,#1e293b 0%, var(--bg) 100%)",
    ),
]


def main() -> None:
    photos = json.loads(MANIFEST.read_text(encoding="utf-8"))
    lines: list[str] = [
        "/**",
        " * 扩展背景主题（照片 + 渐变/纹理）",
        " * 照片文件在 public/covers/biz-*.jpg；由 scripts/fetch_theme_covers.py 拉取。",
        " * 勿手改清单与文件名映射时不同步。",
        " */",
        "",
        "import type { ThemeBackground, ThemePack } from \"./site-theme\";",
        "",
        "const PHOTO_VEIL_LIGHT =",
        '  "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.78) 42%, rgba(248,250,252,0.9) 100%)";',
        "const PHOTO_VEIL_WARM =",
        '  "linear-gradient(180deg, rgba(255,252,247,0.9) 0%, rgba(255,248,240,0.8) 45%, rgba(247,243,236,0.92) 100%)";',
        "const PHOTO_VEIL_COOL =",
        '  "linear-gradient(180deg, rgba(245,249,252,0.9) 0%, rgba(241,245,249,0.82) 48%, rgba(238,242,246,0.93) 100%)";',
        "const PHOTO_VEIL_CYBER =",
        '  "linear-gradient(180deg, rgba(6,8,20,0.68) 0%, rgba(8,10,24,0.55) 36%, rgba(4,6,16,0.74) 100%), radial-gradient(ellipse 70% 48% at 8% -10%, rgba(34,211,238,0.38), transparent 56%), radial-gradient(ellipse 55% 40% at 92% 2%, rgba(232,121,249,0.32), transparent 54%), radial-gradient(ellipse 48% 34% at 72% 18%, rgba(168,85,247,0.22), transparent 52%), radial-gradient(ellipse 50% 32% at 48% 100%, rgba(251,146,60,0.2), transparent 55%), radial-gradient(ellipse 40% 28% at 22% 78%, rgba(163,230,53,0.14), transparent 50%)";',
        "",
        "function photoLayers(imageUrl: string, veil: string) {",
        '  return `${veil}, url("${imageUrl}") center / cover no-repeat`;',
        "}",
        "",
        "export const EXTRA_THEME_BACKGROUNDS: ThemeBackground[] = [",
    ]

    for g_id, name, preview, layers in GRADIENTS:
        kind = "pattern" if "1px" in preview or "repeating" in preview else "gradient"
        lines.append("  {")
        lines.append(f'    id: "{g_id}",')
        lines.append(f'    name: "{name}",')
        lines.append(f'    kind: "{kind}",')
        lines.append(f'    preview: {json.dumps(preview)},')
        lines.append(f'    layers: {json.dumps(layers)},')
        lines.append("  },")

    for p in photos:
        veil = VEIL.get(p.get("veil") or "cool", "PHOTO_VEIL_COOL")
        file_url = p["file"]
        lines.append("  {")
        lines.append(f'    id: {json.dumps(p["id"])},')
        lines.append(f'    name: {json.dumps(p["name"])},')
        lines.append('    kind: "photo",')
        lines.append(f'    preview: \'url("{file_url}") center/cover\',')
        lines.append(
            f'    layers: photoLayers("{file_url}", {veil}),'
        )
        lines.append("  },")

    lines.append("];")
    lines.append("")
    lines.append("/** 部分新照片配一键主题包，便于站长快速选用 */")
    lines.append("export const EXTRA_THEME_PACKS: ThemePack[] = [")

    pack_samples = [
        ("pack-glass-office", "玻璃办公", "通透现代机构风", "sky-fresh", "photo-biz-glass-office"),
        ("pack-skyline", "都会天际", "都市航拍 + 冷灰", "cool-slate", "photo-biz-city-aerial"),
        ("pack-neon-alley", "霓虹巷道", "夜景科技感", "cyber-neon", "photo-biz-neon-alley"),
        ("pack-boardroom", "董事会议", "正式商务现场", "cool-slate", "photo-biz-boardroom"),
        ("pack-ai-glow", "智能光感", "AI 意象 + 天蓝", "sky-fresh", "photo-biz-ai-glow"),
        ("pack-library", "书廊暖光", "阅读学习氛围", "warm-ink", "photo-biz-books"),
        ("pack-servers", "数据机柜", "基础设施科技", "cool-slate", "photo-biz-servers"),
        ("pack-collab", "协作研讨", "团队共创现场", "sky-fresh", "photo-biz-collab"),
        ("pack-blueprint", "蓝图网格", "规划感纹理底", "sky-fresh", "grad-blueprint"),
        ("pack-executive", "高管墨蓝", "深色商务站风", "cool-slate", "grad-executive-ink"),
        ("pack-pearl", "珍珠白空", "极简明亮门户", "sky-fresh", "grad-pearl-sky"),
        ("pack-loft", "工业办公", "Loft 现代感", "cool-slate", "photo-biz-loft"),
    ]
    photo_ids = {p["id"] for p in photos}
    for pack_id, name, tagline, palette, bg in pack_samples:
        if bg.startswith("photo-") and bg not in photo_ids:
            continue
        cover = (
            f'url("{next(p["file"] for p in photos if p["id"]==bg)}") center/cover'
            if bg in photo_ids
            else next(g[2] for g in GRADIENTS if g[0] == bg)
        )
        lines.append("  {")
        lines.append(f'    id: "{pack_id}",')
        lines.append(f'    name: "{name}",')
        lines.append(f'    tagline: "{tagline}",')
        lines.append(f'    paletteId: "{palette}",')
        lines.append(f'    backgroundId: "{bg}",')
        lines.append(f'    cover: {json.dumps(cover)},')
        lines.append("  },")

    lines.append("];")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(
        f"Wrote {OUT} with {len(GRADIENTS)} gradients + {len(photos)} photos "
        f"= {len(GRADIENTS)+len(photos)} backgrounds"
    )


if __name__ == "__main__":
    main()
