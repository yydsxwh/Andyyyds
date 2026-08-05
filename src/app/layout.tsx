import type { Metadata } from "next";
import { Manrope, Fraunces } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YYDS 课程平台",
  description: "知识付费卖课平台：课程上架、购买学习、创作者后台、优惠券与分销",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`${body.variable} ${display.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--line)] py-8 text-sm text-[var(--muted)]">
          <div className="container flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="brand-mark text-lg text-[var(--brand)]">YYDS</span>
            <span>卖课、学习、交付一站完成 · 演示版</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
