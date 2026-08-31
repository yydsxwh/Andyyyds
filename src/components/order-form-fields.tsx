"use client";

import type { OrderFormAnswers, OrderFormConfig } from "@andyyyds/shared/order-form";
import { activeOrderFormFields } from "@andyyyds/shared/order-form";

type Props = {
  config: OrderFormConfig;
  values: OrderFormAnswers;
  onChange: (values: OrderFormAnswers) => void;
  disabled?: boolean;
};

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

export function OrderFormFields({ config, values, onChange, disabled }: Props) {
  const fields = activeOrderFormFields(config);
  if (fields.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{config.title || "请填写购买信息"}</div>
      {fields.map((field) => {
        const value = values[field.id] || "";
        const setValue = (next: string) =>
          onChange({ ...values, [field.id]: next });

        return (
          <label key={field.id} className="block text-sm">
            <span className="text-[var(--muted)]">
              {field.label}
              {field.required ? (
                <span className="ml-0.5 text-red-600">*</span>
              ) : (
                <span className="ml-1 text-xs">选填</span>
              )}
            </span>
            <div className="mt-1">
              {field.type === "textarea" ? (
                <textarea
                  className={inputClass}
                  rows={3}
                  disabled={disabled}
                  placeholder={field.placeholder || "请输入"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              ) : field.type === "select" ? (
                <select
                  className={inputClass}
                  disabled={disabled}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                >
                  <option value="">
                    {field.placeholder || "请选择"}
                  </option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={inputClass}
                  type={field.type === "date" ? "date" : "text"}
                  disabled={disabled}
                  placeholder={
                    field.type === "date"
                      ? undefined
                      : field.placeholder || "请输入"
                  }
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
