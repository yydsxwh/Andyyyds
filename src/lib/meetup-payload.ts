/**
 * 约搭创建/编辑共用载荷解析（前台发起 + 站长后台）。
 * 集中校验避免两套规则漂移。
 */

import { z } from "zod";
import {
  isMeetupCategory,
  MEETUP_MAX_PEOPLE,
  MEETUP_MAX_PRICE_CENTS,
  MEETUP_MIN_PEOPLE,
  yuanToMeetupPriceCents,
} from "@/lib/meetup";
import {
  meetupBlocksToHtml,
  parseMeetupContentBlocks,
  sanitizeMeetupContentHtml,
} from "@/lib/meetup-content";
import {
  normalizeMeetupSlotInputs,
  stringifyJsonStringArray,
} from "@/lib/meetup-meta";

export const meetupSlotPayloadSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(40),
  maxPeople: z.number().int().min(1).max(MEETUP_MAX_PEOPLE),
});

export const meetupWriteSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).optional().default(""),
  contentHtml: z.string().max(100_000).optional().default(""),
  contentBlocks: z.array(z.unknown()).max(40).optional(),
  priceYuan: z.union([z.number(), z.string()]).optional(),
  category: z.string().trim(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  place: z.string().trim().min(1).max(120),
  maxPeople: z
    .number()
    .int()
    .min(MEETUP_MIN_PEOPLE)
    .max(MEETUP_MAX_PEOPLE)
    .optional(),
  coverUrl: z.string().trim().max(500).optional().default(""),
  tags: z.array(z.string()).max(12).optional(),
  feeIncludes: z.string().trim().max(500).optional().default(""),
  refundPolicy: z.string().trim().max(500).optional().default(""),
  autoRefund: z.boolean().optional().default(false),
  gallery: z.array(z.string()).max(12).optional(),
  contactUrl: z.string().trim().max(500).optional().default(""),
  slots: z.array(meetupSlotPayloadSchema).max(8).optional(),
  status: z.string().trim().optional(),
});

export type MeetupWriteBody = z.infer<typeof meetupWriteSchema>;

function isSafeUrl(url: string): boolean {
  if (!url) return true;
  return /^https?:\/\//i.test(url) || url.startsWith("/");
}

export type ParsedMeetupWrite = {
  title: string;
  description: string;
  contentHtml: string;
  priceCents: number;
  category: string;
  startsAt: Date;
  endsAt: Date | null;
  place: string;
  maxPeople: number;
  coverUrl: string;
  tagsJson: string;
  feeIncludes: string;
  refundPolicy: string;
  autoRefund: boolean;
  galleryJson: string;
  contactUrl: string;
  slots: { id?: string; name: string; maxPeople: number }[];
  status?: string;
};

export function parseMeetupWriteBody(
  body: MeetupWriteBody,
  options?: { allowPastStart?: boolean },
): { ok: true; data: ParsedMeetupWrite } | { ok: false; error: string } {
  if (!isMeetupCategory(body.category)) {
    return { ok: false, error: "分类无效" };
  }

  const startsAt = new Date(body.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "开始时间无效" };
  }
  if (
    !options?.allowPastStart &&
    startsAt.getTime() < Date.now() - 30 * 60 * 1000
  ) {
    return { ok: false, error: "开始时间不能早于当前时间" };
  }

  let endsAt: Date | null = null;
  if (body.endsAt) {
    endsAt = new Date(body.endsAt);
    if (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return { ok: false, error: "结束时间须晚于开始时间" };
    }
  }

  const coverUrl = body.coverUrl?.trim() || "";
  if (coverUrl && !isSafeUrl(coverUrl)) {
    return { ok: false, error: "封面请填写 http(s) 链接或站内路径" };
  }
  const contactUrl = body.contactUrl?.trim() || "";
  if (contactUrl && !isSafeUrl(contactUrl)) {
    return { ok: false, error: "联系链接无效" };
  }

  const gallery = (body.gallery || [])
    .map((u) => u.trim())
    .filter((u) => isSafeUrl(u))
    .slice(0, 12);

  const priceCents = yuanToMeetupPriceCents(body.priceYuan ?? 0);
  if (priceCents > MEETUP_MAX_PRICE_CENTS) {
    return { ok: false, error: "报名费过高" };
  }

  const blocks = body.contentBlocks
    ? parseMeetupContentBlocks(body.contentBlocks)
    : null;
  const contentHtml = sanitizeMeetupContentHtml(
    blocks && blocks.length > 0
      ? meetupBlocksToHtml(blocks)
      : body.contentHtml || "",
  );

  const fallbackMax =
    body.maxPeople ||
    MEETUP_MIN_PEOPLE;
  const slotInputs = normalizeMeetupSlotInputs(
    (body.slots || []).map((s) => ({
      name: s.name,
      maxPeople: s.maxPeople,
    })),
    fallbackMax,
  );
  // 保留编辑时传入的 slot.id（normalize 会丢掉，这里按名称对齐补回）
  const slotsWithIds = slotInputs.map((s, i) => {
    const raw = body.slots?.[i];
    const byName = body.slots?.find((x) => x.name === s.name && x.id);
    return {
      id: raw?.id || byName?.id,
      name: s.name,
      maxPeople: s.maxPeople,
    };
  });

  const maxPeople = Math.min(
    MEETUP_MAX_PEOPLE,
    Math.max(
      MEETUP_MIN_PEOPLE,
      slotInputs.reduce((sum, s) => sum + s.maxPeople, 0),
    ),
  );

  return {
    ok: true,
    data: {
      title: body.title,
      description: body.description || "",
      contentHtml,
      priceCents,
      category: body.category,
      startsAt,
      endsAt,
      place: body.place,
      maxPeople,
      coverUrl,
      tagsJson: stringifyJsonStringArray(body.tags || []),
      feeIncludes: body.feeIncludes || "",
      refundPolicy: body.refundPolicy || "",
      autoRefund: Boolean(body.autoRefund),
      galleryJson: stringifyJsonStringArray(gallery),
      contactUrl,
      slots: slotsWithIds,
      status: body.status,
    },
  };
}
