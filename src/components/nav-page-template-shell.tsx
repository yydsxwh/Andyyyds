/**
 * 导航页外壳：有默认 DIY 模板则按模块渲染；
 * 本页原有内容自动填入同名 pageSlot（如 type=courses → slot=courses）。
 */

import type { ReactNode } from "react";
import {
  PageModulesView,
  shouldUseDiyLayout,
} from "@/components/page-modules-view";
import {
  getDefaultTemplate,
  type PageSlotId,
  type PageTemplateType,
} from "@andyyyds/shared/page-templates";
import { getPageTemplatesConfig } from "@andyyyds/shared/site-settings";

const SLOT_TYPES = new Set<string>([
  "company",
  "person",
  "courses",
  "meetup",
  "shop",
  "products",
  "forum",
  "games",
  "account",
]);

type Props = {
  type: PageTemplateType;
  children: ReactNode;
};

export async function NavPageTemplateShell({ type, children }: Props) {
  const config = await getPageTemplatesConfig();
  const diy = getDefaultTemplate(config, type);
  if (shouldUseDiyLayout(diy)) {
    const slots =
      SLOT_TYPES.has(type)
        ? { [type as PageSlotId]: children }
        : undefined;
    return (
      <div className="py-4 sm:py-6">
        <PageModulesView template={diy!} slots={slots} />
      </div>
    );
  }
  return <>{children}</>;
}
