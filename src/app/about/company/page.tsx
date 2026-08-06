import type { Metadata } from "next";
import { AboutPageView } from "@/components/about-page";
import { getPortalConfig } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const portal = await getPortalConfig();
  return {
    title: portal.company.title,
    description: portal.company.subtitle,
  };
}

export default async function CompanyAboutPage() {
  const portal = await getPortalConfig();
  return <AboutPageView page={portal.company} />;
}
