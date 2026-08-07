export type ComposeUiCopy = {
  step2Title: string;
  courseTypeLabel: string;
  columnTypeLabel: string;
  titleLabel: string;
  titlePlaceholderCourse: string;
  titlePlaceholderColumn: string;
  subtitleLabel: string;
  subtitlePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  priceLabel: string;
  pricePlaceholder: string;
  priceHint: string;
  groupByCategoryLabel: string;
  publishLabel: string;
  submitLabelCourse: string;
  submitLabelColumn: string;
};

export type UiCopy = {
  compose: ComposeUiCopy;
};

export const DEFAULT_UI_COPY: UiCopy = {
  compose: {
    step2Title: "2. 做成可售产品",
    courseTypeLabel: "单课",
    columnTypeLabel: "专栏",
    titleLabel: "标题",
    titlePlaceholderCourse: "课程标题",
    titlePlaceholderColumn: "专栏标题",
    subtitleLabel: "一句话卖点",
    subtitlePlaceholder: "一句话卖点（可选）",
    descriptionLabel: "产品介绍",
    descriptionPlaceholder: "产品介绍：适合谁、能解决什么、包含哪些内容",
    priceLabel: "售价（元）",
    pricePlaceholder: "例如 99.90",
    priceHint: "单位：人民币元，可精确到分（两位小数）。填 0 表示免费。",
    groupByCategoryLabel: "按素材分类自动分章",
    publishLabel: "创建后立即上架售卖",
    submitLabelCourse: "生成可售课程",
    submitLabelColumn: "生成套餐专栏",
  },
};

export function parseUiCopy(raw: string | null | undefined): UiCopy {
  if (!raw?.trim()) return structuredClone(DEFAULT_UI_COPY);
  try {
    const parsed = JSON.parse(raw) as Partial<UiCopy>;
    return {
      compose: {
        ...DEFAULT_UI_COPY.compose,
        ...(parsed.compose || {}),
      },
    };
  } catch {
    return structuredClone(DEFAULT_UI_COPY);
  }
}

export function stringifyUiCopy(copy: UiCopy) {
  return JSON.stringify(copy);
}
