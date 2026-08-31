/**
 * 约搭详情扩展字段：标签 / 图集 / 订单里绑定分档。
 * 分档名额存在 MeetupSlot；旧活动无档时前端虚拟「报名」档，避免强制迁移。
 */

import {
  MEETUP_DEFAULT_SLOT_PEOPLE,
  MEETUP_MAX_PEOPLE,
  MEETUP_MIN_PEOPLE,
} from "@andyyyds/meetup/lib/meetup";

export const MEETUP_SLOT_SPEC_PREFIX = "meetupSlot:";

export function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 24);
  } catch {
    return [];
  }
}

export function stringifyJsonStringArray(items: string[]): string {
  const list = items.map((x) => x.trim()).filter(Boolean).slice(0, 24);
  return list.length ? JSON.stringify(list) : "";
}

/** 下单时把所选分档写入 Order.specLabel，支付履约后再写入 MeetupJoin.slotId */
export function meetupSlotSpecLabel(slotId: string): string {
  return `${MEETUP_SLOT_SPEC_PREFIX}${slotId}`;
}

export function parseMeetupSlotIdFromSpec(specLabel: string | null | undefined): string | null {
  const s = (specLabel || "").trim();
  if (!s.startsWith(MEETUP_SLOT_SPEC_PREFIX)) return null;
  const id = s.slice(MEETUP_SLOT_SPEC_PREFIX.length).trim();
  return id || null;
}

export type MeetupSlotInput = {
  name: string;
  maxPeople: number;
};

/** 创建时规范化分档；未传则默认一档「报名」 */
export function normalizeMeetupSlotInputs(
  slots: MeetupSlotInput[] | undefined,
  fallbackMaxPeople: number,
): MeetupSlotInput[] {
  const cleaned = (slots || [])
    .map((s) => {
      const n = Math.floor(Number(s.maxPeople) || 0);
      return {
        name: String(s.name || "").trim().slice(0, 40),
        // 与表单/zod 同一上限，避免后端静默裁到旧的 50
        maxPeople: Math.max(
          MEETUP_MIN_PEOPLE,
          Math.min(MEETUP_MAX_PEOPLE, n > 0 ? n : MEETUP_DEFAULT_SLOT_PEOPLE),
        ),
      };
    })
    .filter((s) => s.name);
  if (cleaned.length === 0) {
    return [
      {
        name: "报名",
        maxPeople: Math.max(
          MEETUP_MIN_PEOPLE,
          Math.min(MEETUP_MAX_PEOPLE, fallbackMaxPeople || MEETUP_DEFAULT_SLOT_PEOPLE),
        ),
      },
    ];
  }
  return cleaned.slice(0, 8);
}
