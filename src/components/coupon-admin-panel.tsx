"use client";

/**
 * 优惠券后台：创建 / 列表 / 启停 / 分享。
 * - 券码可手输或一键随机生成
 * - 适用范围：全站 / 指定商品（单选或多选）
 * - 列表行可分享：复制链接 / 微信 / QQ
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CouponShareMenu } from "@/components/coupon-share-menu";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";
import {
  COUPON_PRODUCT_SCOPE_LABEL,
  COUPON_TYPE_LABEL,
  formatCouponBenefit,
  formatCouponProductScope,
  generateCouponCode,
  type CouponProductScope,
  type CouponType,
} from "@/lib/coupons";
import { productTypeLabel } from "@/lib/product-types";
import { formatPrice } from "@/lib/utils";

export type CouponProductOption = {
  id: string;
  title: string;
  slug: string;
  productType: string;
  status: string;
};

export type CouponAdminRow = {
  id: string;
  code: string;
  title: string;
  type: string;
  discountCents: number;
  percentOff: number;
  minAmount: number;
  maxUses: number;
  usedCount: number;
  maxPerUser: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  productScope?: string;
  productIds?: string[];
  productTitles?: string[];
  products?: Array<{
    id: string;
    title: string;
    slug: string;
    productType: string;
  }>;
  createdAt: string;
};

type FormState = {
  code: string;
  title: string;
  type: CouponType;
  discountYuan: string;
  percentOff: string;
  minAmountYuan: string;
  maxUses: string;
  maxPerUser: string;
  startsAt: string;
  expiresAt: string;
  productScope: CouponProductScope;
  productIds: string[];
};

const emptyForm: FormState = {
  code: "",
  title: "",
  type: "FIXED",
  discountYuan: "10",
  percentOff: "10",
  minAmountYuan: "",
  maxUses: "100",
  maxPerUser: "1",
  startsAt: "",
  expiresAt: "",
  productScope: "ALL",
  productIds: [],
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  initialCoupons: CouponAdminRow[];
  /** 可选商品列表（用于适用范围多选） */
  productOptions?: CouponProductOption[];
  /**
   * 在「编辑课程」页嵌入时：默认适用范围=指定商品，并预选当前课程。
   * 列表也优先展示与该课程相关的券。
   */
  defaultProductId?: string;
  /** 嵌入模式标题 */
  embedded?: boolean;
};

