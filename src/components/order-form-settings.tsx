"use client";

import {
  DEFAULT_ORDER_FORM,
  MALL_ORDER_FORM_SAMPLES,
  newOrderFormField,
  type OrderFormConfig,
  type OrderFormField,
  type OrderFormFieldType,
} from "@andyyyds/shared/order-form";

type Props = {
  value: OrderFormConfig;
  onChange: (next: OrderFormConfig) => void;
  /** 嵌入可折叠分区时去掉外层卡片与总标题，避免与分区头重复 */
  embedded?: boolean;
};

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

const TYPE_LABELS: Record<OrderFormFieldType, string> = {
  text: "单行文字",
  textarea: "多行文字",
  select: "下拉选择",
  date: "日期",
};

export function OrderFormSettings({ value, onChange, embedded }: Props) {
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
      ...MALL_ORDER_FORM_SAMPLES,
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

  /** 一键补齐商城常用收货/联系字段（已存在同名则跳过） */
  function addMallDefaults() {
    const used = new Set(config.fields.map((f) => f.label));
    const toAdd = MALL_ORDER_FORM_SAMPLES.filter(
      (s) => s.label && !used.has(s.label),
    ).map((s) => newOrderFormField(s));
    if (toAdd.length === 0) return;
    patch({
      fields: [...config.fields, ...toAdd],
      enabled: true,
    });
  }

  const enabledFieldCount = config.fields.filter((f) => f.enabled !== false).length;

  return (
    <div className={embedded ? "space-y-4" : "surface space-y-4 rounded-[28px] p-6"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {embedded ? (
          <p className="text-sm text-[var(--muted)]">
            用户下单时按你配置的项目填写。每个字段可设「必填 / 选填」与「启用 /
            停用」；停用后不下发到前台，配置仍保留。
          </p>
        ) : (
          <div>
            <h2 className="text-lg font-semibold">下单信息采集</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              类似淘宝确认订单页的收货/联系信息。支持必填与选填；停用字段不展示给用户。
            </p>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.enabled && enabledFieldCount > 0}
            onChange={(e) => patch({ enabled: e.target.checked })}
            disabled={enabledFieldCount === 0}
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
          还没有字段。点击下方「添加字段」或「商城常用字段」开始配置。
        </p>
      ) : (
        <div className="space-y-3">
          {config.fields.map((field, index) => (
            <div
              key={field.id}
              className={`rounded-2xl border border-[var(--line)] p-4 ${
                field.enabled === false ? "bg-black/[0.03] opacity-70" : "bg-white/60"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  字段 {index + 1}
                  {field.enabled === false ? (
                    <span className="ml-2 text-xs text-[var(--muted)]">已停用</span>
                  ) : null}
                </span>
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

                {/* 必填/选填：业务上决定用户能否空着提交 */}
                <fieldset className="sm:col-span-1">
                  <legend className="text-sm text-[var(--muted)]">填写要求</legend>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <label className="flex min-h-11 items-center gap-2">
                      <input
                        type="radio"
                        name={`req-${field.id}`}
                        checked={field.required}
                        onChange={() =>
                          updateField(field.id, { required: true })
                        }
                      />
                      必填
                    </label>
                    <label className="flex min-h-11 items-center gap-2">
                      <input
                        type="radio"
                        name={`req-${field.id}`}
                        checked={!field.required}
                        onChange={() =>
                          updateField(field.id, { required: false })
                        }
                      />
                      选填
                    </label>
                  </div>
                </fieldset>

                <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-1">
                  <input
                    type="checkbox"
                    checked={field.enabled !== false}
                    onChange={(e) =>
                      updateField(field.id, { enabled: e.target.checked })
                    }
                  />
                  启用此字段
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
        <button
          type="button"
          className="rounded-full border border-[var(--brand)] px-4 py-2 text-sm text-[var(--brand)]"
          onClick={addMallDefaults}
        >
          商城常用字段
        </button>
      </div>
    </div>
  );
}
