import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
  publicSiteSettings,
} from "@/lib/site-settings";
import {
  DEFAULT_ORDER_FORM,
  stringifyOrderForm,
  type OrderFormFieldType,
} from "@/lib/order-form";
import { DEFAULT_PORTAL, stringifyPortal } from "@/lib/portal";
import {
  DEFAULT_STUDIO_NAV,
  stringifyStudioNav,
} from "@/lib/studio-nav-config";
import { DEFAULT_UI_COPY, stringifyUiCopy } from "@/lib/ui-copy";

const composeCopySchema = z.object({
  step2Title: z.string().max(80).optional(),
  courseTypeLabel: z.string().max(40).optional(),
  columnTypeLabel: z.string().max(40).optional(),
  titleLabel: z.string().max(40).optional(),
  titlePlaceholderCourse: z.string().max(120).optional(),
  titlePlaceholderColumn: z.string().max(120).optional(),
  subtitleLabel: z.string().max(40).optional(),
  subtitlePlaceholder: z.string().max(120).optional(),
  descriptionLabel: z.string().max(40).optional(),
  descriptionPlaceholder: z.string().max(300).optional(),
  priceLabel: z.string().max(40).optional(),
  pricePlaceholder: z.string().max(40).optional(),
  priceHint: z.string().max(120).optional(),
  groupByCategoryLabel: z.string().max(80).optional(),
  publishLabel: z.string().max(80).optional(),
  submitLabelCourse: z.string().max(80).optional(),
  submitLabelColumn: z.string().max(80).optional(),
});

const navLinkSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(40),
  href: z.string().min(1).max(300),
});

const patchSchema = z.object({
  uiCopy: z
    .object({
      compose: composeCopySchema.optional(),
    })
    .optional(),
  orderForm: z
    .object({
      enabled: z.boolean().optional(),
      title: z.string().max(40).optional(),
      fields: z
        .array(
          z.object({
            id: z.string().min(1).max(64),
            label: z.string().min(1).max(40),
            placeholder: z.string().max(80).optional(),
            type: z.enum(["text", "textarea", "select", "date"]),
            required: z.boolean(),
            options: z.array(z.string().max(80)).max(50).optional(),
          }),
        )
        .max(30)
        .optional(),
    })
    .optional(),
  studioNav: z
    .object({
      topBase: z.array(navLinkSchema).max(20).optional(),
      topAdmin: z.array(navLinkSchema).max(20).optional(),
      courses: z.array(navLinkSchema).max(20).optional(),
    })
    .optional(),
  portal: z
    .object({
      nav: z
        .array(
          z.object({
            key: z.string().min(1).max(40),
            label: z.string().min(1).max(40),
            href: z.string().min(1).max(300),
            enabled: z.boolean().optional(),
            comingSoon: z.boolean().optional(),
          }),
        )
        .max(20)
        .optional(),
      company: z
        .object({
          title: z.string().max(80).optional(),
          subtitle: z.string().max(200).optional(),
          body: z.string().max(20000).optional(),
          highlights: z
            .array(
              z.object({
                label: z.string().max(40),
                text: z.string().max(120),
              }),
            )
            .max(8)
            .optional(),
        })
        .optional(),
      person: z
        .object({
          title: z.string().max(80).optional(),
          subtitle: z.string().max(200).optional(),
          body: z.string().max(20000).optional(),
          highlights: z
            .array(
              z.object({
                label: z.string().max(40),
                text: z.string().max(120),
              }),
            )
            .max(8)
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const row = await getSiteSettings();
    const pub = publicSiteSettings(row);
    return NextResponse.json({
      uiCopy: pub.uiCopy,
      orderForm: pub.orderForm,
      studioNav: pub.studioNav,
      portal: pub.portal,
      updatedAt: pub.updatedAt,
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = patchSchema.parse(await req.json());
    const data: Record<string, unknown> = {};

    if (body.uiCopy?.compose) {
      data.uiCopyJson = stringifyUiCopy({
        compose: {
          ...DEFAULT_UI_COPY.compose,
          ...body.uiCopy.compose,
        },
      });
    }

    if (body.orderForm) {
      const fields = (body.orderForm.fields || []).map((f) => ({
        id: f.id,
        label: f.label.trim(),
        placeholder: (f.placeholder || "").trim(),
        type: f.type as OrderFormFieldType,
        required: f.required,
        options: (f.options || []).map((o) => o.trim()).filter(Boolean),
      }));
      data.orderFormJson = stringifyOrderForm({
        enabled:
          body.orderForm.enabled ??
          (fields.length > 0 ? true : DEFAULT_ORDER_FORM.enabled),
        title: (body.orderForm.title || DEFAULT_ORDER_FORM.title).trim(),
        fields,
      });
    }

    if (body.studioNav) {
      data.studioNavJson = stringifyStudioNav({
        topBase: body.studioNav.topBase || DEFAULT_STUDIO_NAV.topBase,
        topAdmin: body.studioNav.topAdmin || DEFAULT_STUDIO_NAV.topAdmin,
        courses: body.studioNav.courses || DEFAULT_STUDIO_NAV.courses,
      });
    }

    if (body.portal) {
      data.portalJson = stringifyPortal({
        nav: body.portal.nav || DEFAULT_PORTAL.nav,
        company: {
          ...DEFAULT_PORTAL.company,
          ...(body.portal.company || {}),
          highlights:
            body.portal.company?.highlights || DEFAULT_PORTAL.company.highlights,
        },
        person: {
          ...DEFAULT_PORTAL.person,
          ...(body.portal.person || {}),
          highlights:
            body.portal.person?.highlights || DEFAULT_PORTAL.person.highlights,
        },
      });
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "没有可保存的内容" }, { status: 400 });
    }

    const row = await prisma.siteSettings.update({
      where: { id: "default" },
      data,
    });
    invalidateSiteSettingsCache();
    const pub = publicSiteSettings(row);
    return NextResponse.json({
      uiCopy: pub.uiCopy,
      orderForm: pub.orderForm,
      studioNav: pub.studioNav,
      portal: pub.portal,
      updatedAt: pub.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
