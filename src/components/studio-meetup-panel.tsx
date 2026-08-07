"use client";

/**
 * 站长约搭管理列表：查看全站、改状态、进编辑、删除。
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

export type StudioMeetupRow = {
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
  hostName: string;
  /** 关联可售壳上的已付订单数；>0 时硬删需二次确认 */
  paidOrderCount: number;
  updatedAt: string;
};

type Props = {
  initialMeetups: StudioMeetupRow[];
};

export function StudioMeetupPanel({ initialMeetups }: Props) {
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
        m.place.toLowerCase().includes(keyword) ||
        m.hostName.toLowerCase().includes(keyword)
      );
    });
  }, [rows, q, statusFilter]);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    setMessage("");
    try {
      const res = await fetch(`/api/studio/meetups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "更新失败");
        return;
      }
      setRows((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: data.status || status } : m,
        ),
      );
      router.refresh();
    } catch {
      setMessage("网络异常");
    } finally {
      setBusyId("");
    }
  }

  async function remove(id: string, title: string, paidOrderCount: number) {
    const tip =
      paidOrderCount > 0
        ? `「${title}」有 ${paidOrderCount} 笔已付订单。建议先点「取消」。仍要硬删除将清除订单与报名，且不可恢复。确定继续？`
        : `确定删除「${title}」？报名记录与关联订单壳将一并清除，且不可恢复。`;
    if (!confirm(tip)) return;

    setBusyId(id);
    setMessage("");
    try {
      let res = await fetch(`/api/studio/meetups/${id}`, { method: "DELETE" });
      let data = await res.json();

      // 服务端发现已付订单时要求 force；再确认一次后强制
      if (res.status === 409 && data.needForce) {
        if (
          !confirm(
            `${data.error || "存在已付订单。"}\n\n确认强制硬删除？`,
          )
        ) {
          setMessage("已取消删除；可先「取消」活动保留履约数据。");
          return;
        }
        res = await fetch(`/api/studio/meetups/${id}?force=1`, {
          method: "DELETE",
        });
        data = await res.json();
      }

      if (!res.ok) {
        setMessage(data.error || "删除失败");
        return;
      }
      setRows((prev) => prev.filter((m) => m.id !== id));
      setMessage(
        data.deletedOrders
          ? `已删除（同时清除 ${data.deletedOrders} 笔关联订单）`
          : "已删除",
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
            placeholder="搜索标题 / 地点 / 发起人"
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
          href="/studio/meetup/new"
          className="btn btn-primary inline-flex min-h-11 items-center justify-center"
        >
          创建约搭
        </Link>
      </div>

      {message ? (
        <p className="text-sm text-[var(--brand-strong)]">{message}</p>
      ) : null}

      <ul className="space-y-3">
        {visible.map((m) => (
          <li
            key={m.id}
            className="surface flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center"
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
                发起人 {m.hostName} ·{" "}
                {m.priceCents > 0 ? formatPrice(m.priceCents) : "免费"} ·{" "}
                {m.joinCount}/{m.maxPeople}人
                {m.slotCount > 0 ? ` · ${m.slotCount} 档` : ""}
                {m.paidOrderCount > 0
                  ? ` · 已付订单 ${m.paidOrderCount}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Link
                href={`/studio/meetup/${m.id}/edit`}
                className="btn btn-secondary min-h-11 px-3 text-sm"
              >
                编辑
              </Link>
              <Link
                href={`/meetup/${m.id}`}
                className="btn btn-secondary min-h-11 px-3 text-sm"
              >
                前台
              </Link>
              {m.status !== "CANCELLED" ? (
                <button
                  type="button"
                  className="btn btn-secondary min-h-11 px-3 text-sm"
                  disabled={busyId === m.id}
                  onClick={() => void setStatus(m.id, "CANCELLED")}
                >
                  取消
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary min-h-11 px-3 text-sm"
                  disabled={busyId === m.id}
                  onClick={() => void setStatus(m.id, "OPEN")}
                >
                  重开
                </button>
              )}
              <button
                type="button"
                className="btn btn-fire min-h-11 px-3 text-sm"
                disabled={busyId === m.id}
                onClick={() =>
                  void remove(m.id, m.title, m.paidOrderCount)
                }
              >
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-12 text-center text-sm text-[var(--muted)]">
          暂无约搭活动
        </div>
      ) : null}
    </div>
  );
}