export function CouponAdminPanel({
  initialCoupons,
  productOptions = [],
  defaultProductId,
  embedded = false,
}: Props) {
  const router = useRouter();
  const [coupons, setCoupons] = useState(initialCoupons);
  const [form, setForm] = useState<FormState>(() => ({
    ...emptyForm,
    productScope: defaultProductId ? "SELECTED" : "ALL",
    productIds: defaultProductId ? [defaultProductId] : [],
  }));
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<SaveStatus>(null);
  const [productFilter, setProductFilter] = useState("");

  const filteredOptions = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return productOptions;
    return productOptions.filter((p) => p.title.toLowerCase().includes(q));
  }, [productOptions, productFilter]);

  const visibleCoupons = useMemo(() => {
    if (!defaultProductId) return coupons;
    // 编辑课程页：全站券 + 绑定本商品的指定券
    return coupons.filter((c) => {
      const scope = c.productScope || "ALL";
      if (scope === "ALL") return true;
      return (c.productIds || []).includes(defaultProductId);
    });
  }, [coupons, defaultProductId]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleProduct(id: string) {
    setForm((f) => {
      const has = f.productIds.includes(id);
      return {
        ...f,
        productIds: has
          ? f.productIds.filter((x) => x !== id)
          : [...f.productIds, id],
      };
    });
  }

  function randomizeCode() {
    setField("code", generateCouponCode("YYDS"));
  }

  async function createCoupon() {
    setBusy("create");
    setFeedback(null);
    const result = await postSave("/api/studio/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        title: form.title,
        type: form.type,
        discountYuan:
          form.type === "FIXED" ? Number(form.discountYuan) : undefined,
        percentOff:
          form.type === "PERCENT" ? Number(form.percentOff) : undefined,
        minAmountYuan: form.minAmountYuan
          ? Number(form.minAmountYuan)
          : 0,
        maxUses: Number(form.maxUses) || 100,
        maxPerUser: Number(form.maxPerUser) || 1,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
        isActive: true,
        productScope: form.productScope,
        productIds:
          form.productScope === "SELECTED" ? form.productIds : [],
      }),
    });
    setBusy("");
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "创建失败" });
      return;
    }
    const coupon = result.data.coupon as CouponAdminRow | undefined;
    if (coupon) setCoupons((prev) => [coupon, ...prev]);
    setForm({
      ...emptyForm,
      productScope: defaultProductId ? "SELECTED" : "ALL",
      productIds: defaultProductId ? [defaultProductId] : [],
    });
    setFeedback({ kind: "ok", text: "优惠券已创建成功" });
    router.refresh();
  }

  async function toggleActive(row: CouponAdminRow) {
    setBusy(row.id);
    setFeedback(null);
    const result = await postSave(`/api/studio/coupons/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    setBusy("");
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "更新失败" });
      return;
    }
    const coupon = result.data.coupon as CouponAdminRow | undefined;
    if (coupon) {
      setCoupons((prev) =>
        prev.map((c) => (c.id === row.id ? { ...c, ...coupon } : c)),
      );
      setFeedback({
        kind: "ok",
        text: coupon.isActive ? "已启用成功" : "已停用成功",
      });
    }
    router.refresh();
  }

  async function removeCoupon(row: CouponAdminRow) {
    if (!confirm(`确定删除券「${row.code}」？已有订单的券将改为停用。`)) return;
    setBusy(`del-${row.id}`);
    setFeedback(null);
    const result = await postSave(`/api/studio/coupons/${row.id}`, {
      method: "DELETE",
    });
    setBusy("");
    if (!result.ok) {
      setFeedback({ kind: "error", text: result.error || "删除失败" });
      return;
    }
    if (result.data.deactivated) {
      setCoupons((prev) =>
        prev.map((c) => (c.id === row.id ? { ...c, isActive: false } : c)),
      );
      const msg =
        typeof result.data.message === "string"
          ? result.data.message
          : "已停用成功";
      setFeedback({ kind: "ok", text: msg });
    } else {
      setCoupons((prev) => prev.filter((c) => c.id !== row.id));
      setFeedback({ kind: "ok", text: "已删除成功" });
    }
    router.refresh();
  }

  function scopeLabel(row: CouponAdminRow) {
    return formatCouponProductScope({
      productScope: row.productScope,
      productIds: row.productIds,
      productTitles: row.productTitles,
    });
  }

  return (
    <div className="space-y-6">
      <div className="surface space-y-4 rounded-[28px] p-6">
        <div>
          <h2 className="text-lg font-semibold">
            {embedded ? "本商品优惠券" : "创建优惠券"}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            比例折扣填 1–99（如 10 = 减 10%，相当于九折）；定额减免填金额（元）。
            可设全站或指定商品；创建后可分享链接给学员。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">名称</span>
            <input
              className="field mt-2"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="如：新学员立减"
            />
          </label>
          <div className="block text-sm">
            <span className="text-[var(--muted)]">券码</span>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                className="field uppercase sm:min-w-0 sm:flex-1"
                value={form.code}
                onChange={(e) => setField("code", e.target.value.toUpperCase())}
                placeholder="如 YYDS20，或点右侧生成"
              />
              <button
                type="button"
                className="btn btn-secondary min-h-11 shrink-0 px-4 text-sm"
                onClick={randomizeCode}
              >
                随机生成
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["FIXED", "PERCENT"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`min-h-10 rounded-full px-4 py-2.5 text-sm ${
                form.type === t
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] bg-white/70 text-[var(--muted)]"
              }`}
              onClick={() => setField("type", t)}
            >
              {COUPON_TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        {form.type === "FIXED" ? (
          <label className="block text-sm sm:max-w-xs">
            <span className="text-[var(--muted)]">减免金额（元）</span>
            <input
              className="field mt-2"
              type="number"
              min={0.01}
              step={0.01}
              value={form.discountYuan}
              onChange={(e) => setField("discountYuan", e.target.value)}
            />
          </label>
        ) : (
          <label className="block text-sm sm:max-w-xs">
            <span className="text-[var(--muted)]">减免比例 %（1–99）</span>
            <input
              className="field mt-2"
              type="number"
              min={1}
              max={99}
              step={1}
              value={form.percentOff}
              onChange={(e) => setField("percentOff", e.target.value)}
            />
            <span className="mt-1 block text-xs text-[var(--muted)]">
              填 10 = 减 10% ≈ 九折；填 20 = 八折
            </span>
          </label>
        )}

        <div>
          <div className="text-sm text-[var(--muted)]">适用商品</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["ALL", "SELECTED"] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                className={`min-h-10 rounded-full px-4 py-2.5 text-sm ${
                  form.productScope === scope
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--line)] bg-white/70 text-[var(--muted)]"
                }`}
                onClick={() => {
                  setField("productScope", scope);
                  if (
                    scope === "SELECTED" &&
                    defaultProductId &&
                    form.productIds.length === 0
                  ) {
                    setField("productIds", [defaultProductId]);
                  }
                }}
              >
                {COUPON_PRODUCT_SCOPE_LABEL[scope]}
              </button>
            ))}
          </div>
          {form.productScope === "SELECTED" ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-[var(--muted)]">
                勾选一个或多个商品（单选=仅该商品；多选=这些商品可用）。已选{" "}
                {form.productIds.length} 个。
              </p>
              {productOptions.length > 8 ? (
                <input
                  className="field"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  placeholder="筛选商品标题…"
                />
              ) : null}
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-[var(--line)] p-2">
                {filteredOptions.map((p) => {
                  const checked = form.productIds.includes(p.id);
                  return (
                    <li key={p.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/80">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProduct(p.id)}
                          className="h-4 w-4"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          <span className="mr-1.5 text-xs text-[var(--brand)]">
                            {productTypeLabel(p.productType)}
                          </span>
                          {p.title}
                        </span>
                        <span className="shrink-0 text-xs text-[var(--muted)]">
                          {p.status === "PUBLISHED" ? "已上架" : "草稿"}
                        </span>
                      </label>
                    </li>
                  );
                })}
                {filteredOptions.length === 0 ? (
                  <li className="px-2 py-4 text-center text-sm text-[var(--muted)]">
                    暂无可选商品
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">最低消费（元，可选）</span>
            <input
              className="field mt-2"
              type="number"
              min={0}
              step={0.01}
              value={form.minAmountYuan}
              onChange={(e) => setField("minAmountYuan", e.target.value)}
              placeholder="不限制留空"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">总库存</span>
            <input
              className="field mt-2"
              type="number"
              min={1}
              value={form.maxUses}
              onChange={(e) => setField("maxUses", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">每用户限次</span>
            <input
              className="field mt-2"
              type="number"
              min={1}
              max={100}
              value={form.maxPerUser}
              onChange={(e) => setField("maxPerUser", e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">开始时间（可选）</span>
            <input
              className="field mt-2"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setField("startsAt", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">结束时间（可选）</span>
            <input
              className="field mt-2"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setField("expiresAt", e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary w-full sm:w-auto"
            disabled={busy === "create"}
            onClick={() => void createCoupon()}
          >
            {busy === "create" ? "创建中..." : "创建优惠券"}
          </button>
          <SaveFeedback status={feedback} />
        </div>
      </div>

      <div className="surface rounded-[28px] p-4 sm:p-6">
        <h2 className="text-lg font-semibold">
          {embedded ? "相关优惠券" : "优惠券列表"}
        </h2>
        {visibleCoupons.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">暂无优惠券</p>
        ) : (
          <>
            {/* 小屏卡片，避免 min-width 宽表撑出横向滚动 */}
            <div className="mt-4 space-y-3 md:hidden">
              {visibleCoupons.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-[var(--line)] bg-white/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-[var(--brand)]">
                        {c.code}
                      </div>
                      <div className="text-sm text-[var(--muted)]">{c.title}</div>
                    </div>
                    <span
                      className={
                        c.isActive
                          ? "text-sm text-[var(--brand-strong)]"
                          : "text-sm text-[var(--muted)]"
                      }
                    >
                      {c.isActive ? "启用中" : "已停用"}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    {formatCouponBenefit(c)}
                    <span className="text-[var(--muted)]">
                      {" "}
                      · {COUPON_TYPE_LABEL[c.type as CouponType] || c.type}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {scopeLabel(c)}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {c.minAmount > 0
                      ? `满 ${formatPrice(c.minAmount)}`
                      : "无门槛"}{" "}
                    · {c.usedCount}/{c.maxUses} · 每人 {c.maxPerUser} 次
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {c.startsAt || c.expiresAt
                      ? `${toLocalInput(c.startsAt) || "—"} 至 ${toLocalInput(c.expiresAt) || "—"}`
                      : "长期有效"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CouponShareMenu coupon={c} />
                    <button
                      type="button"
                      className="btn btn-secondary min-h-11 flex-1 text-sm"
                      disabled={busy === c.id}
                      onClick={() => toggleActive(c)}
                    >
                      {c.isActive ? "停用" : "启用"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary min-h-11 flex-1 text-sm text-[var(--fire)]"
                      disabled={busy === `del-${c.id}`}
                      onClick={() => removeCoupon(c)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-[var(--muted)]">
                  <tr>
                    <th className="pb-3 font-medium">券码 / 名称</th>
                    <th className="pb-3 font-medium">优惠</th>
                    <th className="pb-3 font-medium">适用范围</th>
                    <th className="pb-3 font-medium">门槛 / 库存</th>
                    <th className="pb-3 font-medium">有效期</th>
                    <th className="pb-3 font-medium">状态</th>
                    <th className="pb-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCoupons.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--line)]">
                      <td className="py-3 align-top">
                        <div className="font-medium text-[var(--brand)]">
                          {c.code}
                        </div>
                        <div className="text-[var(--muted)]">{c.title}</div>
                      </td>
                      <td className="py-3 align-top">
                        <div>{formatCouponBenefit(c)}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {COUPON_TYPE_LABEL[c.type as CouponType] || c.type}
                        </div>
                      </td>
                      <td className="py-3 align-top text-xs text-[var(--muted)]">
                        {scopeLabel(c)}
                      </td>
                      <td className="py-3 align-top">
                        <div>
                          {c.minAmount > 0
                            ? `满 ${formatPrice(c.minAmount)}`
                            : "无门槛"}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {c.usedCount}/{c.maxUses} · 每人 {c.maxPerUser} 次
                        </div>
                      </td>
                      <td className="py-3 align-top text-xs text-[var(--muted)]">
                        {c.startsAt || c.expiresAt ? (
                          <>
                            <div>{toLocalInput(c.startsAt) || "—"}</div>
                            <div>至 {toLocalInput(c.expiresAt) || "—"}</div>
                          </>
                        ) : (
                          "长期有效"
                        )}
                      </td>
                      <td className="py-3 align-top">
                        <span
                          className={
                            c.isActive
                              ? "text-[var(--brand-strong)]"
                              : "text-[var(--muted)]"
                          }
                        >
                          {c.isActive ? "启用中" : "已停用"}
                        </span>
                      </td>
                      <td className="py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          <CouponShareMenu coupon={c} compact />
                          <button
                            type="button"
                            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs hover:border-[var(--brand)]"
                            disabled={busy === c.id}
                            onClick={() => toggleActive(c)}
                          >
                            {c.isActive ? "停用" : "启用"}
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--fire)] hover:border-[var(--fire)]"
                            disabled={busy === `del-${c.id}`}
                            onClick={() => removeCoupon(c)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
