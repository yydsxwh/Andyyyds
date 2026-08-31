"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PRODUCT_TITLE_MAX } from "@andyyyds/shared/media";
import { isValidYuanInput } from "@andyyyds/shared/money";
import { productDetailPath } from "@andyyyds/shared/product-types";
import type { ComposeUiCopy } from "@andyyyds/shared/ui-copy";
import { formatPrice } from "@andyyyds/shared/utils";

/** 超过该像素才算拖拽框选，避免误当成点击 */
const MARQUEE_THRESHOLD_PX = 6;

/** 创作者侧约搭创建页：与组课/章节隔离，复用前台发起流程 */
const MEETUP_CREATE_HREF = "/meetup/new";
/** 创建后活动出现在「我的约搭」，不进「我的课程」 */
const MEETUP_MINE_HREF = "/studio/meetup/mine";

type Asset = {
  id: string;
  name: string;
  category: { name: string } | null;
};

/** 可打进专栏套餐的单课 */
type BundleCourseOption = {
  id: string;
  title: string;
  slug: string;
  price: number;
  status: string;
  coverUrl: string;
};

/**
 * 创建产品页可选类型。
 * MEETUP（活动）只作入口：不走素材组课/专栏打包，跳转约搭创建表单。
 */
type ProductTypeChoice = "COURSE" | "COLUMN" | "MATERIAL" | "MEETUP";

type Props = {
  assets: Asset[];
  /** 名下单课，供创建专栏套餐时勾选 */
  bundleCourses?: BundleCourseOption[];
  initialSelectedIds: string[];
  /** 深链预选类型：如从「创建资料」入口带 ?type=MATERIAL；活动为 ?type=MEETUP */
  initialProductType?: ProductTypeChoice;
  copy: ComposeUiCopy;
};

type DragPayload =
  | { source: "catalog"; id: string }
  | { source: "selected"; id: string };

const DRAG_MIME = "application/x-yyds-compose-asset";

function normalizeProductType(
  value: ProductTypeChoice | undefined,
): ProductTypeChoice {
  if (
    value === "COLUMN" ||
    value === "MATERIAL" ||
    value === "MEETUP"
  ) {
    return value;
  }
  return "COURSE";
}

