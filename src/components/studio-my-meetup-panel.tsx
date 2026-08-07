"use client";

/**
 * 创作者「我的约搭」：只管理自己发起的活动。
 * 为何不用站长 /api/studio/meetups：那是全站硬删入口；发起人改状态/取消走公开 /api/meetup/[id]。
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatMeetupWhen,
  meetupCategoryLabel,
  meetupStatusLabel,
} from "@/lib/meetup";
import { formatPrice } from "@/lib/utils";

export type MyMeetupRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  priceCents: number;
  place: string;
  startsAt: string;
  maxPeople: number;
  joinCount: number;
  slotCount: number;
  coverUrl: string;
  updatedAt: string;
};

type Props = {
  initialMeetups: MyMeetupRow[];
};

export function StudioMyMeetupPanel({ initialMeetups }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialMeetups);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const visible = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return rows.filter((m) => {
      if (statusFilter !== "ALL" && m.status !== statusFilter) return false;
      if (!keyword) return true;
      return (
        m.title.toLowerCase().includes(keyword) ||
        m.place.toLowerCase().includes(keyword)
      );
    });
  }, [rows, q, statusFilter]);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    setMessage("");
    try {
      // 发起人权限走公开 API，与前台详情「取消/重开」一致
      const res = await fetch(`/api/meetup/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "更新失败");
        return;
      }
      const nextStatus = data.meetup?.status || status;
      setRows((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: nextStatus } : m)),
      );
      router.refresh();
    } catch {
      setMessage("网络异常");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <input
            className="field min-h-11 max-w-xs"
            placeholder="搜索标题 / 地点"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="field min-h-11 w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">全部状态</option>
            <option value="OPEN">招募中</option>
            <option value="FULL">已满员</option>
            <option value="CLOSED">已截止</option>
            <option value="CANCELLED">已取消</option>
          </select>
        </div>
        <Link
          href="/meetup/new"
          className="btn btn-primary inline-flex min-h-11 items-center justify-center"
        >
          发起约搭
        </Link>
      </div>

      {message ? (
        <p className="text-sm text-[var(--brand-strong)]">{message}</p>
      ) : null}

      <ul className="space-y-3">
        {visible.map((m) => (
          <li
            key={m.id}
            className="flex flex-col gap-3 rounded-2xl bg-white/60 p-4 sm:flex-row sm:items-center"
          >
            {m.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.coverUrl}
                alt=""
                className="h-20 w-28 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-xs text-[var(--brand)]">
                {meetupCategoryLabel(m.category)}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/meetup/${m.id}`}
                  className="font-semibold hover:text-[var(--brand)]"
                >
                  {m.title}
                </Link>
                <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--muted)]">
                  {meetupStatusLabel(m.status)}
                </span>
              </div>
              <p className="text-sm text-[var(--muted)]">
                {formatMeetupWhen(new Date(m.startsAt))} · {m.place}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {m.priceCents > 0 ? formatPrice(m.priceCents) : "免费"} · 报名{" "}
                {m.joinCount}/{m.maxPeople}
                {m.slotCount > 0 ? ` · ${m.slotCount} 档` : ""}
              </p>
            </div>
            {/* 活动语义操作：前台 / 编辑活动 / 管理报名状态；不用课程章节入口 */}
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Link
                href={`/meetup/${m.id}`}
                className="btn btn-secondary min-h-11 px-3 text-sm"
              >
                查看前台
              </Link>
              <Link
                href={`/meetup/${m.id}/edit`}
                className="btn btn-secondary min-h-11 px-3 text-sm"
              >
                编辑活动
              </Link>
              {m.status !== "CANCELLED" && m.status !== "CLOSED" ? (
                <button
                  type="button"
                  className="btn btn-secondary min-h-11 px-3 text-sm"
                  disabled={busyId === m.id}
                  onClick={() => void setStatus(m.id, "CLOSED")}
                >
                  截止报名
                </button>
              ) : null}
              {m.status !== "CANCELLED" ? (
                <button
                  type="button"
                  className="btn btn-secondary min-h-11 px-3 text-sm"
                  disabled={busyId === m.id}
                  onClick={() => void setStatus(m.id, "CANCELLED")}
                >
                  取消活动
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary min-h-11 px-3 text-sm"
                  disabled={busyId === m.id}
                  onClick={() => void setStatus(m.id, "OPEN")}
                >
                  重新开放
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-12 text-center text-sm text-[var(--muted)]">
          {rows.length === 0 ? (
            <>
              还没有发起约搭。去{" "}
              <Link href="/meetup/new" className="text-[var(--brand)]">
                发起约搭
              </Link>{" "}
              开第一局吧。
            </>
          ) : (
            "没有符合筛选的活动"
          )}
        </div>
      ) : null}
    </div>
  );
}
