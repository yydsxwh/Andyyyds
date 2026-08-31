export function formatPrice(cents: number) {
  if (cents <= 0) return "免费";
  return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}分${s.toString().padStart(2, "0")}秒`;
  const h = Math.floor(m / 60);
  return `${h}小时${m % 60}分`;
}

/** 后台学习时长展示：0 显示「未学习」，长时显示小时 */
export function formatStudyDuration(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec || 0));
  if (sec <= 0) return "未学习";
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  if (m < 60) {
    const s = sec % 60;
    return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`;
  }
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h} 小时 ${rm} 分` : `${h} 小时`;
}

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || `course-${Date.now()}`
  );
}

/**
 * App Router 动态段对中文等非 ASCII 常以 percent-encoding 传入。
 * 查库前解码，避免「创建成功 → 打开前台 404」。
 */
export function decodeRouteSlug(raw: string) {
  if (!raw) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function makeOrderNo() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `YD${stamp}${Math.floor(Math.random() * 9000 + 1000)}`;
}
