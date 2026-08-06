"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OrderFormSettings } from "@/components/order-form-settings";
import { StudioNavSettings } from "@/components/studio-nav-settings";
import { DEFAULT_ORDER_FORM, type OrderFormConfig } from "@/lib/order-form";
import {
  DEFAULT_STUDIO_NAV,
  type StudioNavConfig,
} from "@/lib/studio-nav-config";
import { DEFAULT_UI_COPY, type ComposeUiCopy } from "@/lib/ui-copy";

type Props = {
  initial: {
    uiCopy: { compose: ComposeUiCopy };
    orderForm: OrderFormConfig;
    studioNav: StudioNavConfig;
  };
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

export function CmsPanel({ initial }: Props) {
  const router = useRouter();
  const [uiCopy, setUiCopy] = useState(() => ({
    compose: {
      ...DEFAULT_UI_COPY.compose,
      ...(initial.uiCopy?.compose || {}),
    },
  }));
  const [orderForm, setOrderForm] = useState(() => ({
    ...DEFAULT_ORDER_FORM,
    ...(initial.orderForm || {}),
    fields: initial.orderForm?.fields || [],
  }));
  const [studioNav, setStudioNav] = useState<StudioNavConfig>(() => ({
    topBase: initial.studioNav?.topBase?.length
      ? initial.studioNav.topBase
      : DEFAULT_STUDIO_NAV.topBase,
    topAdmin: initial.studioNav?.topAdmin?.length
      ? initial.studioNav.topAdmin
      : DEFAULT_STUDIO_NAV.topAdmin,
    courses: initial.studioNav?.courses?.length
      ? initial.studioNav.courses
      : DEFAULT_STUDIO_NAV.courses,
  }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function setComposeCopy<K extends keyof ComposeUiCopy>(
    key: K,
    value: ComposeUiCopy[K],
  ) {
    setUiCopy((prev) => ({
      compose: { ...prev.compose, [key]: value },
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/studio/cms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uiCopy, orderForm, studioNav }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error || "保存失败");
      return;
    }
    if (data.uiCopy) setUiCopy(data.uiCopy);
    if (data.orderForm) setOrderForm(data.orderForm);
    if (data.studioNav) setStudioNav(data.studioNav);
    setMessage("内容配置已保存");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <StudioNavSettings value={studioNav} onChange={setStudioNav} />

      <OrderFormSettings value={orderForm} onChange={setOrderForm} />

      <div className="surface space-y-4 rounded-[28px] p-6">
        <div>
          <h2 className="text-lg font-semibold">文案配置</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            后台表单提示文字，例如「售价（元）」。这是内容/文案管理，不是店铺视觉装修。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["priceLabel", "售价字段标签"],
              ["pricePlaceholder", "售价输入框提示"],
              ["priceHint", "售价下方说明"],
              ["titleLabel", "标题标签"],
              ["titlePlaceholderCourse", "单课标题提示"],
              ["titlePlaceholderColumn", "专栏标题提示"],
              ["subtitleLabel", "卖点标签"],
              ["subtitlePlaceholder", "卖点提示"],
              ["descriptionLabel", "介绍标签"],
              ["descriptionPlaceholder", "介绍提示"],
              ["step2Title", "第二步标题"],
              ["courseTypeLabel", "单课按钮文字"],
              ["columnTypeLabel", "专栏按钮文字"],
              ["groupByCategoryLabel", "自动分章文案"],
              ["publishLabel", "立即上架文案"],
              ["submitLabelCourse", "生成课程按钮"],
              ["submitLabelColumn", "生成专栏按钮"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                className={inputClass}
                value={uiCopy.compose[key]}
                onChange={(e) => setComposeCopy(key, e.target.value)}
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "保存中…" : "保存内容配置"}
        </button>
        {message ? (
          <span className="text-sm text-[var(--brand-strong)]">{message}</span>
        ) : null}
      </div>
    </form>
  );
}
