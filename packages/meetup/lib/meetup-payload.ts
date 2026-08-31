/**
 * 约搭创建/编辑共用载荷解析（前台发起 + 站长后台）。
 * 集中校验避免两套规则漂移。
 */

import { z } from "zod";
import {
  isMeetupCategory,
  MEETUP_DEFAULT_SLOT_PEOPLE,
  MEETUP_MAX_PEOPLE,
  MEETUP_MAX_PRICE_CENTS,
  MEETUP_MAX_TOTAL_PEOPLE,
  MEETUP_MIN_PEOPLE,
  parseOptionalCoord,
  yuanToMeetupPriceCents,
} from "@andyyyds/meetup/lib/meetup";
import {
  meetupBlocksToHtml,
  parseMeetupContentBlocks,
  sanitizeMeetupContentHtml,
} from "@andyyyds/meetup/lib/meetup-content";
import {
  normalizeMeetupSlotInputs,
  stringifyJsonStringArray,
} from "@andyyyds/meetup/lib/meetup-meta";
import {
  normalizeWechatService,
  stringifyMeetupServicePhones,
  type MeetupServicePhone,
} from "@andyyyds/meetup/lib/meetup-service-contact";
import {
  DEFAULT_MEETUP_TIMEZONE,
  isValidIanaTimeZone,
  normalizeMeetupTimeZone,
  wallClockToUtc,
} from "@andyyyds/meetup/lib/meetup-timezone";

export const meetupSlotPayloadSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(40),
  maxPeople: z.number().int().min(1).max(MEETUP_MAX_PEOPLE),
});

const meetupServicePhoneSchema = z.object({
  label: z.string().trim().max(40).optional().default("客服"),
  phone: z.string().trim().min(1).max(32),
});

export const meetupWriteSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).optional().default(""),
  contentHtml: z.string().max(100_000).optional().default(""),
  contentBlocks: z.array(z.unknown()).max(40).optional(),
  priceYuan: z.union([z.number(), z.string()]).optional(),
  /** 前台营销面隐藏报名费（结账仍显示应付） */
  hidePrice: z.boolean().optional(),
  category: z.string().trim(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  /** IANA 时区；墙钟 startsAt/endsAt 相对此时区换算 UTC */
  timezone: z.string().trim().max(64).optional(),
  place: z.string().trim().min(1).max(120),
  // 可选坐标：空串/省略=清除或不写；仅填地点文案的旧活动仍可创建
  latitude: z.union([z.number(), z.string(), z.null()]).optional(),
  longitude: z.union([z.number(), z.string(), z.null()]).optional(),
  maxPeople: z
    .number()
    .int()
    .min(MEETUP_MIN_PEOPLE)
    .max(MEETUP_MAX_TOTAL_PEOPLE)
    .optional(),
  coverUrl: z.string().trim().max(500).optional().default(""),
  tags: z.array(z.string()).max(12).optional(),
  feeIncludes: z.string().trim().max(500).optional().default(""),
  refundPolicy: z.string().trim().max(500).optional().default(""),
  autoRefund: z.boolean().optional().default(false),
  gallery: z.array(z.string()).max(12).optional(),
  contactUrl: z.string().trim().max(500).optional().default(""),
  meetingPoint: z.string().trim().max(120).optional().default(""),
  destination: z.string().trim().max(120).optional().default(""),
  highlights: z.string().trim().max(200).optional().default(""),
  adminPhone: z.string().trim().max(32).optional().default(""),
  servicePhones: z.array(meetupServicePhoneSchema).max(8).optional(),
  wechatService: z.string().trim().max(500).optional().default(""),
  itineraryHtml: z.string().max(100_000).optional().default(""),
  feeNoteHtml: z.string().max(100_000).optional().default(""),
  notesHtml: z.string().max(100_000).optional().default(""),
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
  hidePrice: boolean;
  category: string;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  place: string;
  latitude: number | null;
  longitude: number | null;
  maxPeople: number;
  coverUrl: string;
  tagsJson: string;
  feeIncludes: string;
  refundPolicy: string;
  autoRefund: boolean;
  galleryJson: string;
  contactUrl: string;
  meetingPoint: string;
  destination: string;
  highlights: string;
  adminPhone: string;
  servicePhonesJson: string;
  wechatService: string;
  itineraryHtml: string;
  feeNoteHtml: string;
  notesHtml: string;
  slots: { id?: string; name: string; maxPeople: number }[];
  status?: string;
};

