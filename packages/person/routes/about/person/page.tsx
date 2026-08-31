import type { Metadata } from "next";
import { AboutPageView } from "@andyyyds/person/components/about-page";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { resolveContentText } from "@andyyyds/shared/i18n/content-resolve";
import { getRequestLocaleContext } from "@andyyyds/shared/i18n/get-request-locale";
import type { PortalAboutPage } from "@andyyyds/shared/portal";
import { getPortalConfig } from "@andyyyds/shared/site-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const portal = await getPortalConfig();
  return {
    title: portal.person.title,
    description: portal.person.subtitle,
  };
}

async function localizeAboutPage(
  page: PortalAboutPage,
  contentLocale: Awaited<
    ReturnType<typeof getRequestLocaleContext>
  >["contentLocale"],
  bilingual: boolean,
): Promise<PortalAboutPage> {
  const [title, subtitle, body] = await Promise.all([
    resolveContentText({
      entityType: "portal",
      entityId: "default",
      field: "person.title",
      source: page.title,
      locale: contentLocale,
    }),
    resolveContentText({
      entityType: "portal",
      entityId: "default",
      field: "person.subtitle",
      source: page.subtitle,
      locale: contentLocale,
    }),
    resolveContentText({
      entityType: "portal",
      entityId: "default",
      field: "person.body",
      source: page.body,
      locale: contentLocale,
    }),
  ]);
  const highlights = await Promise.all(
    page.highlights.map(async (h, i) => {
      const [label, text] = await Promise.all([
        resolveContentText({
          entityType: "portal",
          entityId: "default",
          field: `person.highlights.${i}.label`,
          source: h.label,
          locale: contentLocale,
        }),
        resolveContentText({
          entityType: "portal",
          entityId: "default",
          field: `person.highlights.${i}.text`,
          source: h.text,
          locale: contentLocale,
        }),
      ]);
      return {
        label: bilingual ? label.source : label.text,
        text: bilingual ? text.source : text.text,
      };
    }),
  );
  return {
    ...page,
    title: bilingual ? title.source : title.text,
    subtitle: bilingual ? subtitle.source : subtitle.text,
    body: bilingual ? body.source : body.text,
    highlights,
  };
}

export default async function PersonAboutPage() {
  const [portal, localeCtx] = await Promise.all([
    getPortalConfig(),
    getRequestLocaleContext(),
  ]);
  const person = await localizeAboutPage(
    portal.person,
    localeCtx.contentLocale,
    localeCtx.bilingual,
  );
  return (
    <NavPageTemplateShell type="person">
      <AboutPageView page={person} />
    </NavPageTemplateShell>
  );
}
