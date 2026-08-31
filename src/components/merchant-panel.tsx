"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import {
  MERCHANT_JOIN_LABEL,
  MERCHANT_STATUS_LABEL,
} from "@andyyyds/shared/merchants";
import { formatPrice } from "@andyyyds/shared/utils";
import type { MerchantJoinType, MerchantStatus } from "@andyyyds/shared/types";

export type AgentOption = {
  id: string;
  name: string;
  email: string;
};

export type MerchantRow = {
  id: string;
  storeName: string;
  contactName: string;
  contactPhone: string;
  contactWechat: string;
  joinType: string;
  status: string;
  notes: string;
  agentId: string | null;
  agent: AgentOption | null;
  approvedAt: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string; role: string };
  courseCount: number;
  revenue: number;
};

type Counts = Record<MerchantStatus, number>;

type Props = {
  initialMerchants: MerchantRow[];
  initialCounts: Counts;
  agents: AgentOption[];
};

const emptyForm = {
  email: "",
  password: "",
  name: "",
  storeName: "",
  contactName: "",
  contactPhone: "",
  contactWechat: "",
  joinType: "DIRECT" as MerchantJoinType,
  status: "APPROVED" as MerchantStatus,
  notes: "",
  agentId: "",
};

function statusClass(status: string) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "PENDING":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "SUSPENDED":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "REJECTED":
      return "bg-rose-50 text-rose-800 border-rose-200";
    default:
      return "bg-white text-[var(--muted)] border-[var(--line)]";
  }
}

function agentLabel(agent: AgentOption | null | undefined) {
  if (!agent) return "未指定加盟代理";
  return `${agent.name}（${agent.email}）`;
}

