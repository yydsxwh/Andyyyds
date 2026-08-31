import type { Metadata } from "next";
import Link from "next/link";
import { ContactUsPanel } from "@/components/contact-us-panel";
import { DEFAULT_PORTAL_CONTACT } from "@andyyyds/shared/portal";
import { getPortalConfig } from "@andyyyds/shared/site-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const portal = await getPortalConfig();
  return {
    title: portal.contact.title || "联系我们",
    description: "公司联系方式",
  };
}

export default async function ContactPage() {
  const portal = await getPortalConfig();
  const contact = portal.contact || DEFAULT_PORTAL_CONTACT;

  return (
    <div className="container py-10 sm:py-14">
      <div className="mx-auto max-w-lg space-y-4">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm text-[var(--brand)] underline-offset-2 hover:underline"
        >
          ← 返回首页
        </Link>
        <ContactUsPanel contact={{ ...contact, enabled: true }} variant="hero" />
      </div>
    </div>
  );
}
