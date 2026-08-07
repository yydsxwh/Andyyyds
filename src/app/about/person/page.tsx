import type { Metadata } from "next";
import { AboutPageView } from "@/components/about-page";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getPortalConfig } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const portal = await getPortalConfig();
  return {
    title: portal.person.title,
    description: portal.person.subtitle,
  };
}

export default async function PersonAboutPage() {
  const portal = await getPortalConfig();
  return (
    <NavPageTemplateShell type="person">
      <AboutPageView page={portal.person} />
    </NavPageTemplateShell>
  );
}
