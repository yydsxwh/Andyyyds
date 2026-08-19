"use client";

/**
 * 站长用户管理：全部用户 +「角色申请」待审列表（通过 / 拒绝）。
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import {
  ROLE_APPLICATION_STATUS_LABEL,
  ROLE_LABEL,
  ROLES,
  hasRole,
  isElevatedApplyRole,
  normalizeRoles,
  roleLabels,
  type Role,
  type RoleApplicationStatus,
} from "@/lib/roles";

export type AdminInvitee = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  role: string;
  roles?: Role[];
  createdAt: string;
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  /** 全部身份；站长可多选 */
  roles: Role[];
  rolesLabel?: string;
  requestedRole: string;
  roleApplicationStatus: string;
  roleApplicationNote: string;
  roleReviewedAt: string | null;
  referralCode: string;
  /** 上级邀请人（谁邀请他进来） */
  referredById: string;
  referredByName: string;
  referredByCode: string;
  /** 其邀请进来的下级人数 */
  referralCount: number;
  /** 邀请下级明细（最多 100） */
  invitees: AdminInvitee[];
  hasWechat: boolean;
  createdAt: string;
  orderCount: number;
  enrollmentCount: number;
  courseCount: number;
};

type Props = {
  initialUsers: AdminUserRow[];
  initialPending: AdminUserRow[];
};

type Tab = "all" | "applications";

