export type OrderFormFieldType = "text" | "textarea" | "select" | "date";

export type OrderFormField = {
  id: string;
  label: string;
  placeholder: string;
  type: OrderFormFieldType;
  /** true=必填；false=选填。站长可在 CMS 配置 */
  required: boolean;
  /**
   * 启用/停用：停用字段不下发到用户下单页，但配置保留便于再开。
   * 缺省 true，兼容旧配置。
   */
  enabled: boolean;
  /** select 选项，每行一个 */
  options: string[];
};

export type OrderFormConfig = {
  enabled: boolean;
  title: string;
  fields: OrderFormField[];
};

/** 下单时提交的答案：fieldId -> 填写值 */
export type OrderFormAnswers = Record<string, string>;

export type StoredOrderFormAnswers = {
  values: OrderFormAnswers;
  /** 提交时字段标签快照，便于后台查看 */
  labels: Record<string, string>;
};

export const DEFAULT_ORDER_FORM: OrderFormConfig = {
  enabled: false,
  title: "请填写购买信息",
  fields: [],
};

/** 商城常用采集模板（站长一键添加） */
export const MALL_ORDER_FORM_SAMPLES: Partial<OrderFormField>[] = [
  { label: "收货人姓名", placeholder: "请输入姓名", type: "text", required: true },
  { label: "手机号", placeholder: "请输入手机号", type: "text", required: true },
  {
    label: "收货地址",
    placeholder: "省市区 + 详细地址",
    type: "textarea",
    required: true,
  },
  { label: "微信号", placeholder: "选填", type: "text", required: false },
  { label: "备注", placeholder: "选填，如配送说明", type: "textarea", required: false },
];

export function newOrderFormField(
  partial?: Partial<OrderFormField>,
): OrderFormField {
  return {
    id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    label: "新字段",
    placeholder: "请输入",
    type: "text",
    required: true,
    enabled: true,
    options: [],
    ...partial,
  };
}

export function parseOrderForm(raw: string | null | undefined): OrderFormConfig {
  if (!raw?.trim()) return structuredClone(DEFAULT_ORDER_FORM);
  try {
    const parsed = JSON.parse(raw) as Partial<OrderFormConfig>;
    const rawFields = Array.isArray(parsed.fields) ? parsed.fields : [];
    const fields = rawFields
      .filter((f) => Boolean(f && typeof f === "object"))
      .map((raw, index) => {
        const f = raw as Partial<OrderFormField>;
        return {
          id: String(f.id || `f_${index}`),
          label: String(f.label || "未命名").slice(0, 40),
          placeholder: String(f.placeholder || "").slice(0, 80),
          type: (["text", "textarea", "select", "date"] as const).includes(
            f.type as OrderFormFieldType,
          )
            ? (f.type as OrderFormFieldType)
            : "text",
          required: Boolean(f.required),
          // 旧数据无 enabled 字段时默认启用，避免站长配置突然「消失」
          enabled: f.enabled !== false,
          options: Array.isArray(f.options)
            ? f.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 50)
            : [],
        };
      })
      .slice(0, 30);
    return {
      enabled: Boolean(parsed.enabled) && fields.some((f) => f.enabled),
      title: String(parsed.title || DEFAULT_ORDER_FORM.title).slice(0, 40),
      fields,
    };
  } catch {
    return structuredClone(DEFAULT_ORDER_FORM);
  }
}

export function stringifyOrderForm(config: OrderFormConfig) {
  return JSON.stringify({
    enabled: Boolean(config.enabled),
    title: config.title || DEFAULT_ORDER_FORM.title,
    fields: config.fields,
  });
}

/** 实际展示给用户的字段：总开关开 + 字段启用 + 有标签 */
export function activeOrderFormFields(config: OrderFormConfig): OrderFormField[] {
  if (!config.enabled) return [];
  return config.fields.filter((f) => f.enabled !== false && f.label.trim());
}

export function validateOrderFormAnswers(
  config: OrderFormConfig,
  answers: OrderFormAnswers | null | undefined,
): { ok: true; stored: StoredOrderFormAnswers } | { ok: false; error: string } {
  const fields = activeOrderFormFields(config);
  if (fields.length === 0) {
    return { ok: true, stored: { values: {}, labels: {} } };
  }

  const values: OrderFormAnswers = {};
  const labels: Record<string, string> = {};

  for (const field of fields) {
    const raw = answers?.[field.id];
    const value = typeof raw === "string" ? raw.trim() : "";
    labels[field.id] = field.label;

    if (field.required && !value) {
      return { ok: false, error: `请填写「${field.label}」` };
    }

    if (field.type === "select" && value) {
      if (!field.options.includes(value)) {
        return { ok: false, error: `「${field.label}」选项无效` };
      }
    }

    if (value.length > 500) {
      return { ok: false, error: `「${field.label}」过长` };
    }

    values[field.id] = value;
  }

  return { ok: true, stored: { values, labels } };
}

export function parseStoredAnswers(
  raw: string | null | undefined,
): StoredOrderFormAnswers {
  if (!raw?.trim()) return { values: {}, labels: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredOrderFormAnswers> &
      OrderFormAnswers;
    if (parsed && typeof parsed === "object" && parsed.values) {
      return {
        values: Object.fromEntries(
          Object.entries(parsed.values).map(([k, v]) => [k, String(v ?? "")]),
        ),
        labels: Object.fromEntries(
          Object.entries(parsed.labels || {}).map(([k, v]) => [k, String(v ?? "")]),
        ),
      };
    }
    // 兼容扁平结构
    return {
      values: Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k, String(v ?? "")]),
      ),
      labels: {},
    };
  } catch {
    return { values: {}, labels: {} };
  }
}

export function stringifyStoredAnswers(stored: StoredOrderFormAnswers) {
  return JSON.stringify(stored);
}

export function answersComplete(
  config: OrderFormConfig,
  answersRaw: string | null | undefined,
): boolean {
  const result = validateOrderFormAnswers(
    config,
    parseStoredAnswers(answersRaw).values,
  );
  return result.ok;
}
