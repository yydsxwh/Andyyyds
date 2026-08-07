"use client";

/**
 * 约搭创建/编辑表单：前台发起与站长后台共用，避免两套字段漂移。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MeetupContentEditor } from "@/components/meetup-content-editor";
import { MeetupDatetimePicker } from "@/components/meetup-datetime-picker";
import { MeetupPlaceMapPicker } from "@/components/meetup-place-map-picker";
import { MeetupTimezonePicker } from "@/components/meetup-timezone-picker";
import type { MeetupContentBlock } from "@/lib/meetup-content";
import {
  MEETUP_CATEGORIES,
  MEETUP_DEFAULT_SLOT_PEOPLE,
  MEETUP_MAX_PEOPLE,
  MEETUP_MIN_PEOPLE,
  MEETUP_PEOPLE_SELECT_MAX,
  MEETUP_STATUSES,
  parseMeetupPeopleInput,
} from "@/lib/meetup";

/** 下拉 1～100；超过 100 用手输。一次生成避免每次 render map */
const MEETUP_PEOPLE_SELECT_OPTIONS = Array.from(
  { length: MEETUP_PEOPLE_SELECT_MAX },
  (_, i) => i + 1,
);
import {
  DEFAULT_MEETUP_TIMEZONE,
  defaultMeetupEndWall,
  defaultMeetupStartWall,
  meetupTimeZoneLabel,
  normalizeMeetupTimeZone,
  utcToWallClock,
} from "@/lib/meetup-timezone";

async function suggestTimezoneFromCoords(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/geo/timezone?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    );
    const data = (await res.json()) as { timeZone?: string };
    if (!res.ok || !data.timeZone) return null;
    return normalizeMeetupTimeZone(data.timeZone);
  } catch {
    return null;
  }
}

export type MeetupEditorSlot = {
  id?: string;
  name: string;
  /** 最近一次解析成功的人数 */
  maxPeople: number;
  /**
   * 输入框原文：编辑中允许空串，避免 type=number+min 删不掉「1」。
   * 失焦/提交时再 parseMeetupPeopleInput。
   */
  maxPeopleText: string;
  peopleError?: string;
  joinCount?: number;
};

function slotFromInitial(slot: {
  id?: string;
  name: string;
  maxPeople: number;
  joinCount?: number;
}): MeetupEditorSlot {
  const maxPeople = Math.max(
    MEETUP_MIN_PEOPLE,
    Math.min(MEETUP_MAX_PEOPLE, Math.floor(Number(slot.maxPeople) || MEETUP_DEFAULT_SLOT_PEOPLE)),
  );
  return {
    id: slot.id,
    name: slot.name,
    maxPeople,
    maxPeopleText: String(maxPeople),
    joinCount: slot.joinCount,
  };
}

export type MeetupEditorInitial = {
  id?: string;
  title?: string;
  description?: string;
  contentHtml?: string;
  priceCents?: number;
  category?: string;
  startsAt?: string;
  endsAt?: string | null;
  /** IANA；缺省北京时间 */
  timezone?: string | null;
  place?: string;
  latitude?: number | null;
  longitude?: number | null;
  coverUrl?: string;
  tags?: string[];
  feeIncludes?: string;
  refundPolicy?: string;
  autoRefund?: boolean;
  gallery?: string[];
  contactUrl?: string;
  meetingPoint?: string;
  destination?: string;
  highlights?: string;
  adminPhone?: string;
  /** 客服电话：[{label,phone}] */
  servicePhones?: { label: string; phone: string }[];
  wechatService?: string;
  itineraryHtml?: string;
  feeNoteHtml?: string;
  notesHtml?: string;
  status?: string;
  /** 服务端只给 maxPeople；表单内再生成 maxPeopleText */
  slots?: {
    id?: string;
    name: string;
    maxPeople: number;
    joinCount?: number;
  }[];
};

type Props = {
  mode: "create" | "edit";
  /** create 用 /api/meetup 或 /api/studio/meetups；edit 用 studio/[id] */
  apiPath: string;
  initial?: MeetupEditorInitial;
  /** 成功后跳转 */
  successHref?: (id: string) => string;
  submitLabel?: string;
  showStatus?: boolean;
};

