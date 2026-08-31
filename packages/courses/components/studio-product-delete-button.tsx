"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { productTypeLabel } from "@andyyyds/shared/product-types";

type Props = {
  productId: string;
  title: string;
  productType: string;
  /** 列表行内文字链 / 编辑页危险按钮 */
  variant?: "link" | "button";
  /** 删除成功后跳转；默认刷新当前页 */
  redirectTo?: string;
};

/**
 * 站长/商家/代理删除可售商品（单课、专栏、资料）。
 * 老师无删除权限时不渲染此按钮。
 */
export function StudioProductDeleteButton({
  productId,
  title,
  productType,
  variant = "link",
  redirectTo,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const typeLabel = productTypeLabel(productType);

  async function handleDelete() {
    if (busy) return;
    const ok = window.confirm(
      `确定删除「${title}」（${typeLabel}）？\n\n将同时移除报名记录与相关订单，删除后不可恢复。`,
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/studio/courses/${productId}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        window.alert(data.error || "删除失败");
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      window.alert("网络异常，删除失败");
    } finally {
      setBusy(false);
    }
  }

  if (variant === "button") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleDelete()}
        className="min-h-11 w-full rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60 sm:w-auto"
      >
        {busy ? "删除中…" : `删除此${typeLabel}`}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void handleDelete()}
      className="min-h-10 font-medium text-red-700 disabled:opacity-60"
    >
      {busy ? "删除中…" : "删除"}
    </button>
  );
}
