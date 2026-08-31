/**
 * 可售产品（Course）前台展示次序。
 *
 * 业务规则（改排序策略只动此处）：
 * 1. 置顶（isPinned）优先于普通次序；
 * 2. 同置顶状态下按 sortOrder 升序（站长拖拽/数字调整后写入）；
 * 3. 再回退到人气、创建时间，保证未手动排序的旧数据仍有稳定次序。
 *
 * 精华（isFeatured）只做角标/分区，不参与排序。
 */
export const PRODUCT_PLAZA_ORDER_BY = [
  { isPinned: "desc" as const },
  { sortOrder: "asc" as const },
  { studentCount: "desc" as const },
  { createdAt: "desc" as const },
];
