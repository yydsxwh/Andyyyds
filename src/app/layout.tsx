import type { Metadata } from "next";
import { Manrope, Fraunces } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { DEFAULT_DECORATE, DEFAULT_LOGO_URL } from "@/lib/decorate";
import { getDecorateConfig } from "@/lib/site-settings";
import "./globals.css";

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const decorate = await getDecorateConfig();
  const siteName =
    decorate.siteName?.trim() ||
    decorate.brandName?.trim() ||
    DEFAULT_DECORATE.siteName;
  return {
    title: {
      default: siteName,
      template: `%s · ${siteName}`,
    },
    applicationName: siteName,
    description: "知识付费卖课平台：课程上架、购买学习、创作者后台、优惠券与分销",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const decorate = await getDecorateConfig();
  const logoUrl = decorate.logoUrl || DEFAULT_LOGO_URL;
  const siteName =
    decorate.siteName?.trim() ||
    decorate.brandName?.trim() ||
    DEFAULT_DECORATE.siteName;

  return (
    <html lang="zh-CN" className={`${body.variable} ${display.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--line)] py-8 text-sm text-[var(--muted)]">
          <div className="container flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={siteName}
                className="h-8 w-auto max-w-[160px] object-contain"
              />
              {decorate.showBrandText ? (
                <span className="brand-mark text-lg text-[var(--ink)]">
                  {decorate.brandName}
                </span>
              ) : null}
            </div>
            <span>{siteName}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