export function UserAdminPanel({ initialUsers, initialPending }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [pending, setPending] = useState(initialPending);
  const [tab, setTab] = useState<Tab>(
    initialPending.length > 0 ? "applications" : "all",
  );
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [busyId, setBusyId] = useState("");
  const [feedback, setFeedback] = useState<SaveStatus>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  /** 编辑中的邀请码草稿（按用户 id） */
  const [referralDraft, setReferralDraft] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return users.filter((u) => {
      if (
        roleFilter !== "ALL" &&
        !hasRole(
          { role: u.role, roles: u.roles?.length ? u.roles : u.role },
          roleFilter as Role,
        )
      ) {
        return false;
      }
      if (!keyword) return true;
      const inviteeHit = (u.invitees || []).some(
        (inv) =>
          inv.name.toLowerCase().includes(keyword) ||
          inv.email.toLowerCase().includes(keyword) ||
          inv.referralCode.toLowerCase().includes(keyword),
      );
      return (
        u.name.toLowerCase().includes(keyword) ||
        u.email.toLowerCase().includes(keyword) ||
        u.referralCode.toLowerCase().includes(keyword) ||
        (u.referredByName || "").toLowerCase().includes(keyword) ||
        (u.referredByCode || "").toLowerCase().includes(keyword) ||
        inviteeHit
      );
    });
  }, [users, q, roleFilter]);

  function upsertUser(next: AdminUserRow) {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === next.id);
      if (idx < 0) return [next, ...prev];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...next };
      return copy;
    });
    setPending((prev) =>
      next.roleApplicationStatus === "PENDING"
        ? prev.some((u) => u.id === next.id)
          ? prev.map((u) => (u.id === next.id ? { ...u, ...next } : u))
          : [...prev, next]
        : prev.filter((u) => u.id !== next.id),
    );
  }

  async function changeRoles(userId: string, nextRoles: Role[]) {
    const list = normalizeRoles(nextRoles);
    if (list.length === 0) {
      setFeedback({ kind: "error", text: "至少保留一种身份" });
      return;
    }
    setBusyId(userId);
    setFeedback(null);
    const result = await postSave("/api/studio/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, roles: list }),
    });
    setBusyId("");
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "修改失败" });
      return;
    }
    const user = result.data.user as {
      role: string;
      roles?: Role[] | string;
      rolesLabel?: string;
      requestedRole?: string;
      roleApplicationStatus?: string;
      roleApplicationNote?: string;
      roleReviewedAt?: string | null;
      referralCode?: string;
    };
    const roles = normalizeRoles({
      role: user.role,
      roles: user.roles ?? list,
    });
    const base =
      users.find((u) => u.id === userId) || pending.find((u) => u.id === userId)!;
    upsertUser({
      ...base,
      role: user.role,
      roles,
      rolesLabel: user.rolesLabel || roleLabels(roles),
      requestedRole: user.requestedRole || "",
      roleApplicationStatus: user.roleApplicationStatus || "NONE",
      roleApplicationNote: user.roleApplicationNote || "",
      roleReviewedAt: user.roleReviewedAt ?? null,
      referralCode:
        user.referralCode ||
        base.referralCode ||
        "",
    });
    setFeedback({ kind: "ok", text: "身份已更新成功" });
    router.refresh();
  }

  async function saveReferralCode(userId: string) {
    const prev =
      users.find((u) => u.id === userId) || pending.find((u) => u.id === userId);
    if (!prev) return;
    const next = (referralDraft[userId] ?? prev.referralCode).trim();
    setBusyId(`ref-${userId}`);
    setFeedback(null);
    const result = await postSave("/api/studio/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, referralCode: next }),
    });
    setBusyId("");
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "邀请码保存失败" });
      return;
    }
    const user = result.data.user as { referralCode?: string } | undefined;
    const code = user?.referralCode || next.toUpperCase();
    upsertUser({ ...prev, referralCode: code });
    setReferralDraft((d) => {
      const copy = { ...d };
      delete copy[userId];
      return copy;
    });
    const msg =
      typeof result.data.message === "string"
        ? result.data.message
        : "邀请码已保存成功";
    setFeedback({ kind: "ok", text: msg });
    router.refresh();
  }

  async function unbindWechat(userId: string) {
    const prev =
      users.find((u) => u.id === userId) || pending.find((u) => u.id === userId);
    if (!prev?.hasWechat) return;
    if (
      !window.confirm(
        `确认解绑「${prev.name}」的微信？解绑后对方可在个人中心重新绑定正确微信。`,
      )
    ) {
      return;
    }
    setBusyId(`wx-${userId}`);
    setFeedback(null);
    const result = await postSave("/api/studio/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, unbindWechat: true }),
    });
    setBusyId("");
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "解绑失败" });
      return;
    }
    upsertUser({ ...prev, hasWechat: false });
    const msg =
      typeof result.data.message === "string"
        ? result.data.message
        : "已解绑微信成功";
    setFeedback({ kind: "ok", text: msg });
    router.refresh();
  }

  async function reviewApplication(
    userId: string,
    applicationAction: "approve" | "reject",
  ) {
    setBusyId(userId);
    setFeedback(null);
    const result = await postSave("/api/studio/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        applicationAction,
        note:
          applicationAction === "reject"
            ? rejectNote[userId]?.trim() || undefined
            : undefined,
      }),
    });
    setBusyId("");
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "操作失败" });
      return;
    }
    const user = result.data.user as {
      role: string;
      roles?: Role[] | string;
      rolesLabel?: string;
      requestedRole?: string;
      roleApplicationStatus?: string;
      roleApplicationNote?: string;
      roleReviewedAt?: string | null;
    };
    const base =
      pending.find((u) => u.id === userId) ||
      users.find((u) => u.id === userId);
    if (base) {
      const roles = normalizeRoles({
        role: user.role,
        roles: user.roles ?? base.roles,
      });
      upsertUser({
        ...base,
        role: user.role,
        roles,
        rolesLabel: user.rolesLabel || roleLabels(roles),
        requestedRole: user.requestedRole || "",
        roleApplicationStatus: user.roleApplicationStatus || "NONE",
        roleApplicationNote: user.roleApplicationNote || "",
        roleReviewedAt: user.roleReviewedAt ?? null,
      });
    }
    const msg =
      typeof result.data.message === "string"
        ? result.data.message
        : "已处理成功";
    setFeedback({ kind: "ok", text: msg });
    router.refresh();
  }

  function statusBadge(status: string) {
    const label =
      ROLE_APPLICATION_STATUS_LABEL[status as RoleApplicationStatus] || status;
    if (status === "PENDING") {
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
          {label}
        </span>
      );
    }
    if (status === "REJECTED") {
      return (
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
          {label}
        </span>
      );
    }
    if (status === "ACTIVE") {
      return (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
          {label}
        </span>
      );
    }
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-sm ${
            tab === "all"
              ? "bg-[var(--brand)] text-white"
              : "border border-[var(--line)] bg-white/70 text-[var(--muted)]"
          }`}
          onClick={() => setTab("all")}
        >
          全部用户
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-sm ${
            tab === "applications"
              ? "bg-[var(--brand)] text-white"
              : "border border-[var(--line)] bg-white/70 text-[var(--muted)]"
          }`}
          onClick={() => setTab("applications")}
        >
          角色申请
          {pending.length > 0 ? (
            <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full bg-white/25 px-1.5 text-xs">
              {pending.length}
            </span>
          ) : null}
        </button>
      </div>

      {tab === "all" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <input
            className="w-full min-w-0 flex-1 rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base outline-none focus:border-[var(--brand)] sm:text-sm"
            placeholder="搜索姓名 / 邮箱 / 邀请码 / 邀请人"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base sm:w-auto sm:text-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">全部角色</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <SaveFeedback status={feedback} />

      {tab === "applications" ? (
        <div className="space-y-3">
          {/* 小屏卡片：避免宽表横向拖动才能审核 */}
          <div className="space-y-3 md:hidden">
            {pending.map((user) => (
              <div
                key={user.id}
                className="surface space-y-3 rounded-[24px] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-[var(--muted)]">{user.email}</div>
                  </div>
                  {statusBadge(user.roleApplicationStatus)}
                </div>
                <div className="text-sm">
                  申请{" "}
                  <span className="font-medium">
                    {isElevatedApplyRole(user.requestedRole)
                      ? ROLE_LABEL[user.requestedRole]
                      : user.requestedRole || "—"}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {new Date(user.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary min-h-11 flex-1 text-sm"
                    disabled={busyId === user.id}
                    onClick={() => void reviewApplication(user.id, "approve")}
                  >
                    通过
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 flex-1 text-sm"
                    disabled={busyId === user.id}
                    onClick={() => void reviewApplication(user.id, "reject")}
                  >
                    拒绝
                  </button>
                </div>
                <input
                  className="field py-2.5 text-base"
                  placeholder="拒绝原因（可选）"
                  value={rejectNote[user.id] || ""}
                  onChange={(e) =>
                    setRejectNote((prev) => ({
                      ...prev,
                      [user.id]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
            {pending.length === 0 ? (
              <div className="surface rounded-[24px] px-4 py-10 text-center text-sm text-[var(--muted)]">
                暂无待审核的角色申请
              </div>
            ) : null}
          </div>

          <div className="surface hidden overflow-hidden rounded-[28px] md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--line)] bg-white/50 text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">申请人</th>
                    <th className="px-4 py-3 font-medium">申请角色</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">注册时间</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-[var(--line)] last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {user.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isElevatedApplyRole(user.requestedRole)
                          ? ROLE_LABEL[user.requestedRole]
                          : user.requestedRole || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {statusBadge(user.roleApplicationStatus)}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {new Date(user.createdAt).toLocaleString("zh-CN")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[220px] flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-primary px-3 py-1.5 text-sm"
                              disabled={busyId === user.id}
                              onClick={() =>
                                void reviewApplication(user.id, "approve")
                              }
                            >
                              通过
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary px-3 py-1.5 text-sm"
                              disabled={busyId === user.id}
                              onClick={() =>
                                void reviewApplication(user.id, "reject")
                              }
                            >
                              拒绝
                            </button>
                          </div>
                          <input
                            className="rounded-xl border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
                            placeholder="拒绝原因（可选）"
                            value={rejectNote[user.id] || ""}
                            onChange={(e) =>
                              setRejectNote((prev) => ({
                                ...prev,
                                [user.id]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pending.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-[var(--muted)]"
                      >
                        暂无待审核的角色申请
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-3 md:hidden">
            {filtered.map((user) => (
              <div
                key={user.id}
                className="surface space-y-3 rounded-[24px] p-4"
              >
                <div>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-[var(--muted)]">{user.email}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>
                    {user.rolesLabel ||
                      roleLabels(user.roles?.length ? user.roles : user.role)}
                  </span>
                  {statusBadge(user.roleApplicationStatus)}
                  <span className="text-xs text-[var(--muted)]">
                    {user.hasWechat ? "微信已绑定" : "微信未绑定"}
                  </span>
                  {user.hasWechat ? (
                    <button
                      type="button"
                      className="btn btn-secondary min-h-9 px-3 text-xs"
                      disabled={busyId === `wx-${user.id}`}
                      onClick={() => void unbindWechat(user.id)}
                    >
                      {busyId === `wx-${user.id}` ? "解绑中…" : "解绑微信"}
                    </button>
                  ) : null}
                </div>
                <div className="space-y-1 text-xs text-[var(--muted)]">
                  <p>
                    被谁邀请：
                    {user.referredByName
                      ? `${user.referredByName}（${user.referredByCode}）`
                      : "无"}
                  </p>
                  <InviteesBlock user={user} />
                </div>
                {user.requestedRole &&
                user.roleApplicationStatus === "PENDING" ? (
                  <p className="text-xs text-[var(--muted)]">
                    申请{" "}
                    {ROLE_LABEL[user.requestedRole as Role] || user.requestedRole}
                  </p>
                ) : null}
                {user.roleApplicationStatus === "REJECTED" &&
                user.roleApplicationNote ? (
                  <p className="text-xs text-[var(--muted)]">
                    {user.roleApplicationNote}
                  </p>
                ) : null}
                <p className="text-xs text-[var(--muted)]">
                  订单 {user.orderCount} · 报名 {user.enrollmentCount} · 课程{" "}
                  {user.courseCount}
                  <span className="mt-1 block">
                    {new Date(user.createdAt).toLocaleString("zh-CN")}
                  </span>
                </p>
                <div>
                  <div className="text-sm text-[var(--muted)]">邀请码</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      className="field min-h-10 min-w-[8rem] flex-1 py-2 text-sm uppercase tracking-wide"
                      value={referralDraft[user.id] ?? user.referralCode}
                      maxLength={16}
                      disabled={busyId === `ref-${user.id}`}
                      placeholder="邀请码"
                      aria-label={`${user.name}的邀请码`}
                      onChange={(e) =>
                        setReferralDraft((d) => ({
                          ...d,
                          [user.id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-secondary min-h-10 shrink-0 px-3 text-sm"
                      disabled={busyId === `ref-${user.id}`}
                      onClick={() => void saveReferralCode(user.id)}
                    >
                      {busyId === `ref-${user.id}` ? "保存中…" : "保存邀请码"}
                    </button>
                  </div>
                </div>
                <RoleMultiEditor
                  user={user}
                  busy={busyId === user.id}
                  onSave={(roles) => void changeRoles(user.id, roles)}
                />
              </div>
            ))}
            {filtered.length === 0 ? (
              <div className="surface rounded-[24px] px-4 py-10 text-center text-sm text-[var(--muted)]">
                没有匹配的用户
              </div>
            ) : null}
          </div>

          <div className="surface hidden overflow-hidden rounded-[28px] md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--line)] bg-white/50 text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">用户</th>
                    <th className="px-4 py-3 font-medium">角色</th>
                    <th className="px-4 py-3 font-medium">被谁邀请</th>
                    <th className="px-4 py-3 font-medium">邀请了谁</th>
                    <th className="px-4 py-3 font-medium">申请</th>
                    <th className="px-4 py-3 font-medium">数据</th>
                    <th className="px-4 py-3 font-medium">微信</th>
                    <th className="px-4 py-3 font-medium">注册时间</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-[var(--line)] last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {user.email}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            className="field min-h-9 min-w-[7rem] max-w-[10rem] py-1.5 text-xs uppercase tracking-wide"
                            value={referralDraft[user.id] ?? user.referralCode}
                            maxLength={16}
                            disabled={busyId === `ref-${user.id}`}
                            placeholder="邀请码"
                            aria-label={`${user.name}的邀请码`}
                            onChange={(e) =>
                              setReferralDraft((d) => ({
                                ...d,
                                [user.id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="btn btn-secondary min-h-9 shrink-0 px-2.5 text-xs"
                            disabled={busyId === `ref-${user.id}`}
                            onClick={() => void saveReferralCode(user.id)}
                          >
                            {busyId === `ref-${user.id}` ? "…" : "保存"}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.rolesLabel ||
                          roleLabels(user.roles?.length ? user.roles : user.role)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--muted)]">
                        {user.referredByName ? (
                          <>
                            <div className="text-[var(--ink)]">
                              {user.referredByName}
                            </div>
                            <div className="text-xs">{user.referredByCode}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[14rem] px-4 py-3 text-sm">
                        <InviteesBlock user={user} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {statusBadge(user.roleApplicationStatus)}
                          {user.requestedRole &&
                          user.roleApplicationStatus === "PENDING" ? (
                            <span className="text-xs text-[var(--muted)]">
                              申请{" "}
                              {ROLE_LABEL[user.requestedRole as Role] ||
                                user.requestedRole}
                            </span>
                          ) : null}
                          {user.roleApplicationStatus === "REJECTED" &&
                          user.roleApplicationNote ? (
                            <span className="text-xs text-[var(--muted)]">
                              {user.roleApplicationNote}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        订单 {user.orderCount} · 报名 {user.enrollmentCount} · 课程{" "}
                        {user.courseCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1.5">
                          <span>{user.hasWechat ? "已绑定" : "未绑定"}</span>
                          {user.hasWechat ? (
                            <button
                              type="button"
                              className="btn btn-secondary min-h-8 px-2.5 text-xs"
                              disabled={busyId === `wx-${user.id}`}
                              onClick={() => void unbindWechat(user.id)}
                            >
                              {busyId === `wx-${user.id}` ? "…" : "解绑"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {new Date(user.createdAt).toLocaleString("zh-CN")}
                      </td>
                      <td className="px-4 py-3">
                        <RoleMultiEditor
                          user={user}
                          busy={busyId === user.id}
                          compact
                          onSave={(roles) => void changeRoles(user.id, roles)}
                        />
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-10 text-center text-[var(--muted)]"
                      >
                        没有匹配的用户
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <p className="text-xs text-[var(--muted)]">
        {tab === "applications"
          ? `待审核 ${pending.length} 人。通过后立即开通对应角色权限；拒绝后保留原身份（注册待审账号仍为普通用户）。`
          : `共 ${filtered.length} 人（最多展示最近 200 人）。「被谁邀请 / 邀请了谁」按注册时的邀请关系展示；点击「查看详情」可打开完整下级列表、统计并导出 Excel。可勾选多种身份（如老师+商家），保存后立即生效。至少保留一位站长。`}
      </p>
    </div>
  );
}


/** 多选身份：勾选后点保存，避免每次勾选都打 API */
function RoleMultiEditor({
  user,
  busy,
  onSave,
  compact = false,
}: {
  user: AdminUserRow;
  busy: boolean;
  onSave: (roles: Role[]) => void;
  compact?: boolean;
}) {
  const initial = normalizeRoles(
    user.roles?.length ? user.roles : user.role,
  );
  const [draft, setDraft] = useState<Role[]>(initial);
  const [dirty, setDirty] = useState(false);

  // 外部列表刷新后同步勾选（例如审核通过）
  const key = `${user.id}:${initial.join(",")}`;
  useEffect(() => {
    setDraft(initial);
    setDirty(false);
    // key 已编码 userId + 角色列表；避免 initial 数组引用导致循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function toggle(role: Role) {
    setDraft((prev) => {
      const has = prev.includes(role);
      const next = has ? prev.filter((r) => r !== role) : [...prev, role];
      return normalizeRoles(next.length ? next : ["STUDENT"]);
    });
    setDirty(true);
  }

  return (
    <div className={compact ? "min-w-[11rem] space-y-2" : "space-y-2"}>
      {!compact ? (
        <div className="text-sm text-[var(--muted)]">调整身份（可多选）</div>
      ) : null}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {ROLES.map((role) => (
          <label
            key={role}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-sm"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--brand)]"
              checked={draft.includes(role)}
              disabled={busy}
              onChange={() => toggle(role)}
            />
            <span>{ROLE_LABEL[role]}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className={
          compact
            ? "btn btn-primary min-h-8 px-2.5 text-xs"
            : "btn btn-primary min-h-10 w-full text-sm sm:w-auto"
        }
        disabled={busy || !dirty}
        onClick={() => {
          onSave(draft);
          setDirty(false);
        }}
      >
        {busy ? "保存中…" : "保存身份"}
      </button>
    </div>
  );
}

/** 邀请下级：预览 + 进入独立页（完整列表 / 统计 / 导出） */
function InviteesBlock({ user }: { user: AdminUserRow }) {
  const count = user.referralCount ?? user.invitees?.length ?? 0;
  const list = user.invitees || [];
  if (count <= 0) {
    return <span className="text-[var(--muted)]">暂无下级</span>;
  }

  const preview = list
    .slice(0, 3)
    .map((inv) => inv.name)
    .join("、");

  return (
    <div>
      <Link
        href={`/studio/users/${user.id}/invitees`}
        className="inline-flex min-h-9 items-center text-sm text-[var(--brand)] underline-offset-2 hover:underline"
      >
        查看详情 · 已邀请 {count} 人
      </Link>
      {preview ? (
        <p className="mt-1 text-xs text-[var(--muted)]">
          {preview}
          {count > 3 || list.length > 3 ? " 等" : ""}
        </p>
      ) : null}
    </div>
  );
}