export function ComposeProductForm({
  assets,
  bundleCourses = [],
  initialSelectedIds,
  initialProductType,
  copy,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [checked, setChecked] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(
    initialSelectedIds.filter((id) => assets.some((a) => a.id === id)),
  );
  /** 专栏套餐所选单课（有序） */
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [productType, setProductType] = useState<ProductTypeChoice>(() =>
    normalizeProductType(initialProductType),
  );
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("99");
  const [hidePrice, setHidePrice] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [publish, setPublish] = useState(true);
  const isColumn = productType === "COLUMN";
  // 活动≠课程：选中后只展示约搭入口，禁止进入素材/章节组课步骤
  const isMeetup = productType === "MEETUP";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOverSelected, setDragOverSelected] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  /** 左侧目录框选矩形（相对 list 可视区域） */
  const [marquee, setMarquee] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const catalogListRef = useRef<HTMLDivElement>(null);
  const cardElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const marqueeSessionRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    active: boolean;
    additive: boolean;
    baseChecked: string[];
  } | null>(null);
  /** 刚做完框选时吞掉随后的 click，避免再 toggle 一次 */
  const suppressCardClickRef = useRef(false);
  /** Shift 范围点选的锚点（最近一次非 Shift 点击） */
  const selectionAnchorIdRef = useRef<string | null>(null);

  const selectedAssets = useMemo(
    () =>
      selected
        .map((id) => assets.find((a) => a.id === id))
        .filter(Boolean) as Asset[],
    [selected, assets],
  );

  const catalogAssets = useMemo(
    () => assets.filter((a) => !selected.includes(a.id)),
    [assets, selected],
  );

  const selectedBundleCourses = useMemo(
    () =>
      selectedCourseIds
        .map((id) => bundleCourses.find((c) => c.id === id))
        .filter(Boolean) as BundleCourseOption[],
    [selectedCourseIds, bundleCourses],
  );

  const catalogBundleCourses = useMemo(
    () => bundleCourses.filter((c) => !selectedCourseIds.includes(c.id)),
    [bundleCourses, selectedCourseIds],
  );

  function setProductTypeAndReset(next: ProductTypeChoice) {
    setProductType(next);
    setError("");
    setStep(1);
    if (next === "MEETUP") {
      // 活动走独立 Meetup 模型，清空组课选择避免误提交 compose API
      setSelected([]);
      setChecked([]);
      setSelectedCourseIds([]);
      return;
    }
    if (next === "COLUMN") {
      setSelected([]);
      setChecked([]);
    } else {
      setSelectedCourseIds([]);
    }
  }

  function toggleCourseInBundle(id: string) {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function moveCourseInBundle(id: string, dir: -1 | 1) {
    setSelectedCourseIds((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function toggleChecked(id: string) {
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function isCtrlOrMeta(e: { ctrlKey: boolean; metaKey: boolean }) {
    return e.ctrlKey || e.metaKey;
  }

  function registerCardEl(id: string, el: HTMLElement | null) {
    if (el) cardElsRef.current.set(id, el);
    else cardElsRef.current.delete(id);
  }

  /** box 为列表内容坐标（含 scrollTop/Left）；与卡片可视矩形做相交判断 */
  function idsIntersectingMarquee(
    list: HTMLDivElement,
    box: { left: number; top: number; width: number; height: number },
  ) {
    const listRect = list.getBoundingClientRect();
    const abs = {
      left: listRect.left + box.left - list.scrollLeft,
      top: listRect.top + box.top - list.scrollTop,
      right: listRect.left + box.left - list.scrollLeft + box.width,
      bottom: listRect.top + box.top - list.scrollTop + box.height,
    };
    const hit: string[] = [];
    for (const [id, el] of cardElsRef.current) {
      const r = el.getBoundingClientRect();
      const overlap =
        r.left < abs.right &&
        r.right > abs.left &&
        r.top < abs.bottom &&
        r.bottom > abs.top;
      if (overlap) hit.push(id);
    }
    return hit;
  }

  function rangeIdsBetween(fromId: string, toId: string) {
    const ids = catalogAssets.map((a) => a.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return [toId];
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    return ids.slice(start, end + 1);
  }

  function onCatalogPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // 触控留给整卡点选与列表滚动；框选仅鼠标左键
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-drag-handle]")) return;
    if (target?.closest("button, a")) return;

    const list = catalogListRef.current;
    if (!list) return;
    const rect = list.getBoundingClientRect();
    // 先不 capture：普通点击要正常冒泡到卡片 onClick；超过阈值再 capture
    marqueeSessionRef.current = {
      pointerId: e.pointerId,
      originX: e.clientX - rect.left + list.scrollLeft,
      originY: e.clientY - rect.top + list.scrollTop,
      active: false,
      // Ctrl / Shift 框选：在原有勾选上追加
      additive: e.shiftKey || isCtrlOrMeta(e),
      baseChecked: [...checked],
    };
  }

  function onCatalogPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const session = marqueeSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    const list = catalogListRef.current;
    if (!list) return;

    const rect = list.getBoundingClientRect();
    const x = e.clientX - rect.left + list.scrollLeft;
    const y = e.clientY - rect.top + list.scrollTop;
    const dx = x - session.originX;
    const dy = y - session.originY;
    if (!session.active && Math.hypot(dx, dy) < MARQUEE_THRESHOLD_PX) {
      return;
    }

    if (!session.active) {
      session.active = true;
      suppressCardClickRef.current = true;
      try {
        list.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    // 内容坐标：绝对定位子元素会随列表滚动，需用 scroll 后的坐标系
    const box = {
      left: Math.min(session.originX, x),
      top: Math.min(session.originY, y),
      width: Math.abs(dx),
      height: Math.abs(dy),
    };
    setMarquee(box);

    const hit = idsIntersectingMarquee(list, box);
    if (session.additive) {
      setChecked([...new Set([...session.baseChecked, ...hit])]);
    } else {
      setChecked(hit);
    }
  }

  function endCatalogMarquee(e: React.PointerEvent<HTMLDivElement>) {
    const session = marqueeSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    marqueeSessionRef.current = null;
    setMarquee(null);
    const list = catalogListRef.current;
    try {
      list?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (session.active) {
      // 下一帧再允许卡片 click，避免 pointerup 后的 click 反选
      window.setTimeout(() => {
        suppressCardClickRef.current = false;
      }, 0);
    }
  }

  /**
   * 点选：
   * - 单击：勾选 / 再点取消（toggle）
   * - Ctrl/Cmd+单击：同样 toggle，便于多选加减
   * - Shift+单击：从锚点到当前项范围勾选（再加 Ctrl 则并入已有）
   */
  function onCatalogCardClick(id: string, e: React.MouseEvent | React.KeyboardEvent) {
    if (suppressCardClickRef.current) return;

    const shift = "shiftKey" in e && e.shiftKey;
    const ctrl = isCtrlOrMeta({
      ctrlKey: "ctrlKey" in e ? e.ctrlKey : false,
      metaKey: "metaKey" in e ? e.metaKey : false,
    });

    if (shift) {
      const anchor = selectionAnchorIdRef.current || id;
      const range = rangeIdsBetween(anchor, id);
      if (ctrl) {
        setChecked((prev) => [...new Set([...prev, ...range])]);
      } else {
        setChecked(range);
      }
      return;
    }

    // 普通点击 / Ctrl 点击：点选与再点取消
    toggleChecked(id);
    selectionAnchorIdRef.current = id;
  }

  function addToSelected(ids: string[]) {
    const unique = ids.filter(
      (id) => assets.some((a) => a.id === id) && !selected.includes(id),
    );
    if (unique.length === 0) return;
    setSelected((prev) => [...prev, ...unique]);
    setChecked((prev) => prev.filter((id) => !unique.includes(id)));
  }

  function addChecked() {
    addToSelected(checked);
  }

  function removeSelected(id: string) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  function clearSelected() {
    setSelected([]);
  }

  function reorderSelected(fromId: string, toIndex: number) {
    setSelected((prev) => {
      const from = prev.indexOf(fromId);
      if (from < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      const clamped = Math.max(0, Math.min(toIndex, next.length));
      next.splice(clamped, 0, item);
      return next;
    });
  }

  function parseDragPayload(e: React.DragEvent): DragPayload | null {
    const raw =
      e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData("text/plain");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  }

  function setDragData(e: React.DragEvent, payload: DragPayload) {
    const raw = JSON.stringify(payload);
    e.dataTransfer.setData(DRAG_MIME, raw);
    e.dataTransfer.setData("text/plain", raw);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDropToSelected(e: React.DragEvent, atIndex?: number) {
    e.preventDefault();
    setDragOverSelected(false);
    setDragOverIndex(null);
    const payload = parseDragPayload(e);
    if (!payload) return;

    if (payload.source === "catalog") {
      const ids =
        checked.includes(payload.id) && checked.length > 1
          ? checked
          : [payload.id];
      if (typeof atIndex === "number") {
        const fresh = ids.filter(
          (id) => assets.some((a) => a.id === id) && !selected.includes(id),
        );
        if (fresh.length === 0) return;
        setSelected((prev) => {
          const next = [...prev];
          next.splice(atIndex, 0, ...fresh);
          return next;
        });
        setChecked((prev) => prev.filter((id) => !fresh.includes(id)));
      } else {
        addToSelected(ids);
      }
      return;
    }

    if (payload.source === "selected" && typeof atIndex === "number") {
      reorderSelected(payload.id, atIndex);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (isColumn) {
      if (selectedCourseIds.length === 0) {
        setError("请至少选择一门单课加入专栏套餐");
        setStep(1);
        return;
      }
    } else if (selected.length === 0) {
      setError("请至少选择 1 个素材");
      setStep(1);
      return;
    }
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    if (trimmedTitle.length < 2) {
      setError("标题至少需要 2 个字");
      return;
    }
    if (!isValidYuanInput(price)) {
      setError("请填写有效价格（可到分，如 99.90）");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/studio/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType,
          title: trimmedTitle,
          subtitle,
          description: trimmedDesc,
          price,
          hidePrice,
          publish,
          groupByCategory: isColumn ? false : groupByCategory,
          ...(isColumn
            ? { courseIds: selectedCourseIds }
            : { assetIds: selected }),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        slug?: string;
        id?: string;
      };
      if (!res.ok) {
        setError(data.error || "创建失败");
        return;
      }
      // 创建成功后进前台详情；中文 slug 已在详情页 decode，避免误 404
      if (data.slug) {
        router.push(productDetailPath(data.slug, productType));
        router.refresh();
        return;
      }
      if (data.id) {
        router.push(`/studio/courses/${data.id}/edit`);
        router.refresh();
        return;
      }
      setError("创建成功但未返回链接，请到课程列表查看");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="surface space-y-3 rounded-[28px] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--muted)]">
            产品类型
          </span>
          <button
            type="button"
            className={`btn min-h-10 px-3 text-sm ${productType === "COURSE" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProductTypeAndReset("COURSE")}
          >
            {copy.courseTypeLabel}
          </button>
          <button
            type="button"
            className={`btn min-h-10 px-3 text-sm ${productType === "COLUMN" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProductTypeAndReset("COLUMN")}
          >
            {copy.columnTypeLabel}
          </button>
          <button
            type="button"
            className={`btn min-h-10 px-3 text-sm ${productType === "MATERIAL" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProductTypeAndReset("MATERIAL")}
          >
            资料
          </button>
          <button
            type="button"
            className={`btn min-h-10 px-3 text-sm ${isMeetup ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProductTypeAndReset("MEETUP")}
          >
            活动
          </button>
        </div>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          {isMeetup
            ? "活动：约搭活动（可设价格、分档报名、图文详情等），不是课程/章节；创建后出现在「我的约搭」，不进「我的课程」。"
            : isColumn
              ? "专栏是套餐：选择多门已创建的单课打包售卖；买专栏后开通所含每门单课。"
              : productType === "MATERIAL"
                ? "资料：用素材打包，出现在资料广场。"
                : "单课：用素材组成一门独立可售课程。"}
        </p>
      </div>

      {isMeetup ? (
        <div className="surface space-y-4 rounded-[28px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">创建约搭活动</h2>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            约搭是线下/线上组队活动：可配置封面、报名费、分档名额与图文详情。
            与单课/专栏/资料不同，不会走素材组课或章节逻辑。
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={MEETUP_CREATE_HREF}
              className="btn btn-accent inline-flex min-h-11 items-center justify-center"
            >
              去创建约搭活动
            </Link>
            <Link
              href={MEETUP_MINE_HREF}
              className="btn btn-secondary inline-flex min-h-11 items-center justify-center"
            >
              查看我的约搭
            </Link>
          </div>
        </div>
      ) : null}

      {!isMeetup ? (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StepPill
          active={step === 1}
          done={step > 1}
          n={1}
          label={isColumn ? "选择单课" : "选择素材"}
        />
        <span className="text-[var(--muted)]">→</span>
        <StepPill active={step === 2} done={false} n={2} label="填写产品信息" />
      </div>
      ) : null}

      {!isMeetup && step === 1 && isColumn ? (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="surface space-y-4 rounded-[28px] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">选择要打包的单课</h2>
              <span className="text-xs text-[var(--muted)]">
                已选 {selectedCourseIds.length} 门
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">
              仅列出你名下的「单课」。请先创建单课，再组成专栏套餐。
            </p>
            {catalogBundleCourses.length === 0 &&
            selectedCourseIds.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                暂无可用单课。请先创建并上架单课，再回来组专栏。
              </p>
            ) : (
              <ul className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                {catalogBundleCourses.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full min-h-12 items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-sm hover:border-[var(--brand)]/40"
                      onClick={() => toggleCourseInBundle(c.id)}
                    >
                      <span className="min-w-0 truncate font-medium">
                        {c.title}
                      </span>
                      <span className="shrink-0 text-[var(--muted)]">
                        {formatPrice(c.price)}
                        {c.status !== "PUBLISHED" ? " · 草稿" : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="surface space-y-4 rounded-[28px] p-6">
            <h2 className="text-lg font-semibold">套餐内单课（顺序）</h2>
            {selectedBundleCourses.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                从左侧点选加入；右侧可调整顺序。
              </p>
            ) : (
              <ol className="space-y-2">
                {selectedBundleCourses.map((c, index) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-sm"
                  >
                    <span className="text-xs text-[var(--muted)]">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {c.title}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary min-h-9 px-2 text-xs"
                      onClick={() => moveCourseInBundle(c.id, -1)}
                      disabled={index === 0}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary min-h-9 px-2 text-xs"
                      onClick={() => moveCourseInBundle(c.id, 1)}
                      disabled={index === selectedBundleCourses.length - 1}
                    >
                      下移
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary min-h-9 px-2 text-xs"
                      onClick={() => toggleCourseInBundle(c.id)}
                    >
                      移除
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <button
              type="button"
              className="btn btn-primary w-full min-h-11"
              disabled={selectedCourseIds.length === 0}
              onClick={() => {
                setError("");
                setStep(2);
              }}
            >
              下一步（已选 {selectedCourseIds.length} 门单课）
            </button>
          </div>
        </div>
      ) : null}

      {!isMeetup && step === 1 && !isColumn ? (
        <div className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="surface space-y-4 rounded-[28px] p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">从素材中心选择</h2>
                <span className="text-xs text-[var(--muted)]">
                  已勾选 {checked.length} 个
                </span>
              </div>
              <p className="text-sm text-[var(--muted)]">
                单击卡片勾选，再点取消；Ctrl 点选加减；Shift 点选范围；拖动可框选。右侧「拖」可导入；手机点卡片即可。
              </p>
              <div
                ref={catalogListRef}
                className="relative max-h-[480px] space-y-2 overflow-y-auto pr-1 select-none"
                onPointerDown={onCatalogPointerDown}
                onPointerMove={onCatalogPointerMove}
                onPointerUp={endCatalogMarquee}
                onPointerCancel={endCatalogMarquee}
              >
                {catalogAssets.map((asset) => {
                  const isChecked = checked.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      ref={(el) => registerCardEl(asset.id, el)}
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      onClick={(e) => onCatalogCardClick(asset.id, e)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          onCatalogCardClick(asset.id, e);
                        }
                      }}
                      className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 ${
                        isChecked
                          ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                          : "border-[var(--line)] bg-white/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="pointer-events-none mt-1"
                        checked={isChecked}
                        readOnly
                        tabIndex={-1}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-medium leading-snug">
                          {asset.name}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--muted)]">
                          {asset.category?.name || "未分类"} · 点选 / Ctrl / Shift
                        </span>
                      </span>
                      {/* 拖拽把手与框选分离，避免整卡 draggable 抢鼠标 */}
                      <span
                        data-drag-handle
                        draggable
                        title="拖到右侧导入"
                        aria-label={`拖拽导入 ${asset.name}`}
                        onClick={(e) => e.stopPropagation()}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDragData(e, { source: "catalog", id: asset.id });
                        }}
                        className="mt-0.5 inline-flex min-h-10 min-w-10 shrink-0 cursor-grab items-center justify-center rounded-xl border border-[var(--line)] bg-white/90 text-xs text-[var(--muted)] active:cursor-grabbing"
                      >
                        拖
                      </span>
                    </div>
                  );
                })}
                {marquee ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute z-10 rounded-md border border-[var(--brand)] bg-[var(--brand-soft)]/50"
                    style={{
                      left: marquee.left,
                      top: marquee.top,
                      width: marquee.width,
                      height: marquee.height,
                    }}
                  />
                ) : null}
              </div>
              {assets.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  素材库为空，请先去素材中心上传。
                </p>
              ) : catalogAssets.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  可选素材已全部加入右侧列表。
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={checked.length === 0}
                  onClick={addChecked}
                >
                  加入已选（{checked.length}）
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={checked.length === 0}
                  onClick={() => setChecked([])}
                >
                  清除勾选
                </button>
              </div>
            </div>

            <div
              className={`surface space-y-4 rounded-[28px] p-6 transition ${
                dragOverSelected
                  ? "ring-2 ring-[var(--brand)] ring-offset-2"
                  : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverSelected(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverSelected(false);
                  setDragOverIndex(null);
                }
              }}
              onDrop={(e) => onDropToSelected(e, selected.length)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">已选素材 / 导入区</h2>
                <span className="text-xs text-[var(--muted)]">
                  {selected.length} 个 · 可拖拽排序
                </span>
              </div>
              <p className="text-sm text-[var(--muted)]">
                把左侧素材拖到这里导入；在列表内上下拖动可调整课时顺序。
              </p>

              {selectedAssets.length === 0 ? (
                <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-white/50 px-4 py-8 text-center text-sm text-[var(--muted)]">
                  拖拽素材到此处，或点选/框选后点「加入已选」
                </div>
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {selectedAssets.map((asset, index) => (
                    <div
                      key={asset.id}
                      draggable
                      onDragStart={(e) => {
                        setDragData(e, { source: "selected", id: asset.id });
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverIndex(index);
                      }}
                      onDrop={(e) => {
                        e.stopPropagation();
                        onDropToSelected(e, index);
                      }}
                      className={`flex cursor-grab items-center gap-2 rounded-xl border bg-[var(--bg)] px-3 py-2.5 text-sm active:cursor-grabbing ${
                        dragOverIndex === index
                          ? "border-[var(--brand)]"
                          : "border-transparent"
                      }`}
                    >
                      <span className="w-5 shrink-0 text-[var(--muted)]">
                        {index + 1}.
                      </span>
                      <span className="min-w-0 flex-1 break-words">
                        <span className="block font-medium">{asset.name}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {asset.category?.name || "未分类"}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary px-2 py-1 text-xs"
                        onClick={() => removeSelected(asset.id)}
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selectedAssets.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={clearSelected}
                >
                  清空已选
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              {selected.length > 0
                ? `已准备 ${selected.length} 个素材，确认后填写产品信息`
                : "请至少导入 1 个素材后再继续"}
            </p>
            <button
              type="button"
              className="btn btn-accent relative z-10"
              disabled={selected.length === 0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setError("");
                setStep(2);
              }}
            >
              下一步：填写产品信息
            </button>
          </div>
        </div>
      ) : !isMeetup ? (
        <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="surface space-y-4 rounded-[28px] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">已选素材摘要</h2>
              <button
                type="button"
                className="btn btn-secondary px-3 py-1.5 text-xs"
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
              >
                返回修改素材
              </button>
            </div>
            <ol className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {selectedAssets.map((asset, index) => (
                <li
                  key={asset.id}
                  className="rounded-xl bg-[var(--bg)] px-3 py-2 text-sm"
                >
                  <span className="text-[var(--muted)]">{index + 1}. </span>
                  <span className="break-words font-medium">{asset.name}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {asset.category?.name || "未分类"}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="surface space-y-4 rounded-[28px] p-6">
            <h2 className="text-lg font-semibold">{copy.step2Title}</h2>
            <p className="text-sm text-[var(--muted)]">
              当前类型：
              <span className="font-medium text-[var(--ink)]">
                {productType === "MATERIAL"
                  ? "资料"
                  : isColumn
                    ? "专栏套餐"
                    : copy.courseTypeLabel}
              </span>
              {isColumn
                ? ` · 含 ${selectedCourseIds.length} 门单课`
                : ` · ${selected.length} 个素材`}
            </p>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">
                {copy.titleLabel}
              </label>
              <input
                className="field"
                value={title}
                maxLength={PRODUCT_TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  productType === "MATERIAL"
                    ? "例如：考研真题资料包"
                    : productType === "COLUMN"
                      ? copy.titlePlaceholderColumn
                      : copy.titlePlaceholderCourse
                }
                required
              />
              <div className="mt-1 text-right text-xs text-[var(--muted)]">
                {title.length}/{PRODUCT_TITLE_MAX}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">
                {copy.subtitleLabel}
              </label>
              <input
                className="field"
                value={subtitle}
                maxLength={200}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder={copy.subtitlePlaceholder}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">
                {copy.descriptionLabel}
                <span className="ml-1 font-normal text-[var(--muted)]">
                  （选填）
                </span>
              </label>
              <textarea
                className="field min-h-32"
                value={description}
                maxLength={5000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={copy.descriptionPlaceholder}
              />
              <div className="mt-1 text-right text-xs text-[var(--muted)]">
                {description.trim().length}/5000
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">
                {copy.priceLabel}
              </label>
              <div className="relative">
                <input
                  className="field pr-12"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={copy.pricePlaceholder}
                  required
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
                  元
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">{copy.priceHint}</p>
              <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                  checked={hidePrice}
                  onChange={(e) => setHidePrice(e.target.checked)}
                />
                <span>
                  前台隐藏价格
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    列表与详情不显示售价；结账仍显示应付金额
                  </span>
                </span>
              </label>
            </div>
            {!isColumn ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={groupByCategory}
                  onChange={(e) => setGroupByCategory(e.target.checked)}
                />
                {copy.groupByCategoryLabel}
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
              />
              {copy.publishLabel}
            </label>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            {/* z-10：避免顶栏叠层时误点导航导致看起来像「生成失败 404」 */}
            <div className="relative z-10 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-secondary sm:w-auto"
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
              >
                上一步
              </button>
              <button
                className="btn btn-accent flex-1"
                disabled={
                  loading ||
                  (isColumn
                    ? selectedCourseIds.length === 0
                    : selected.length === 0)
                }
                type="submit"
              >
                {loading
                  ? "创建中..."
                  : isColumn
                    ? `${copy.submitLabelColumn}（${selectedCourseIds.length} 门单课）`
                    : productType === "MATERIAL"
                      ? `创建资料并上架（${selected.length} 个素材）`
                      : `${copy.submitLabelCourse}（${selected.length} 个素材）`}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function StepPill({
  active,
  done,
  n,
  label,
}: {
  active: boolean;
  done: boolean;
  n: number;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${
        active
          ? "bg-[var(--brand)] text-white"
          : done
            ? "bg-[var(--brand-soft)] text-[var(--brand)]"
            : "bg-[var(--bg)] text-[var(--muted)]"
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
        {done ? "✓" : n}
      </span>
      {label}
    </span>
  );
}
