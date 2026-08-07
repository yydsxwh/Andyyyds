"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MEETUP_CATEGORIES,
  MEETUP_MAX_PEOPLE,
  MEETUP_MIN_PEOPLE,
} from "@/lib/meetup";

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 默认建议时间：明天同一时刻，降低「立刻开局」误填 */
function defaultStartsAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setMinutes(0, 0, 0);
  return toDatetimeLocalValue(d);
}

export function MeetupCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("SPORT");
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [place, setPlace] = useState("");
  const [maxPeople, setMaxPeople] = useState(4);
  const [coverUrl, setCoverUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/meetup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          // datetime-local 无时区；按本地时间解析后交给服务端 ISO
          startsAt: new Date(startsAt).toISOString(),
          place,
          maxPeople,
          coverUrl: coverUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "发起失败");
        return;
      }
      router.push(`/meetup/${data.meetup.id}`);
      router.refresh();
    } catch {
      setMessage("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="surface mx-auto max-w-xl space-y-5 rounded-[32px] p-5 sm:p-8">
      <div>
        <label className="mb-1.5 block text-sm font-medium">标题</label>
        <input
          className="field min-h-11"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：周末羽毛球双打搭子"
          required
          maxLength={80}
        />
      </div>

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
        <label className="mb-1.5 block text-sm font-medium">地点</label>
        <input
          className="field min-h-11"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="城市 + 具体地点，例如：杭州·黄龙体育中心"
          required
          maxLength={120}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          人数上限（含你自己）
        </label>
        <input
          className="field min-h-11"
          type="number"
          min={MEETUP_MIN_PEOPLE}
          max={MEETUP_MAX_PEOPLE}
          value={maxPeople}
          onChange={(e) => setMaxPeople(Number(e.target.value) || MEETUP_MIN_PEOPLE)}
          required
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">简介</label>
        <textarea
          className="field min-h-28"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="活动说明、费用分摊、集合方式等（选填）"
          maxLength={2000}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">封面图链接（选填）</label>
        <input
          className="field min-h-11"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://… 或 /uploads/…"
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
        {loading ? "发布中…" : "发布约搭"}
      </button>
    </form>
  );
}