export function MeetupEditorForm({
  mode,
  apiPath,
  initial,
  successHref,
  submitLabel,
  showStatus = false,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml || "");
  const [contentBlocks, setContentBlocks] = useState<MeetupContentBlock[]>([]);
  const [priceYuan, setPriceYuan] = useState(() => {
    const cents = initial?.priceCents || 0;
    return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  });
  const [category, setCategory] = useState(initial?.category || "SPORT");
  const [timezone, setTimezone] = useState(() =>
    normalizeMeetupTimeZone(initial?.timezone || DEFAULT_MEETUP_TIMEZONE),
  );
  // 墙钟 YYYY-MM-DDTHH:mm（活动时区），非浏览器本地时区；由自定义选择器写入
  const [startsAt, setStartsAt] = useState(() => {
    if (initial?.startsAt) {
      return utcToWallClock(
        new Date(initial.startsAt),
        normalizeMeetupTimeZone(initial.timezone),
      );
    }
    return defaultMeetupStartWall(DEFAULT_MEETUP_TIMEZONE);
  });
  const [endsAt, setEndsAt] = useState(() => {
    if (initial?.endsAt) {
      return utcToWallClock(
        new Date(initial.endsAt),
        normalizeMeetupTimeZone(initial.timezone),
      );
    }
    return defaultMeetupEndWall(
      defaultMeetupStartWall(DEFAULT_MEETUP_TIMEZONE),
    );
  });
  const [place, setPlace] = useState(initial?.place || "");
  // 可选坐标：旧活动为空；填了才参与广场「距离最近」
  const [latitude, setLatitude] = useState(
    initial?.latitude != null && Number.isFinite(initial.latitude)
      ? String(initial.latitude)
      : "",
  );
  const [longitude, setLongitude] = useState(
    initial?.longitude != null && Number.isFinite(initial.longitude)
      ? String(initial.longitude)
      : "",
  );
  const [geoBusy, setGeoBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl || "");
  const [tagsText, setTagsText] = useState(
    (initial?.tags || ["新手友好", "开心社交"]).join(", "),
  );
  const [feeIncludes, setFeeIncludes] = useState(initial?.feeIncludes || "");
  const [refundPolicy, setRefundPolicy] = useState(
    initial?.refundPolicy ||
      "开始前 6 小时全额退，开始前 50% 退（以说明为准）",
  );
  const [autoRefund, setAutoRefund] = useState(
    initial?.autoRefund !== undefined ? initial.autoRefund : true,
  );
  const [galleryText, setGalleryText] = useState(
    (initial?.gallery || []).join("\n"),
  );
  const [contactUrl, setContactUrl] = useState(initial?.contactUrl || "");
  const [meetingPoint, setMeetingPoint] = useState(initial?.meetingPoint || "");
  const [destination, setDestination] = useState(initial?.destination || "");
  const [highlights, setHighlights] = useState(initial?.highlights || "");
  const [adminPhone, setAdminPhone] = useState(initial?.adminPhone || "");
  // 每行「标签|电话」，与分档人数输入分离，避免互相干扰
  const [servicePhonesText, setServicePhonesText] = useState(() =>
    (initial?.servicePhones || [])
      .map((p) => `${p.label || "客服"}|${p.phone}`)
      .join("\n"),
  );
  const [wechatService, setWechatService] = useState(
    initial?.wechatService || "",
  );
  const [itineraryHtml, setItineraryHtml] = useState(
    initial?.itineraryHtml || "",
  );
  const [feeNoteHtml, setFeeNoteHtml] = useState(initial?.feeNoteHtml || "");
  const [notesHtml, setNotesHtml] = useState(initial?.notesHtml || "");
  const [status, setStatus] = useState(initial?.status || "OPEN");
  const [slots, setSlots] = useState<MeetupEditorSlot[]>(
    initial?.slots?.length
      ? initial.slots.map((s) => slotFromInitial(s))
      : [
          slotFromInitial({
            name: "新手局",
            maxPeople: MEETUP_DEFAULT_SLOT_PEOPLE,
          }),
          slotFromInitial({
            name: "对抗局",
            maxPeople: MEETUP_DEFAULT_SLOT_PEOPLE,
          }),
        ],
  );
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function updateSlot(index: number, patch: Partial<MeetupEditorSlot>) {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  /** 手输过程只改原文，允许空；不立刻 Number()||1 以免删不掉 */
  function onSlotPeopleTextChange(index: number, text: string) {
    updateSlot(index, { maxPeopleText: text, peopleError: undefined });
  }

  /** 下拉写入：同时更新原文与已解析人数 */
  function onSlotPeopleSelect(index: number, value: number) {
    updateSlot(index, {
      maxPeople: value,
      maxPeopleText: String(value),
      peopleError: undefined,
    });
  }

  /** 失焦解析；失败保留原文并提示，成功写回 maxPeople */
  function commitSlotPeople(index: number) {
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const parsed = parseMeetupPeopleInput(s.maxPeopleText);
        if (!parsed.ok) {
          return { ...s, peopleError: parsed.error };
        }
        return {
          ...s,
          maxPeople: parsed.value,
          maxPeopleText: String(parsed.value),
          peopleError: undefined,
        };
      }),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    // 提交前统一解析各档人数；任一手输非法则拦下并标红
    let peopleInvalid = false;
    const committedSlots = slots.map((s) => {
      const parsed = parseMeetupPeopleInput(s.maxPeopleText);
      if (!parsed.ok) {
        peopleInvalid = true;
        return { ...s, peopleError: parsed.error };
      }
      return {
        ...s,
        maxPeople: parsed.value,
        maxPeopleText: String(parsed.value),
        peopleError: undefined,
      };
    });
    if (peopleInvalid) {
      setSlots(committedSlots);
      setMessage("请修正分档人数后再保存");
      return;
    }
    setSlots(committedSlots);

    setLoading(true);
    try {
      const tags = tagsText
        .split(/[,，|｜]/g)
        .map((t) => t.trim())
        .filter(Boolean);
      const gallery = galleryText
        .split(/\n+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const servicePhones = servicePhonesText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [labelPart, ...rest] = line.split("|");
          const phone = (rest.length ? rest.join("|") : labelPart || "").trim();
          const label =
            rest.length > 0
              ? (labelPart || "客服").trim()
              : "客服";
          return { label: label || "客服", phone };
        })
        .filter((p) => p.phone);

      const payload: Record<string, unknown> = {
        title,
        description,
        // 编辑时若未追加新块，保留原 HTML；有新块则覆盖
        contentHtml: mode === "edit" ? contentHtml : "",
        contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
        priceYuan: priceYuan.trim() === "" ? 0 : Number(priceYuan),
        category,
        // 传墙钟 + timezone，由服务端换算 UTC，避免浏览器时区污染
        startsAt,
        endsAt: endsAt.trim() ? endsAt : null,
        timezone,
        place,
        latitude: latitude.trim() === "" ? null : Number(latitude),
        longitude: longitude.trim() === "" ? null : Number(longitude),
        maxPeople: Math.max(
          MEETUP_MIN_PEOPLE,
          committedSlots.reduce((n, s) => n + s.maxPeople, 0),
        ),
        coverUrl: coverUrl.trim(),
        tags,
        feeIncludes,
        refundPolicy,
        autoRefund,
        gallery,
        contactUrl: contactUrl.trim(),
        meetingPoint: meetingPoint.trim(),
        destination: destination.trim(),
        highlights: highlights.trim(),
        adminPhone: adminPhone.trim(),
        servicePhones,
        wechatService: wechatService.trim(),
        itineraryHtml,
        feeNoteHtml,
        notesHtml,
        slots: committedSlots.map((s) => ({
          id: s.id,
          name: s.name.trim(),
          maxPeople: s.maxPeople,
        })),
      };
      if (showStatus) payload.status = status;

      const res = await fetch(apiPath, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "保存失败");
        return;
      }
      const id = data.id || data.meetup?.id || initial?.id;
      if (id && successHref) {
        router.push(successHref(id));
      } else {
        router.refresh();
        setMessage("已保存");
      }
      router.refresh();
    } catch {
      setMessage("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="surface mx-auto max-w-xl space-y-5 rounded-[32px] p-5 sm:p-8"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium">标题</label>
        <input
          className="field min-h-11"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：【室内空调场】匹克球多等级畅打局"
          required
          maxLength={80}
        />
      </div>

      {showStatus ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium">状态</label>
          <select
            className="field min-h-11"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {MEETUP_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="mb-1.5 block text-sm font-medium">分类</label>
        <div className="flex flex-wrap gap-2">
          {MEETUP_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm ${
                category === c.key
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] bg-white/70"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <MeetupTimezonePicker
        value={timezone}
        onChange={(next) => {
          // 换时区保留墙钟数字（仍填「当地 14:00」），绝对 UTC 由服务端按新时区重算
          setTimezone(next);
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            开始时间（{meetupTimeZoneLabel(timezone)}）
          </label>
          <MeetupDatetimePicker
            value={startsAt}
            onChange={setStartsAt}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            结束时间（{meetupTimeZoneLabel(timezone)}）
          </label>
          <MeetupDatetimePicker
            value={endsAt}
            onChange={setEndsAt}
            allowEmpty
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">地点</label>
        <input
          className="field min-h-11"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="城市 + 具体地点"
          required
          maxLength={120}
        />
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
          地图与搜索供参考，请核对地点文案；精确导航请用高德/腾讯/苹果/google地图打开。
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="btn btn-primary min-h-12 flex-1 touch-manipulation"
            onClick={() => setMapOpen(true)}
          >
            地图选点
          </button>
          <button
            type="button"
            className="btn min-h-12 flex-1 touch-manipulation"
            disabled={geoBusy}
            onClick={() => {
              // 「使用当前位置」= 活动举办地设为发布者 GPS（人在场馆时快捷），
              // 不是发帖瞬间的元数据；广场 nearest 比的是活动坐标 vs 浏览者位置。
              if (!navigator.geolocation) {
                setMessage("当前环境不支持定位，请改用「地图选点」");
                return;
              }
              setGeoBusy(true);
              setMessage("");
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const lat = Number(pos.coords.latitude.toFixed(6));
                  const lng = Number(pos.coords.longitude.toFixed(6));
                  setLatitude(String(lat));
                  setLongitude(String(lng));
                  setGeoBusy(false);
                  // 反查地址 + 建议时区（人在国外场馆时一并把活动时区对齐）
                  void fetch(
                    `/api/geo/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
                  )
                    .then(async (res) => {
                      const data = (await res.json()) as {
                        displayName?: string | null;
                      };
                      if (res.ok && data.displayName?.trim()) {
                        setPlace(data.displayName.trim());
                      }
                    })
                    .catch(() => {
                      /* 反查失败不阻断 */
                    });
                  void suggestTimezoneFromCoords(lat, lng).then((tz) => {
                    if (tz) setTimezone(tz);
                  });
                },
                () => {
                  setMessage("定位失败，请检查授权或改用「地图选点」");
                  setGeoBusy(false);
                },
                {
                  enableHighAccuracy: true,
                  timeout: 12_000,
                  maximumAge: 30_000,
                },
              );
            }}
          >
            {geoBusy ? "定位中…" : "使用当前位置"}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          活动坐标（可选）
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="field min-h-11"
            type="number"
            step="any"
            inputMode="decimal"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="纬度 lat"
          />
          <input
            className="field min-h-11"
            type="number"
            step="any"
            inputMode="decimal"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="经度 lng"
          />
        </div>
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          建议用「地图选点」：有活动坐标时，广场「距离最近」按活动地与浏览者位置排序；仅填地点文案也可发布
        </p>
      </div>

      <MeetupPlaceMapPicker
        open={mapOpen}
        initialLat={
          latitude.trim() !== "" && Number.isFinite(Number(latitude))
            ? Number(latitude)
            : null
        }
        initialLng={
          longitude.trim() !== "" && Number.isFinite(Number(longitude))
            ? Number(longitude)
            : null
        }
        onClose={() => setMapOpen(false)}
        onConfirm={(result) => {
          setLatitude(String(result.latitude));
          setLongitude(String(result.longitude));
          // 反查成功才覆盖地点文案，避免清空用户手填地址
          if (result.placeLabel) {
            setPlace(result.placeLabel);
          }
          setMapOpen(false);
          setMessage("");
          // 地图选全球地点时同步建议活动时区（可再手改）
          void suggestTimezoneFromCoords(
            result.latitude,
            result.longitude,
          ).then((tz) => {
            if (tz) setTimezone(tz);
          });
        }}
      />

      <div>
        <label className="mb-1.5 block text-sm font-medium">报名费（元）</label>
        <input
          className="field min-h-11"
          type="number"
          min={0}
          step={0.01}
          value={priceYuan}
          onChange={(e) => setPriceYuan(e.target.value)}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label className="text-sm font-medium">分档名额</label>
          <button
            type="button"
            className="text-sm text-[var(--brand)]"
            onClick={() => {
              if (slots.length >= 8) return;
              setSlots((prev) => [
                ...prev,
                slotFromInitial({
                  name: `分档${prev.length + 1}`,
                  maxPeople: MEETUP_DEFAULT_SLOT_PEOPLE,
                }),
              ]);
            }}
          >
            + 添加分档
          </button>
        </div>
        <ul className="space-y-2">
          {slots.map((slot, index) => {
            const selectValue =
              slot.maxPeople >= 1 &&
              slot.maxPeople <= MEETUP_PEOPLE_SELECT_MAX &&
              slot.maxPeopleText.trim() === String(slot.maxPeople)
                ? String(slot.maxPeople)
                : "";
            return (
              <li
                key={slot.id || `new-${index}`}
                className="rounded-2xl border border-[var(--line)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="field min-h-11 min-w-[8rem] flex-1 basis-full sm:basis-auto"
                    value={slot.name}
                    onChange={(e) =>
                      updateSlot(index, { name: e.target.value })
                    }
                    required
                    maxLength={40}
                    placeholder="分档名称"
                  />
                  {/* text + inputMode：可清空重输；微信内也比 type=number 好删改 */}
                  <input
                    className="field min-h-11 w-28"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={slot.maxPeopleText}
                    onChange={(e) =>
                      onSlotPeopleTextChange(index, e.target.value)
                    }
                    onBlur={() => commitSlotPeople(index)}
                    aria-label={`${slot.name || "分档"}人数`}
                    aria-invalid={Boolean(slot.peopleError)}
                  />
                  <select
                    className="field min-h-11 w-[5.5rem]"
                    value={selectValue}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      onSlotPeopleSelect(index, n);
                    }}
                    aria-label={`${slot.name || "分档"}人数快捷选择`}
                  >
                    <option value="" disabled={selectValue !== ""}>
                      {selectValue ? "1-100" : "选择"}
                    </option>
                    {MEETUP_PEOPLE_SELECT_OPTIONS.map((n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-[var(--muted)]">人</span>
                  {(slot.joinCount || 0) > 0 ? (
                    <span className="text-xs text-[var(--muted)]">
                      已报 {slot.joinCount}
                    </span>
                  ) : null}
                  {slots.length > 1 &&
                  !(slot.joinCount && slot.joinCount > 0) ? (
                    <button
                      type="button"
                      className="min-h-11 px-2 text-sm text-[var(--fire)]"
                      onClick={() =>
                        setSlots((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      删除
                    </button>
                  ) : null}
                </div>
                {slot.peopleError ? (
                  <p className="mt-1.5 text-xs text-[var(--fire)]">
                    {slot.peopleError}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          下拉可选 1–{MEETUP_PEOPLE_SELECT_MAX} 人；也可清空后手输，最大{" "}
          {MEETUP_MAX_PEOPLE.toLocaleString("zh-CN")}
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">玩法标签</label>
        <input
          className="field min-h-11"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="新手友好, 开心社交"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">费用包含</label>
          <textarea
            className="field min-h-24"
            value={feeIncludes}
            onChange={(e) => setFeeIncludes(e.target.value)}
            maxLength={500}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">退款政策</label>
          <textarea
            className="field min-h-24"
            value={refundPolicy}
            onChange={(e) => setRefundPolicy(e.target.value)}
            maxLength={500}
          />
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefund}
              onChange={(e) => setAutoRefund(e.target.checked)}
            />
            展示「自动退」标签
          </label>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">短简介</label>
        <textarea
          className="field min-h-20"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </div>

      {mode === "edit" ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            详情 HTML（已有富媒体）
          </label>
          <textarea
            className="field min-h-32 font-mono text-xs"
            value={contentHtml}
            onChange={(e) => setContentHtml(e.target.value)}
            placeholder="可直接改 HTML；下方追加块会覆盖此内容"
          />
        </div>
      ) : null}

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {mode === "edit" ? "追加/重写图文视频块（选填）" : "本场怎么玩"}
        </label>
        <MeetupContentEditor
          blocks={contentBlocks}
          onChange={setContentBlocks}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">图集链接</label>
        <textarea
          className="field min-h-24"
          value={galleryText}
          onChange={(e) => setGalleryText(e.target.value)}
          placeholder={"每行一个 URL"}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">封面图</label>
        <input
          className="field min-h-11"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          maxLength={500}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">集合地</label>
          <input
            className="field min-h-11"
            value={meetingPoint}
            onChange={(e) => setMeetingPoint(e.target.value)}
            placeholder="空则详情用「地点」"
            maxLength={120}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">目的地</label>
          <input
            className="field min-h-11"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="如：广东 惠州"
            maxLength={120}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">活动亮点</label>
        <input
          className="field min-h-11"
          value={highlights}
          onChange={(e) => setHighlights(e.target.value)}
          placeholder="如：转发返现 / 已成团说明"
          maxLength={200}
        />
      </div>

      <fieldset className="space-y-3 rounded-2xl border border-[var(--line)] p-4">
        <legend className="px-1 text-sm font-medium">咨询客服（详情底栏）</legend>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          未填时回退站点「联系我们」电话/微信。微信客服可填链接、企微或微信号。
        </p>
        <div>
          <label className="mb-1.5 block text-sm font-medium">管理员电话</label>
          <input
            className="field min-h-11"
            value={adminPhone}
            onChange={(e) => setAdminPhone(e.target.value)}
            placeholder="详情「拨打电话」与咨询弹层"
            inputMode="tel"
            maxLength={32}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            客服电话列表
          </label>
          <textarea
            className="field min-h-24"
            value={servicePhonesText}
            onChange={(e) => setServicePhonesText(e.target.value)}
            placeholder={"每行一条：标签|电话\n小六（客服）|18000000000"}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">微信客服</label>
          <input
            className="field min-h-11"
            value={wechatService}
            onChange={(e) => setWechatService(e.target.value)}
            placeholder="https://… 或微信号"
            maxLength={500}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            群聊/联系外链（可选）
          </label>
          <input
            className="field min-h-11"
            value={contactUrl}
            onChange={(e) => setContactUrl(e.target.value)}
            maxLength={500}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-2xl border border-[var(--line)] p-4">
        <legend className="px-1 text-sm font-medium">
          内容 Tab 分块（可选）
        </legend>
        <p className="text-xs text-[var(--muted)]">
          详情页四个 Tab：活动介绍用上方「本场怎么玩」；此处补行程/费用/注意事项。可写纯文本或简单
          HTML。
        </p>
        <div>
          <label className="mb-1.5 block text-sm font-medium">行程安排</label>
          <textarea
            className="field min-h-28"
            value={itineraryHtml}
            onChange={(e) => setItineraryHtml(e.target.value)}
            placeholder="时间线、集合安排等"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">费用说明</label>
          <textarea
            className="field min-h-28"
            value={feeNoteHtml}
            onChange={(e) => setFeeNoteHtml(e.target.value)}
            placeholder="空则回退「费用包含 / 退款政策」"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">注意事项</label>
          <textarea
            className="field min-h-28"
            value={notesHtml}
            onChange={(e) => setNotesHtml(e.target.value)}
            placeholder="装备、保险、取消规则等"
          />
        </div>
      </fieldset>

      {message ? (
        <p className="text-sm text-[var(--fire)]">{message}</p>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary min-h-11 w-full"
        disabled={loading}
      >
        {loading
          ? "保存中…"
          : submitLabel || (mode === "edit" ? "保存修改" : "发布约搭")}
      </button>
    </form>
  );
}