export function MerchantPanel({
  initialMerchants,
  initialCounts,
  agents,
}: Props) {
  const router = useRouter();
  const [merchants, setMerchants] = useState(initialMerchants);
  const [counts, setCounts] = useState(initialCounts);
  const [filter, setFilter] = useState<"ALL" | MerchantStatus>("ALL");
  const [q, setQ] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SaveStatus>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    storeName: "",
    name: "",
    contactName: "",
    contactPhone: "",
    contactWechat: "",
    joinType: "DIRECT" as MerchantJoinType,
    notes: "",
    agentId: "",
  });

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return merchants.filter((m) => {
      if (filter !== "ALL" && m.status !== filter) return false;
      if (!keyword) return true;
      return [
        m.storeName,
        m.contactName,
        m.contactPhone,
        m.user.email,
        m.user.name,
        m.notes,
        m.agent?.name,
        m.agent?.email,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [merchants, filter, q]);

  async function createMerchant(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedbackId(null);
    setFeedback(null);
    const result = await postSave("/api/studio/merchants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        agentId: form.agentId || null,
      }),
    });
    setSaving(false);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "创建失败" });
      return;
    }
    const merchant = result.data.merchant as MerchantRow | undefined;
    if (merchant) {
      setMerchants((list) => [merchant, ...list]);
      setCounts((c) => ({
        ...c,
        [merchant.status as MerchantStatus]:
          (c[merchant.status as MerchantStatus] || 0) + 1,
      }));
    }
    setForm(emptyForm);
    setShowForm(false);
    setFeedback({ kind: "ok", text: "商家已添加成功" });
    router.refresh();
  }

  async function patchMerchant(
    id: string,
    payload: Record<string, unknown>,
    successText: string,
  ) {
    setBusyId(id);
    setFeedbackId(id);
    setFeedback(null);
    const result = await postSave(`/api/studio/merchants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusyId(null);
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "操作失败" });
      return;
    }
    const merchant = result.data.merchant as MerchantRow | undefined;
    if (merchant) {
      setMerchants((list) =>
        list.map((m) => (m.id === id ? merchant : m)),
      );
    }
    const refreshed = await postSave("/api/studio/merchants");
    if (refreshed.ok) {
      const body = refreshed.data;
      if (body.counts) setCounts(body.counts as typeof counts);
      if (Array.isArray(body.merchants)) {
        setMerchants(body.merchants as MerchantRow[]);
      }
    }
    setFeedback({ kind: "ok", text: successText });
    setEditingId(null);
    router.refresh();
  }

  function startEdit(m: MerchantRow) {
    setEditingId(m.id);
    setEditDraft({
      storeName: m.storeName,
      name: m.user.name,
      contactName: m.contactName,
      contactPhone: m.contactPhone,
      contactWechat: m.contactWechat,
      joinType: m.joinType as MerchantJoinType,
      notes: m.notes,
      agentId: m.agentId || "",
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {(
          [
            ["ALL", "全部商家", merchants.length],
            ["APPROVED", "已入驻", counts.APPROVED],
            ["PENDING", "待审核", counts.PENDING],
            ["SUSPENDED", "已停用", counts.SUSPENDED],
          ] as const
        ).map(([key, label, value]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`surface min-h-[5.5rem] rounded-[24px] p-4 text-left transition sm:p-5 ${
              filter === key ? "ring-2 ring-[var(--brand)]" : "hover:-translate-y-0.5"
            }`}
          >
            <div className="text-sm text-[var(--muted)]">{label}</div>
            <div className="mt-2 text-2xl font-semibold sm:text-3xl">{value}</div>
          </button>
        ))}
      </div>

      <div className="surface flex flex-col gap-3 rounded-[28px] p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索店铺名、联系人、邮箱、加盟代理…"
          className="w-full min-w-0 flex-1 rounded-full border border-[var(--line)] bg-white/80 px-4 py-3 text-base outline-none focus:border-[var(--brand)] sm:text-sm"
        />
        <button
          type="button"
          className="btn btn-primary w-full sm:w-auto"
          onClick={() => {
            setShowForm((v) => !v);
            setFeedback(null);
            setFeedbackId(null);
          }}
        >
          {showForm ? "取消" : "添加商家"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={createMerchant}
          className="surface space-y-4 rounded-[28px] p-6"
        >
          <div>
            <h2 className="text-lg font-semibold">添加入驻 / 加盟商家</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              可新建账号，或填写已有学员邮箱开通商家权限。可指定发展该商家的加盟代理（分成归属）。
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[var(--muted)]">登录邮箱 *</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">登录密码（新建账号时必填）</span>
              <input
                type="text"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base"
                placeholder="至少 6 位"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">负责人姓名 *</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">店铺 / 品牌名 *</span>
              <input
                required
                value={form.storeName}
                onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">联系人</span>
              <input
                value={form.contactName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactName: e.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">手机号</span>
              <input
                value={form.contactPhone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactPhone: e.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">微信号</span>
              <input
                value={form.contactWechat}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactWechat: e.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">合作类型</span>
              <select
                value={form.joinType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    joinType: e.target.value as MerchantJoinType,
                  }))
                }
                className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base"
              >
                <option value="DIRECT">商家入驻</option>
                <option value="FRANCHISE">加盟合作</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--muted)]">初始状态</span>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as MerchantStatus,
                  }))
                }
                className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base"
              >
                <option value="APPROVED">已入驻（可登录卖课）</option>
                <option value="PENDING">待审核</option>
              </select>
            </label>
            {/* 加盟代理选择：全宽 + 16px 字号，微信内可正常点选 */}
            <label className="block text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">归属加盟代理</span>
              <select
                value={form.agentId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, agentId: e.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base"
              >
                <option value="">不指定（可稍后绑定）</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}（{a.email}）
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">站长备注</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="btn btn-primary w-full sm:w-auto"
              disabled={saving}
            >
              {saving ? "提交中…" : "确认添加"}
            </button>
            {!feedbackId ? <SaveFeedback status={feedback} /> : null}
          </div>
        </form>
      )}

      {!showForm && !feedbackId ? (
        <SaveFeedback status={feedback} />
      ) : null}

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="surface rounded-[28px] p-8 text-center text-[var(--muted)]">
            暂无符合条件的商家
          </div>
        )}
        {filtered.map((m) => (
          <div key={m.id} className="surface rounded-[28px] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold">{m.storeName}</h3>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${statusClass(m.status)}`}
                  >
                    {MERCHANT_STATUS_LABEL[m.status as MerchantStatus] || m.status}
                  </span>
                  <span className="rounded-full border border-[var(--line)] bg-white/70 px-2.5 py-0.5 text-xs text-[var(--muted)]">
                    {MERCHANT_JOIN_LABEL[m.joinType as MerchantJoinType] ||
                      m.joinType}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {m.user.name} · {m.user.email}
                  {m.contactPhone ? ` · ${m.contactPhone}` : ""}
                  {m.contactWechat ? ` · 微信 ${m.contactWechat}` : ""}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  归属代理：{agentLabel(m.agent)}
                </p>
              </div>
              <div className="text-right text-sm text-[var(--muted)]">
                <div>
                  课程 {m.courseCount} · 营收 {formatPrice(m.revenue)}
                </div>
                <div className="mt-1">
                  入驻申请{" "}
                  {new Date(m.createdAt).toLocaleDateString("zh-CN")}
                </div>
              </div>
            </div>

            {m.notes && (
              <p className="mt-3 text-sm text-[var(--muted)]">备注：{m.notes}</p>
            )}

            {editingId === m.id ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input
                  value={editDraft.storeName}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, storeName: e.target.value }))
                  }
                  className="rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm"
                  placeholder="店铺名"
                />
                <input
                  value={editDraft.name}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  className="rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm"
                  placeholder="负责人"
                />
                <input
                  value={editDraft.contactName}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, contactName: e.target.value }))
                  }
                  className="rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm"
                  placeholder="联系人"
                />
                <input
                  value={editDraft.contactPhone}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, contactPhone: e.target.value }))
                  }
                  className="rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm"
                  placeholder="手机号"
                />
                <input
                  value={editDraft.contactWechat}
                  onChange={(e) =>
                    setEditDraft((d) => ({
                      ...d,
                      contactWechat: e.target.value,
                    }))
                  }
                  className="rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm"
                  placeholder="微信"
                />
                <select
                  value={editDraft.joinType}
                  onChange={(e) =>
                    setEditDraft((d) => ({
                      ...d,
                      joinType: e.target.value as MerchantJoinType,
                    }))
                  }
                  className="rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm"
                >
                  <option value="DIRECT">商家入驻</option>
                  <option value="FRANCHISE">加盟合作</option>
                </select>
                <select
                  value={editDraft.agentId}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, agentId: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3 text-base sm:col-span-2"
                >
                  <option value="">不指定加盟代理</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}（{a.email}）
                    </option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={editDraft.notes}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                  className="rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm sm:col-span-2"
                  placeholder="备注"
                />
                <div className="flex w-full flex-col gap-2 sm:col-span-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    className="btn btn-primary w-full sm:w-auto"
                    disabled={busyId === m.id}
                    onClick={() =>
                      void patchMerchant(
                        m.id,
                        {
                          ...editDraft,
                          agentId: editDraft.agentId || null,
                        },
                        "商家资料已保存成功",
                      )
                    }
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary w-full sm:w-auto"
                    onClick={() => setEditingId(null)}
                  >
                    取消
                  </button>
                  {feedbackId === m.id ? (
                    <SaveFeedback status={feedback} />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => startEdit(m)}
                >
                  编辑资料
                </button>
                {m.status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyId === m.id}
                      onClick={() =>
                        void patchMerchant(
                          m.id,
                          { status: "APPROVED" },
                          "已通过入驻成功",
                        )
                      }
                    >
                      通过
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busyId === m.id}
                      onClick={() =>
                        void patchMerchant(
                          m.id,
                          { status: "REJECTED" },
                          "已拒绝成功",
                        )
                      }
                    >
                      拒绝
                    </button>
                  </>
                )}
                {m.status === "APPROVED" && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busyId === m.id}
                    onClick={() =>
                      void patchMerchant(
                        m.id,
                        { status: "SUSPENDED" },
                        "已停用该商家成功",
                      )
                    }
                  >
                    停用
                  </button>
                )}
                {(m.status === "SUSPENDED" || m.status === "REJECTED") && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === m.id}
                    onClick={() =>
                      void patchMerchant(
                        m.id,
                        { status: "APPROVED" },
                        "已重新启用成功",
                      )
                    }
                  >
                    重新启用
                  </button>
                )}
                {feedbackId === m.id ? (
                  <SaveFeedback status={feedback} />
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
