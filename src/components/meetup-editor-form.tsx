"use client";

/**
 * 约搭创建/编辑表单：前台发起与站长后台共用，避免两套字段漂移。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MeetupContentEditor } from "@/components/meetup-content-editor";
import type { MeetupContentBlock } from "@/lib/meetup-content";
import {
  MEETUP_CATEGORIES,
  MEETUP_MAX_PEOPLE,
  MEETUP_MIN_PEOPLE,
  MEETUP_STATUSES,
} from "@/lib/meetup";

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultStartsAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setMinutes(0, 0, 0);
  return toDatetimeLocalValue(d);
}

function defaultEndsAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(d.getHours() + 3);
  d.setMinutes(0, 0, 0);
  return toDatetimeLocalValue(d);
}

export type MeetupEditorSlot = {
  id?: string;
  name: string;
  maxPeople: number;
  joinCount?: number;
};

export type MeetupEditorInitial = {
  id?: string;
  title?: string;
  description?: string;
  contentHtml?: string;
  priceCents?: number;
  category?: string;
  startsAt?: string;
  endsAt?: string | null;
  place?: string;
  coverUrl?: string;
  tags?: string[];
  feeIncludes?: string;
  refundPolicy?: string;
  autoRefund?: boolean;
  gallery?: string[];
  contactUrl?: string;
  status?: string;
  slots?: MeetupEditorSlot[];
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
  const [startsAt, setStartsAt] = useState(() =>
    initial?.startsAt
      ? toDatetimeLocalValue(new Date(initial.startsAt))
      : defaultStartsAt(),
  );
  const [endsAt, setEndsAt] = useState(() =>
    initial?.endsAt
      ? toDatetimeLocalValue(new Date(initial.endsAt))
      : defaultEndsAt(),
  );
  const [place, setPlace] = useState(initial?.place || "");
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
  const [status, setStatus] = useState(initial?.status || "OPEN");
  const [slots, setSlots] = useState<MeetupEditorSlot[]>(
    initial?.slots?.length
      ? initial.slots
      : [
          { name: "新手局", maxPeople: 8 },
          { name: "对抗局", maxPeople: 8 },
        ],
  );
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function updateSlot(index: number, patch: Partial<MeetupEditorSlot>) {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
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

      const payload: Record<string, unknown> = {
        title,
        description,
        // 编辑时若未追加新块，保留原 HTML；有新块则覆盖
        contentHtml: mode === "edit" ? contentHtml : "",
        contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
        priceYuan: priceYuan.trim() === "" ? 0 : Number(priceYuan),
        category,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        place,
        maxPeople: Math.max(
          MEETUP_MIN_PEOPLE,
          slots.reduce((n, s) => n + (Number(s.maxPeople) || 0), 0),
        ),
        coverUrl: coverUrl.trim(),
        tags,
        feeIncludes,
        refundPolicy,
        autoRefund,
        gallery,
        contactUrl: contactUrl.trim(),
        slots: slots.map((s) => ({
          id: s.id,
          name: s.name.trim(),
          maxPeople: Number(s.maxPeople) || 4,
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">开始时间</label>
          <input
            className="field min-h-11"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">结束时间</label>
          <input
            className="field min-h-11"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
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
      </div>

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
                { name: `分档${prev.length + 1}`, maxPeople: 8 },
              ]);
            }}
          >
            + 添加分档
          </button>
        </div>
        <ul className="space-y-2">
          {slots.map((slot, index) => (
            <li
              key={slot.id || `new-${index}`}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] p-3"
            >
              <input
                className="field min-h-11 min-w-[8rem] flex-1"
                value={slot.name}
                onChange={(e) => updateSlot(index, { name: e.target.value })}
                required
                maxLength={40}
              />
              <input
                className="field min-h-11 w-28"
                type="number"
                min={1}
                max={MEETUP_MAX_PEOPLE}
                value={slot.maxPeople}
                onChange={(e) =>
                  updateSlot(index, {
                    maxPeople: Number(e.target.value) || 1,
                  })
                }
                required
              />
              <span className="text-xs text-[var(--muted)]">人</span>
              {(slot.joinCount || 0) > 0 ? (
                <span className="text-xs text-[var(--muted)]">
                  已报 {slot.joinCount}
                </span>
              ) : null}
              {slots.length > 1 && !(slot.joinCount && slot.joinCount > 0) ? (
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
            </li>
          ))}
        </ul>
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

      <div>
        <label className="mb-1.5 block text-sm font-medium">联系链接</label>
        <input
          className="field min-h-11"
          value={contactUrl}
          onChange={(e) => setContactUrl(e.target.value)}
          maxLength={500}
        />
      </div>

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
