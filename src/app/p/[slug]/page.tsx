import { notFound } from "next/navigation";
import {
  PageModulesView,
  shouldUseDiyLayout,
} from "@/components/page-modules-view";
import { getCustomTemplateBySlug } from "@andyyyds/shared/page-templates";
import { getPageTemplatesConfig } from "@andyyyds/shared/site-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = await getPageTemplatesConfig();
  const template = getCustomTemplateBySlug(config, slug);
  return {
    title: template?.name || "页面",
  };
}

export default async function CustomPageTemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = await getPageTemplatesConfig();
  const template = getCustomTemplateBySlug(config, slug);
  if (!template || !shouldUseDiyLayout(template)) notFound();

  return (
    <div className="py-4 sm:py-8">
      <PageModulesView template={template} />
    </div>
  );
}
