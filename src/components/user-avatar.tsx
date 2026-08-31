/**
 * 用户头像展示：有图用图，无图用昵称首字圆形占位。
 * 顶栏与个人中心共用，保证双端尺寸触控友好。
 */

type Props = {
  name: string;
  /** 已可直接访问的 URL（签名后或本地路径） */
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-9 w-9 text-sm",
  md: "h-11 w-11 text-base",
  lg: "h-20 w-20 text-2xl",
};

export function UserAvatar({ name, src, size = "sm", className = "" }: Props) {
  const initial = (name || "?").trim().slice(0, 1) || "?";
  const box = SIZE[size];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || "头像"}
        // 微信头像 CDN（qlogo）常校验 Referer，带站点来源会裂图
        referrerPolicy="no-referrer"
        className={`${box} shrink-0 rounded-full object-cover ring-1 ring-[var(--line)] ${className}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/15 font-semibold text-[var(--brand)] ring-1 ring-[var(--line)] ${className}`}
      aria-hidden
    >
      {initial}
    </span>
  );
}
