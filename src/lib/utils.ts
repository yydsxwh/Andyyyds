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
