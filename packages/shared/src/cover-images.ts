/**
 * 站内封面 / 海报可用的图库（本地 public/covers）。
 * 风格：明亮、专业的学习 / 办公协作 / 教育 / 科技 stock 图。
 * 使用本地路径便于海报 canvas 绘制（避免跨域污染导致无法导出）。
 */

export type CoverImage = {
  id: string;
  /** 中文标签，用于选择器展示 */
  label: string;
  /** 主题分类，便于筛选与默认推荐 */
  theme: "education" | "office" | "tech" | "study";
  /** 站点可访问路径（public/covers） */
  url: string;
};

/** 默认课程封面（未填写时的兜底） */
export const DEFAULT_COURSE_COVER_URL = "/covers/laptop-learning.jpg";

/** 默认首页主视觉 */
export const DEFAULT_SITE_HERO_URL = "/covers/hero-seminar.jpg";

export const COVER_IMAGES: CoverImage[] = [
  {
    id: "hero-seminar",
    label: "课堂研讨",
    theme: "education",
    url: "/covers/hero-seminar.jpg",
  },
  {
    id: "team-collab",
    label: "团队协作",
    theme: "office",
    url: "/covers/team-collab.jpg",
  },
  {
    id: "whiteboard-workshop",
    label: "白板工作坊",
    theme: "office",
    url: "/covers/whiteboard-workshop.jpg",
  },
  {
    id: "office-meeting",
    label: "办公会议",
    theme: "office",
    url: "/covers/office-meeting.jpg",
  },
  {
    id: "team-discuss",
    label: "小组讨论",
    theme: "office",
    url: "/covers/team-discuss.jpg",
  },
  {
    id: "business-table",
    label: "商务圆桌",
    theme: "office",
    url: "/covers/business-table.jpg",
  },
  {
    id: "coworking",
    label: "联合办公",
    theme: "office",
    url: "/covers/coworking.jpg",
  },
  {
    id: "students-study",
    label: "结伴学习",
    theme: "study",
    url: "/covers/students-study.jpg",
  },
  {
    id: "desk-focus",
    label: "书桌专注",
    theme: "study",
    url: "/covers/desk-focus.jpg",
  },
  {
    id: "laptop-learning",
    label: "笔记本学习",
    theme: "study",
    url: "/covers/laptop-learning.jpg",
  },
  {
    id: "coding-desk",
    label: "编程工作台",
    theme: "tech",
    url: "/covers/coding-desk.jpg",
  },
  {
    id: "ai-tech",
    label: "AI 科技",
    theme: "tech",
    url: "/covers/ai-tech.jpg",
  },
];

export function coverImageById(id: string): CoverImage | undefined {
  return COVER_IMAGES.find((item) => item.id === id);
}
