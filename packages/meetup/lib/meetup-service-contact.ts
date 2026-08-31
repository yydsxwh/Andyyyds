/**
 * 约搭咨询客服：活动自配电话/微信 + 站点「联系我们」回退。
 * 为何单独模块：详情弹层与创建表单共用解析，避免两处 JSON 形状漂移。
 */

export type MeetupServicePhone = {
  label: string;
  phone: string;
};

/** 报名占用名额求和；旧数据无 partySize 时按 1 */
export function sumMeetupPartySize(
  joins: { partySize?: number | null }[],
): number {
  return joins.reduce((sum, j) => {
    const n = Math.floor(Number(j.partySize) || 1);
    return sum + Math.max(1, n);
  }, 0);
}

/** 最近报名展示：手机号脱敏；短昵称保留首字 */
export function maskMeetupDisplayName(name: string): string {
  const raw = String(name || "").trim() || "匿名";
  if (/^1\d{10}$/.test(raw)) {
    return `${raw.slice(0, 3)}****${raw.slice(7)}`;
  }
  if (raw.length <= 1) return raw;
  if (raw.length === 2) return `${raw[0]}*`;
  if (raw.length <= 4) return `${raw[0]}${"*".repeat(raw.length - 1)}`;
  return `${raw.slice(0, 2)}***`;
}

export function parseMeetupServicePhones(
  raw: string | null | undefined,
): MeetupServicePhone[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const list: MeetupServicePhone[] = [];
    for (const item of parsed.slice(0, 8)) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const phone = String(row.phone || "")
        .trim()
        .replace(/[^\d+\-()\s]/g, "")
        .slice(0, 32);
      if (!phone) continue;
      const label = String(row.label || "客服").trim().slice(0, 40) || "客服";
      list.push({ label, phone });
    }
    return list;
  } catch {
    return [];
  }
}

export function stringifyMeetupServicePhones(
  phones: MeetupServicePhone[],
): string {
  const list = phones
    .map((p) => ({
      label: String(p.label || "").trim().slice(0, 40),
      phone: String(p.phone || "")
        .trim()
        .replace(/[^\d+\-()\s]/g, "")
        .slice(0, 32),
    }))
    .filter((p) => p.phone)
    .slice(0, 8);
  return list.length ? JSON.stringify(list) : "";
}

/** 仅允许 http(s)、站内路径；微信号原样保留（前端复制） */
export function normalizeWechatService(raw: string): string {
  return String(raw || "").trim().slice(0, 500);
}

export function isWechatServiceLink(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^https?:\/\//i.test(v) || v.startsWith("/");
}

export type SiteContactFallback = {
  phone?: string;
  wechat?: string;
  title?: string;
};

/**
 * 组装咨询弹层电话列表：活动客服 → 管理员电话 → 站点联系电话。
 * 去重按号码，避免同一号码重复展示。
 */
export function buildMeetupConsultPhones(input: {
  servicePhones: MeetupServicePhone[];
  adminPhone?: string;
  adminLabel?: string;
  siteContact?: SiteContactFallback | null;
}): MeetupServicePhone[] {
  const out: MeetupServicePhone[] = [];
  const seen = new Set<string>();
  const push = (label: string, phone: string) => {
    const p = phone.trim();
    if (!p) return;
    const key = p.replace(/\D/g, "") || p;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label: label || "客服", phone: p });
  };

  for (const row of input.servicePhones) {
    push(row.label, row.phone);
  }
  if (input.adminPhone?.trim()) {
    push(input.adminLabel || "活动管理员", input.adminPhone);
  }
  if (input.siteContact?.phone?.trim()) {
    push(
      input.siteContact.title?.trim() || "网站联系方式",
      input.siteContact.phone,
    );
  }
  return out.slice(0, 10);
}
