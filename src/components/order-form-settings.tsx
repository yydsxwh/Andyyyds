"use client";

import {
  DEFAULT_ORDER_FORM,
  newOrderFormField,
  type OrderFormConfig,
  type OrderFormField,
  type OrderFormFieldType,
} from "@/lib/order-form";

type Props = {
  value: OrderFormConfig;
  onChange: (next: OrderFormConfig) => void;
};

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

const TYPE_LABELS: Record<OrderFormFieldType, string> = {
  text: "单行文字",
  textarea: "多行文字",
  select: "下拉选择",
  date: "日期",
};

export function OrderFormSettings({ value, onChange }: Props) {
  const config = {
    ...DEFAULT_ORDER_FORM,
    ...value,
    fields: value.fields || [],
  };

  function patch(partial: Partial<OrderFormConfig>) {
    onChange({ ...config, ...partial });
  }

  function updateField(id: string, partial: Partial<OrderFormField>) {
    patch({
      fields: config.fields.map((f) =>
        f.id === id ? { ...f, ...partial } : f,
      ),
    });
  }

  function removeField(id: string) {
    const fields = config.fields.filter((f) => f.id !== id);
    patch({
      fields,
      enabled: fields.length === 0 ? false : config.enabled,
    });
  }

  function moveField(id: string, dir: -1 | 1) {
    const index = config.fields.findIndex((f) => f.id === id);
    const next = index + dir;
    if (index < 0 || next < 0 || next >= config.fields.length) return;
    const fields = [...config.fields];
    const [item] = fields.splice(index, 1);
    fields.splice(next, 0, item);
    patch({ fields });
  }

  function addField(type: OrderFormFieldType = "text") {
    const samples: Partial<OrderFormField>[] = [
      { label: "所在学校", placeholder: "请输入所在学校", type: "text" },
      { label: "送货编码", placeholder: "请输入送货编码", type: "text" },
      { label: "QQ号码", placeholder: "请输入QQ号码", type: "text" },
    ];
    const used = new Set(config.fields.map((f) => f.label));
    const sample = samples.find((s) => s.label && !used.has(s.label));
    const field = newOrderFormField({
      type,
      ...(sample || { label: `自定义字段${config.fields.length + 1}` }),
    });
    patch({
      fields: [...config.fields, field],
      enabled: true,
    });
  }

  return (
    <div className="surface space-y-4 rounded-[28px] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">下单信息采集</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            类似微盟确认订单页的「所在学校 / 送货编码」等字段。用户下单时按你配置的项目填写。
            这是交易表单配置，不是店铺装修。
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.enabled && config.fields.length > 0}
            onChange={(e) => patch({ enabled: e.target.checked })}
            disabled={config.fields.length === 0}
          />
          启用采集
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-[var(--muted)]">区块标题</span>
        <input
          className={`${inputClass} mt-1`}
          value={config.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="请填写购买信息"
        />
      </label>

      {config.fields.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          还没有字段。点击下方「添加字段」开始配置。
        </p>
      ) : (
        <div className="space-y-3">
          {config.fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-2xl border border-[var(--line)] bg-white/60 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">字段 {index + 1}</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-xs"
                    onClick={() => moveField(field.id, -1)}
                    disabled={index === 0}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-xs"
                    onClick={() => moveField(field.id, 1)}
                    disabled={index === config.fields.length - 1}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-700"
                    onClick={() => removeField(field.id)}
                  >
                    删除
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">显示名称</span>
                  <input
                    className={`${inputClass} mt-1`}
                    value={field.label}
                    onChange={(e) =>
                      updateField(field.id, { label: e.target.value })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">类型</span>
                  <select
                    className={`${inputClass} mt-1`}
                    value={field.type}
                    onChange={(e) =>
                      updateField(field.id, {
                        type: e.target.value as OrderFormFieldType,
                      })
                    }
                  >
                    {(Object.keys(TYPE_LABELS) as OrderFormFieldType[]).map(
                      (t) => (
                        <option key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-[var(--muted)]">提示文字</span>
                  <input
                    className={`${inputClass} mt-1`}
                    value={field.placeholder}
                    onChange={(e) =>
                      updateField(field.id, { placeholder: e.target.value })
                    }
                  />
                </label>
                {field.type === "select" ? (
                  <label className="block text-sm sm:col-span-2">
                    <span className="text-[var(--muted)]">
                      选项（每行一个）
                    </span>
                    <textarea
                      className={`${inputClass} mt-1`}
                      rows={3}
                      value={field.options.join("\n")}
                      onChange={(e) =>
                        updateField(field.id, {
                          options: e.target.value
                            .split("\n")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder={"选项A\n选项B"}
                    />
                  </label>
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) =>
                      updateField(field.id, { required: e.target.checked })
                    }
                  />
                  必填
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => addField("text")}
        >
          添加字段
        </button>
        <button
          type="button"
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
          onClick={() => addField("select")}
        >
          添加下拉
        </button>
        <button
          type="button"
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
          onClick={() => addField("date")}
        >
          添加日期
        </button>
      </div>
    </div>
  );
}
