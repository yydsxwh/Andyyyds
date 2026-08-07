"use client";

/**
 * 个人中心：申请成为加盟代理 / 商家入驻 / 成为老师。
 * 提交后走站长审核（role-applications）；不可申请已有角色或 ADMIN。
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ACCOUNT_APPLY_LABEL,
  ACCOUNT_APPLY_SUCCESS_MESSAGE,
} from "@/lib/role-applications";
import {
  ROLE_APPLICATION_STATUS_LABEL,
  ROLE_HINT,
  ROLE_LABEL,
  type ElevatedApplyRole,
  type RoleApplicationStatus,
} from "@/lib/roles";

type Props = {
  availableRoles: ElevatedApplyRole[];
  applicationStatus: string;
  requestedRole: string;
  applicationNote: string;
};

export function RoleApplyPanel({
  availableRoles,
  applicationStatus,
  requestedRole,
  applicationNote,
}: Props) {
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<ElevatedApplyRole | null>(
    null,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const statusLabel =
    ROLE_APPLICATION_STATUS_LABEL[
      applicationStatus as RoleApplicationStatus
    ] || applicationStatus;
  const requestedLabel = requestedRole
    ? ROLE_LABEL[requestedRole as ElevatedApplyRole] || requestedRole
    : "";

  async function apply(role: ElevatedApplyRole) {
    setLoadingRole(role);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/account/role-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedRole: role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "提交失败");
        return;
      }
      setNotice(data.message || ACCOUNT_APPLY_SUCCESS_MESSAGE);
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoadingRole(null);
    }
  }

  const isPending = applicationStatus === "PENDING";
  const isRejected = applicationStatus === "REJECTED";
  const isActive = applicationStatus === "ACTIVE";

  return (
    <section className="surface rounded-[28px] p-5 sm:p-6">
      <h2 className="text-lg font-semibold">身份申请</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        可申请加盟代理、商家入驻或成为老师。提交后由站长审核，通过前保留当前身份权限。
      </p>

      {isPending ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
          <p className="text-sm font-medium text-amber-950">
            状态：{statusLabel}
            {requestedLabel ? ` · 申请「${requestedLabel}」` : ""}
          </p>
          <p className="mt-1 text-sm text-amber-900/80">
            请耐心等待站长审核。审核期间可继续学习与消费。
          </p>
        </div>
      ) : null}

      {isRejected ? (
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3">
          <p className="text-sm font-medium">状态：已拒绝</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {applicationNote || "站长未通过你的申请，可修改后再次提交。"}
          </p>
        </div>
      ) : null}

      {isActive && requestedRole ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <p className="text-sm font-medium text-emerald-950">
            状态：已通过 · 当前相关申请角色「{requestedLabel}」
          </p>
        </div>
      ) : null}

      {availableRoles.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {availableRoles.map((role) => (
            <div
              key={role}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="font-medium">{ACCOUNT_APPLY_LABEL[role]}</div>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {ROLE_HINT[role]} · 提交后待站长审核
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary min-h-11 shrink-0 px-4"
                disabled={loadingRole !== null}
                onClick={() => apply(role)}
              >
                {loadingRole === role ? "提交中…" : ACCOUNT_APPLY_LABEL[role]}
              </button>
            </div>
          ))}
        </div>
      ) : !isPending ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          当前身份暂无可升级申请，或你已拥有全部可申请角色。
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {notice ? (
        <p className="mt-3 text-sm text-[var(--brand-strong)]">{notice}</p>
      ) : null}
    </section>
  );
}
