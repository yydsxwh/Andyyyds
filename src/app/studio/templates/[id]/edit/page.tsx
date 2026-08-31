import { notFound, redirect } from "next/navigation";
import { DecorateSubnav } from "@/components/decorate-subnav";
import { PageTemplateEditor } from "@/components/page-template-editor";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import {
  getTemplateById,
  isSystemDefaultTemplateId,
} from "@andyyyds/shared/page-templates";
import { isAdmin } from "@andyyyds/shared/roles";
import { getPageTemplatesConfig } from "@andyyyds/shared/site-settings";

export const dynamic = "force-dynamic";

export default async function StudioTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.role)) redirect("/studio");

  const { id } = await params;
  const config = await getPageTemplatesConfig();
  const template = getTemplateById(config, id);
  if (!template) notFound();

  // 系统锁定模板不可进编辑器，避免误改；恢复原页请在列表「设为默认」
  if (template.locked || isSystemDefaultTemplateId(template.id)) {
    redirect("/studio/templates");
  }

  return (
    <div className="container space-y-6 py-6 sm:py-10">
      <StudioNav current="decorate" area="admin" />
      <DecorateSubnav current="templates" />
      <PageTemplateEditor initial={template} />
    </div>
  );
}
