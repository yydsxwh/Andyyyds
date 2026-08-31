"use client";

/**
 * 站长查看某用户的邀请下级：统计卡片 + 筛选表格 + 导出 CSV/Excel。
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { ROLE_LABEL, type Role } from "@andyyyds/shared/roles";

export type InviteeRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  referralCode: string;
  createdAt: string;
  orderCount: number;
  enrollmentCount: number;
  paidOrderCount: number;
};

export type InviteeStats = {
  total: number;
  byRole: Record<string, number>;
  withPaidOrders: number;
  withEnrollments: number;
  totalPaidOrders: number;
  totalEnrollments: number;
};

type Props = {
  inviter: {
    id: string;
    name: string;
    email: string;
    referralCode: string;
    role: string;
  };
  invitees: InviteeRow[];
  stats: InviteeStats;
};

export function InviteesAdminPanel({ inviter, invitees, stats }: Props) {
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return invitees.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!keyword) return true;
      return (
        u.name.toLowerCase().includes(keyword) ||
        u.email.toLowerCase().includes(keyword) ||
        u.phone.includes(keyword) ||
        u.referralCode.toLowerCase().includes(keyword)
      );
    });
  }, [invitees, roleFilter, q]);

  const roleEntries = Object.entries(stats.byRole).sort(
    (a, b) => b[1] - a[1],
  );

  const exportBase = `/api/studio/users/${inviter.id}/invitees`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/studio/users"
            className="text-sm text-[var(--brand)] hover:underline"
          >
            ← 返回用户管理
          </Link>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
            {inviter.name} 的邀请下级
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {ROLE_LABEL[inviter.role as Role] || inviter.role}
            {" · "}
            邀请码 {inviter.referralCode}
            {" · "}
            {inviter.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="btn btn-secondary min-h-11 px-4"
            href={`${exportBase}?format=csv`}
          >
            导出 CSV
          </a>
          <a
            className="btn btn-primary min-h-11 px-4"
            href={`${exportBase}?format=xls`}
          >
            导出 Excel
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="邀请总人数" value={String(stats.total)} />
        <StatCard
          label="有已支付订单"
          value={`${stats.withPaidOrders} 人`}
          hint={`合计 ${stats.totalPaidOrders} 笔已支付`}
        />
        <StatCard
          label="有报名"
          value={`${stats.withEnrollments} 人`}
          hint={`合计 ${stats.totalEnrollments} 次报名`}
        />
        <StatCard
          label="角色分布"
          value={
            roleEntries.length
              ? roleEntries
                  .map(
                    ([role, n]) =>
                      `${ROLE_LABEL[role as Role] || role} ${n}`,
                  )
                  .join(" · ")
              : "—"
          }
          compact
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="field min-h-11 flex-1"
          placeholder="搜索姓名 / 邮箱 / 手机 / 邀请码"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="field min-h-11 sm:w-44"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="ALL">全部角色</option>
          {roleEntries.map(([role]) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role as Role] || role}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-[var(--muted)]">
        当前显示 {filtered.length} / {stats.total} 人
      </p>

      {/* 手机卡片 */}
      <div className="space-y-3 md:hidden">
        {filtered.map((u) => (
          <div key={u.id} className="surface space-y-2 rounded-[24px] p-4">
            <div className="font-medium">{u.name}</div>
            <div className="text-xs text-[var(--muted)]">{u.email}</div>
            {u.phone ? (
              <div className="text-xs text-[var(--muted)]">{u.phone}</div>
            ) : null}
            <div className="text-sm">
              {ROLE_LABEL[u.role as Role] || u.role} · {u.referralCode}
            </div>
            <div className="text-xs text-[var(--muted)]">
              订单 {u.orderCount}（已付 {u.paidOrderCount}）· 报名{" "}
              {u.enrollmentCount}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {new Date(u.createdAt).toLocaleString("zh-CN")}
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="surface rounded-[24px] px-4 py-10 text-center text-sm text-[var(--muted)]">
            没有匹配的下级
          </div>
        ) : null}
      </div>

      {/* 桌面表格 */}
      <div className="surface hidden overflow-hidden rounded-[28px] md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-white/50 text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">姓名</th>
                <th className="px-4 py-3 font-medium">联系方式</th>
                <th className="px-4 py-3 font-medium">角色</th>
                <th className="px-4 py-3 font-medium">邀请码</th>
                <th className="px-4 py-3 font-medium">订单 / 报名</th>
                <th className="px-4 py-3 font-medium">注册时间</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[var(--line)] last:border-b-0"
                >
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    <div>{u.email}</div>
                    {u.phone ? (
                      <div className="text-xs">{u.phone}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {ROLE_LABEL[u.role as Role] || u.role}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {u.referralCode}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    订单 {u.orderCount}（已付 {u.paidOrderCount}）
                    <br />
                    报名 {u.enrollmentCount}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {new Date(u.createdAt).toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-[var(--muted)]"
                  >
                    没有匹配的下级
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  compact,
}: {
  label: string;
  value: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div
        className={`mt-1 font-semibold text-[var(--ink)] ${
          compact ? "text-sm leading-snug" : "text-xl"
        }`}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div>
      ) : null}
    </div>
  );
}