/** 写入 Prisma Meetup 时的详情扩展字段（与分档/人数逻辑解耦，便于 PATCH 复用） */
export function meetupDetailDbFields(data: ParsedMeetupWrite) {
  return {
    meetingPoint: data.meetingPoint,
    destination: data.destination,
    highlights: data.highlights,
    adminPhone: data.adminPhone,
    servicePhonesJson: data.servicePhonesJson,
    wechatService: data.wechatService,
    itineraryHtml: data.itineraryHtml,
    feeNoteHtml: data.feeNoteHtml,
    notesHtml: data.notesHtml,
  };
}

export function parseMeetupWriteBody(
  body: MeetupWriteBody,
  options?: { allowPastStart?: boolean },
): { ok: true; data: ParsedMeetupWrite } | { ok: false; error: string } {
  if (!isMeetupCategory(body.category)) {
    return { ok: false, error: "分类无效" };
  }

  const timezoneRaw = (body.timezone || DEFAULT_MEETUP_TIMEZONE).trim();
  if (timezoneRaw && !isValidIanaTimeZone(timezoneRaw)) {
    return { ok: false, error: "时区无效，请重新选择城市或时区" };
  }
  const timezone = normalizeMeetupTimeZone(timezoneRaw);

  // 前端传活动时区墙钟（datetime-local）；若带 Z/偏移则按绝对时间
  const startsAt = wallClockToUtc(body.startsAt, timezone);
  if (!startsAt) {
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
    endsAt = wallClockToUtc(body.endsAt, timezone);
    if (!endsAt || endsAt <= startsAt) {
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

  const wechatService = normalizeWechatService(body.wechatService || "");
  // 微信客服填链接时须合法；微信号允许纯文本（前端复制）
  if (wechatService && /^https?:\/\//i.test(wechatService) && !isSafeUrl(wechatService)) {
    return { ok: false, error: "微信客服链接无效" };
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
  const itineraryHtml = sanitizeMeetupContentHtml(body.itineraryHtml || "");
  const feeNoteHtml = sanitizeMeetupContentHtml(body.feeNoteHtml || "");
  const notesHtml = sanitizeMeetupContentHtml(body.notesHtml || "");

  const servicePhones: MeetupServicePhone[] = (body.servicePhones || []).map(
    (p) => ({
      label: (p.label || "客服").trim() || "客服",
      phone: p.phone.trim(),
    }),
  );

  const fallbackMax = body.maxPeople || MEETUP_DEFAULT_SLOT_PEOPLE;
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

  // 总人数=各档之和；单档已受 MEETUP_MAX_PEOPLE 约束，总和再挡在 TOTAL上限
  const maxPeople = Math.min(
    MEETUP_MAX_TOTAL_PEOPLE,
    Math.max(
      MEETUP_MIN_PEOPLE,
      slotInputs.reduce((sum, s) => sum + s.maxPeople, 0),
    ),
  );

  // 经纬度须成对才写入；只填一侧视为无效，避免半残坐标参与距离排序
  const lat = parseOptionalCoord(body.latitude, "lat");
  const lng = parseOptionalCoord(body.longitude, "lng");
  const hasPair = lat != null && lng != null;
  if (
    (body.latitude !== undefined &&
      body.latitude !== null &&
      body.latitude !== "" &&
      lat == null) ||
    (body.longitude !== undefined &&
      body.longitude !== null &&
      body.longitude !== "" &&
      lng == null)
  ) {
    return { ok: false, error: "经纬度格式无效（纬度 -90~90，经度 -180~180）" };
  }

  return {
    ok: true,
    data: {
      title: body.title,
      description: body.description || "",
      contentHtml,
      priceCents,
      hidePrice: Boolean(body.hidePrice),
      category: body.category,
      startsAt,
      endsAt,
      timezone,
      place: body.place,
      latitude: hasPair ? lat : null,
      longitude: hasPair ? lng : null,
      maxPeople,
      coverUrl,
      tagsJson: stringifyJsonStringArray(body.tags || []),
      feeIncludes: body.feeIncludes || "",
      refundPolicy: body.refundPolicy || "",
      autoRefund: Boolean(body.autoRefund),
      galleryJson: stringifyJsonStringArray(gallery),
      contactUrl,
      meetingPoint: (body.meetingPoint || "").trim().slice(0, 120),
      destination: (body.destination || "").trim().slice(0, 120),
      highlights: (body.highlights || "").trim().slice(0, 200),
      adminPhone: (body.adminPhone || "")
        .trim()
        .replace(/[^\d+\-()\s]/g, "")
        .slice(0, 32),
      servicePhonesJson: stringifyMeetupServicePhones(servicePhones),
      wechatService,
      itineraryHtml,
      feeNoteHtml,
      notesHtml,
      slots: slotsWithIds,
      status: body.status,
    },
  };
}
