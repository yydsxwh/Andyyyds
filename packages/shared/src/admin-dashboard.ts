/**
 * 站长工作台：按东八区自然日切「今日 / 昨日」时间窗，供订单与用户统计使用。
 */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** 返回上海时区某天 00:00～次日 00:00（Date 为绝对时间，可直接给 Prisma） */
export function shanghaiDayBounds(dayOffset = 0): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const startMs =
    Date.parse(`${y}-${pad2(m)}-${pad2(d)}T00:00:00+08:00`) -
    dayOffset * 24 * 60 * 60 * 1000;
  return {
    start: new Date(startMs),
    end: new Date(startMs + 24 * 60 * 60 * 1000),
  };
}
