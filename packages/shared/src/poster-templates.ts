/**
 * 邀请 / 分享海报背景模板。
 * 含纯色渐变与实景照片布局；照片均走本地 /covers，保证 canvas 可导出。
 */

import { COVER_IMAGES } from "@andyyyds/shared/cover-images";

export type PosterLayout = "full-photo" | "photo-top" | "gradient";

export type PosterTextTone = "light" | "dark";

export type PosterTemplate = {
  id: string;
  /** 选择器中文名 */
  label: string;
  /** 简短说明 */
  description: string;
  layout: PosterLayout;
  textTone: PosterTextTone;
  /** 渐变色停靠点（layout=gradient 或照片上的遮罩渐变） */
  gradientStops: [string, string, string];
  /** 照片路径；渐变模板可为空 */
  imageUrl?: string;
  /** 全幅照片上的半透明遮罩，保证文字可读 */
  photoOverlay?: string;
};

function coverUrl(id: string): string {
  const found = COVER_IMAGES.find((c) => c.id === id);
  return found?.url || "/covers/hero-seminar.jpg";
}

export const POSTER_TEMPLATES: PosterTemplate[] = [
  {
    id: "soft-gradient",
    label: "柔光渐变",
    description: "浅蓝到浅粉，干净简洁",
    layout: "gradient",
    textTone: "dark",
    gradientStops: ["#e0f2fe", "#ffffff", "#ffe4e6"],
  },
  {
    id: "sky-brand",
    label: "品牌天蓝",
    description: "品牌蓝渐变，适合全站宣传",
    layout: "gradient",
    textTone: "light",
    gradientStops: ["#0369a1", "#0ea5e9", "#bae6fd"],
  },
  {
    id: "warm-sunset",
    label: "暖阳渐变",
    description: "琥珀暖色，亲和感强",
    layout: "gradient",
    textTone: "dark",
    gradientStops: ["#fff7ed", "#ffedd5", "#fecdd3"],
  },
  {
    id: "seminar-full",
    label: "课堂实景",
    description: "研讨会现场全幅背景",
    layout: "full-photo",
    textTone: "light",
    gradientStops: ["#0f172a", "#1e293b", "#334155"],
    imageUrl: coverUrl("hero-seminar"),
    photoOverlay: "rgba(15, 23, 42, 0.55)",
  },
  {
    id: "collab-full",
    label: "协作氛围",
    description: "团队围桌协作全幅",
    layout: "full-photo",
    textTone: "light",
    gradientStops: ["#0f172a", "#1e293b", "#334155"],
    imageUrl: coverUrl("team-collab"),
    photoOverlay: "rgba(15, 23, 42, 0.52)",
  },
  {
    id: "workshop-top",
    label: "工作坊卡片",
    description: "上半照片 + 下半白底",
    layout: "photo-top",
    textTone: "dark",
    gradientStops: ["#ffffff", "#f8fafc", "#e0f2fe"],
    imageUrl: coverUrl("whiteboard-workshop"),
  },
  {
    id: "office-top",
    label: "办公会议",
    description: "会议场景上图下文",
    layout: "photo-top",
    textTone: "dark",
    gradientStops: ["#ffffff", "#f1f5f9", "#e2e8f0"],
    imageUrl: coverUrl("office-meeting"),
  },
  {
    id: "study-full",
    label: "结伴学习",
    description: "校园/自学氛围全幅",
    layout: "full-photo",
    textTone: "light",
    gradientStops: ["#0f172a", "#1e293b", "#334155"],
    imageUrl: coverUrl("students-study"),
    photoOverlay: "rgba(15, 23, 42, 0.5)",
  },
  {
    id: "desk-top",
    label: "书桌专注",
    description: "书桌场景上图下文",
    layout: "photo-top",
    textTone: "dark",
    gradientStops: ["#ffffff", "#f8fafc", "#f1f5f9"],
    imageUrl: coverUrl("desk-focus"),
  },
  {
    id: "tech-full",
    label: "科技感",
    description: "AI / 编程科技全幅",
    layout: "full-photo",
    textTone: "light",
    gradientStops: ["#020617", "#1e1b4b", "#312e81"],
    imageUrl: coverUrl("ai-tech"),
    photoOverlay: "rgba(2, 6, 23, 0.45)",
  },
  {
    id: "coworking-full",
    label: "联合办公",
    description: "现代办公空间全幅",
    layout: "full-photo",
    textTone: "light",
    gradientStops: ["#0f172a", "#1e293b", "#334155"],
    imageUrl: coverUrl("coworking"),
    photoOverlay: "rgba(15, 23, 42, 0.5)",
  },
  {
    id: "discuss-top",
    label: "小组讨论",
    description: "讨论场景上图下文",
    layout: "photo-top",
    textTone: "dark",
    gradientStops: ["#ffffff", "#f0f9ff", "#e0f2fe"],
    imageUrl: coverUrl("team-discuss"),
  },
];

export const DEFAULT_POSTER_TEMPLATE_ID = "soft-gradient";

export function posterTemplateById(id: string): PosterTemplate {
  return (
    POSTER_TEMPLATES.find((t) => t.id === id) ||
    POSTER_TEMPLATES.find((t) => t.id === DEFAULT_POSTER_TEMPLATE_ID)!
  );
}
