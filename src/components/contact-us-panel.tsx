/**
 * 「联系我们」：直接展开（非弹层）。
 * 字段由内容管理配置；首页上下位置与区块显隐由 portal.homeSectionOrder 决定（CMS「首页区块顺序」）。
 */

import type { PortalContact } from "@andyyyds/shared/portal";

type Props = {
  contact: PortalContact;
  /** hero=首页大卡片；compact=其它页顶栏下紧凑条 */
  variant?: "hero" | "compact";
};

type ContactRow = { label: string; value: string; href?: string };

function buildRows(contact: PortalContact): ContactRow[] {
  const rows: ContactRow[] = [];
  if (contact.phone) {
    rows.push({
      label: "电话",
      value: contact.phone,
      href: `tel:${contact.phone.replace(/[^\d+]/g, "")}`,
    });
  }
  if (contact.wechat) {
    rows.push({ label: "微信", value: contact.wechat });
  }
  if (contact.qq) {
    rows.push({
      label: "QQ",
      value: contact.qq,
      href: /^\d+$/.test(contact.qq.replace(/\s/g, ""))
        ? `tencent://message/?uin=${contact.qq.replace(/\s/g, "")}`
        : undefined,
    });
  }
  if (contact.wechatMp) {
    rows.push({ label: "公众号", value: contact.wechatMp });
  }
  if (contact.xiaohongshu) {
    rows.push({ label: "小红书", value: contact.xiaohongshu });
  }
  if (contact.douyin) {
    rows.push({ label: "抖音", value: contact.douyin });
  }
  if (contact.bilibili) {
    rows.push({ label: "B站", value: contact.bilibili });
  }
  if (contact.email) {
    rows.push({
      label: "邮箱",
      value: contact.email,
      href: `mailto:${contact.email}`,
    });
  }
  if (contact.address) {
    rows.push({ label: "地址", value: contact.address });
  }
  if (contact.hours) {
    rows.push({ label: "时间", value: contact.hours });
  }
  return rows;
}

export function ContactUsPanel({ contact, variant = "hero" }: Props) {
  if (!contact.enabled) return null;

  const rows = buildRows(contact);
  const title = contact.title || contact.linkLabel || "联系我们";

  if (rows.length === 0 && !contact.note) return null;

  if (variant === "compact") {
    return (
      <aside
        aria-label={title}
        className="glass-bar border-b px-2.5 py-2 sm:px-3"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span className="shrink-0 font-semibold text-[var(--ink)]">
            {title}
          </span>
          {rows.map((row) =>
            row.href ? (
              <a
                key={row.label}
                href={row.href}
                className="min-h-9 text-[var(--brand)] underline-offset-2 hover:underline"
              >
                <span className="text-[var(--muted)]">{row.label}</span>{" "}
                {row.value}
              </a>
            ) : (
              <span key={row.label} className="min-h-9 text-[var(--ink)]">
                <span className="text-[var(--muted)]">{row.label}</span>{" "}
                {row.value}
              </span>
            ),
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label={title}
      // 首页靠左展示；与右侧「客户端下载」并排时由外层控制宽度
      className="surface w-full max-w-md space-y-3 rounded-[24px] p-4 sm:max-w-sm sm:p-5"
    >
      <h2 className="text-base font-semibold text-[var(--ink)] sm:text-lg">
        {title}
      </h2>
      <dl className="grid gap-2.5 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-xs text-[var(--muted)]">{row.label}</dt>
            <dd className="mt-0.5 break-all text-sm font-medium text-[var(--ink)]">
              {row.href ? (
                <a
                  href={row.href}
                  className="inline-flex min-h-10 items-center text-[var(--brand)] underline-offset-2 hover:underline"
                >
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {contact.note ? (
        <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
          {contact.note}
        </p>
      ) : null}
    </aside>
  );
}
