import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { OpenVsCodeButton } from "@andyyyds/mathcode/components/open-vscode-button";
import { MATHCODE_EDITOR_LINKS } from "@andyyyds/mathcode/lib/mathcode-open";
import {
  SOFTWARE_PRODUCTS_PAGE,
  type SoftwareProduct,
} from "@andyyyds/shared/software-products";
import { loadSoftwareProducts } from "@andyyyds/shared/platform-catalog";

export const metadata = {
  title: "软件产品",
  description: "瞬懂、颗秒日事、MathCode、网页文档等自研软件产品",
};

function ProductActions({ product }: { product: SoftwareProduct }) {
  if (!product.actions?.length) return null;
  return (
    <div className="relative z-10 mt-4 flex flex-wrap gap-2">
      {product.actions.map((action) => {
        const className = action.primary
          ? "btn btn-primary min-h-11 px-4 text-sm"
          : "btn btn-secondary min-h-11 px-4 text-sm";
        const isApk = /\.apk(?:$|\?)/i.test(action.href);
        // 安卓 Chrome 用 download 属性走 blob 保存时，APK 首次常提示「下载失败」；
        // 直接跳转交给 nginx 的 Content-Disposition 命名更稳。其余安装包保留 download。
        const downloadProps =
          action.download && !isApk
            ? { download: action.href.split("/").pop() || "download" }
            : {};
        return (
          <a
            key={action.href}
            className={className}
            href={action.href}
            type={isApk ? "application/vnd.android.package-archive" : undefined}
            target="_blank"
            rel="noopener noreferrer"
            {...downloadProps}
          >
            {action.label}
          </a>
        );
      })}
    </div>
  );
}

function ProductCard({ product }: { product: SoftwareProduct }) {
  const hasActions = Boolean(product.actions?.length);
  const inner = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {product.badge ? (
          <span className="rounded-full bg-[var(--brand)]/12 px-2.5 py-0.5 text-xs font-medium text-[var(--brand)]">
            {product.badge}
          </span>
        ) : null}
        <span className="text-xs text-[var(--muted)]">{product.tagline}</span>
      </div>
      <h2 className="mt-3 text-xl font-semibold text-[var(--ink)] sm:text-2xl">
        {product.name}
      </h2>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
        {product.description}
      </p>

      {hasActions ? (
        <ProductActions product={product} />
      ) : product.href && product.id === "mathcode" ? (
        <div className="relative z-10 mt-4 flex flex-wrap gap-2">
          <a
            href={product.href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary min-h-11 px-4 text-sm"
          >
            进入 MathCode
          </a>
          <a
            className="btn btn-secondary min-h-11 px-4 text-sm"
            href={MATHCODE_EDITOR_LINKS.overleaf}
            target="_blank"
            rel="noopener noreferrer"
          >
            打开 Overleaf
          </a>
          <OpenVsCodeButton className="btn btn-secondary min-h-11 px-4 text-sm">
            打开 VS Code
          </OpenVsCodeButton>
          <a
            href="/app/windows"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary min-h-11 px-4 text-sm"
          >
            Windows 客户端
          </a>
        </div>
      ) : product.href ? (
        <span className="relative z-10 mt-4 inline-flex min-h-11 items-center text-sm font-medium text-[var(--brand)]">
          了解更多 →
        </span>
      ) : (
        <p className="mt-4 text-xs text-[var(--muted)]">上线后可在此进入产品</p>
      )}
    </>
  );

  const className =
    "surface relative block rounded-[28px] p-5 transition hover:-translate-y-0.5 sm:p-6";

  if (product.href) {
    // 整张卡片都可点击，且一律在新标签打开，软件产品页本身不会被覆盖。
    // 铺满卡片的透明链接放在底层，卡片内的按钮靠 pointer-events 单独接管点击。
    return (
      <article className={className}>
        <a
          href={product.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`在新标签页打开${product.name}`}
          className="absolute inset-0 z-0 rounded-[28px]"
        />
        <div className="relative z-10 pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          {inner}
        </div>
      </article>
    );
  }

  return <article className={className}>{inner}</article>;
}

export default async function SoftwareProductsPage() {
  // 产品集合来自 platform Catalog（未开启时回落到本地列表），文案仍由本站维护
  const products = await loadSoftwareProducts();

  return (
    <NavPageTemplateShell type="products">
      <div className="container py-10 sm:py-12">
        <header className="mb-8 max-w-2xl">
          <h1 className="brand-mark text-3xl font-semibold sm:text-4xl">
            {SOFTWARE_PRODUCTS_PAGE.title}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
            {SOFTWARE_PRODUCTS_PAGE.subtitle}
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <section className="mt-12 border-t border-[var(--line)] pt-10">
          <h2 className="text-xl font-semibold text-[var(--ink)] sm:text-2xl">
            游戏中心
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            休闲与学习向游戏入口规划中，先从这里进入专区。
          </p>
          <a
            href="/games"
            target="_blank"
            rel="noopener noreferrer"
            className="surface mt-5 block rounded-[28px] p-5 transition hover:-translate-y-0.5 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--brand)]/12 px-2.5 py-0.5 text-xs font-medium text-[var(--brand)]">
                即将开放
              </span>
              <span className="text-xs text-[var(--muted)]">软件产品分区</span>
            </div>
            <h3 className="mt-3 text-xl font-semibold text-[var(--ink)]">
              游戏中心
            </h3>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              休闲与学习向游戏入口正在规划，稍后与你见面。
            </p>
            <span className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-[var(--brand)]">
              进入游戏中心 →
            </span>
          </a>
        </section>

        <p className="mt-10 text-center text-xs text-[var(--muted)]">
          更多颗秒系列产品将陆续加入本专栏。
        </p>
      </div>
    </NavPageTemplateShell>
  );
}
