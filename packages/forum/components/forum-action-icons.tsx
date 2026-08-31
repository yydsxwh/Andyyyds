import type { ReactNode } from "react";

/**
 * 帖子互动栏图标：细描边、圆角收笔，点过后实心填充。
 * 不引入图标库，避免多一套依赖；路径与 Lucide 同系，便于以后替换。
 */

type IconProps = {
  filled?: boolean;
  className?: string;
};

const base = "h-4 w-4 shrink-0";

function ForumGlyph({
  filled = false,
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || base}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 1.6 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** 点赞：爱心 */
export function ForumHeartIcon(props: IconProps) {
  return (
    <ForumGlyph {...props}>
      <path d="M19.5 12.57 12 20l-7.5-7.43A4.65 4.65 0 1 1 12 6.2a4.65 4.65 0 1 1 7.5 6.37Z" />
    </ForumGlyph>
  );
}

/** 收藏：五角星 */
export function ForumStarIcon(props: IconProps) {
  return (
    <ForumGlyph {...props}>
      <path d="m12 3 2.47 5.01 5.53.8-4 3.9.94 5.49L12 15.9l-4.94 2.3.94-5.49-4-3.9 5.53-.8L12 3Z" />
    </ForumGlyph>
  );
}

/** 评论：圆角对话泡 */
export function ForumCommentIcon(props: IconProps) {
  return (
    <ForumGlyph {...props}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </ForumGlyph>
  );
}

/** 蹲后续：铃铛，有新回复时能对上「等后续」的语义 */
export function ForumBellIcon(props: IconProps) {
  return (
    <ForumGlyph {...props}>
      <path d="M6.3 8.7a5.7 5.7 0 0 1 11.4 0c0 6.6 2.8 8.5 2.8 8.5H3.5s2.8-1.9 2.8-8.5" />
      <path d="M10 20.2a2.05 2.05 0 0 0 4 0" />
    </ForumGlyph>
  );
}

/** 分享：方框 + 向上箭头 */
export function ForumShareIcon(props: IconProps) {
  return (
    <ForumGlyph {...props}>
      <path d="M4.5 12v7.2A1.8 1.8 0 0 0 6.3 21h11.4a1.8 1.8 0 0 0 1.8-1.8V12" />
      <path d="M16.2 6.8 12 2.5 7.8 6.8" />
      <path d="M12 2.5V15" />
    </ForumGlyph>
  );
}
