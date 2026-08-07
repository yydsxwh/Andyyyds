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
import {
  DEFAULT_HOME_SECTION_ORDER,
  DEFAULT_PORTAL,
  DEFAULT_PORTAL_CONTACT,
  HOME_SECTION_IDS,
  normalizeHomeSectionOrder,
  parsePortal,
  stringifyPortal,
} from "@/lib/portal";
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
            /** 停用字段不下发前台，配置仍保留 */
            enabled: z.boolean().optional(),
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
      contact: z
        .object({
          enabled: z.boolean().optional(),
          linkLabel: z.string().max(20).optional(),
          title: z.string().max(40).optional(),
          phone: z.string().max(40).optional(),
          wechat: z.string().max(60).optional(),
          qq: z.string().max(40).optional(),
          wechatMp: z.string().max(60).optional(),
          xiaohongshu: z.string().max(60).optional(),
          douyin: z.string().max(60).optional(),
          bilibili: z.string().max(60).optional(),
          email: z.string().max(120).optional(),
          address: z.string().max(200).optional(),
          hours: z.string().max(80).optional(),
          note: z.string().max(2000).optional(),
        })
        .optional(),
      // 首页区块顺序 + 显隐；兼容旧客户端只传 id 字符串数组
      homeSectionOrder: z
        .array(
          z.union([
            z.enum(["contact", "hero", "banners", "portal", "courses"]),
            z.object({
              id: z.enum(["contact", "hero", "banners", "portal", "courses"]),
              // 缺省视为显示，与 normalizeHomeSectionOrder 旧配置兼容策略一致
              visible: z.boolean().optional(),
            }),
          ]),
        )
        .max(HOME_SECTION_IDS.length)
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
        // 缺省启用：兼容旧 CMS 未传 enabled 的保存请求
        enabled: f.enabled !== false,
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
      // 分区保存只带 nav / company / person / contact / homeSectionOrder 之一时，其余沿用库内配置
      const currentPortal = parsePortal(
        (await getSiteSettings()).portalJson,
      );
      data.portalJson = stringifyPortal({
        nav: body.portal.nav ?? currentPortal.nav,
        company: body.portal.company
          ? {
              ...DEFAULT_PORTAL.company,
              ...currentPortal.company,
              ...body.portal.company,
              highlights:
                body.portal.company.highlights ??
                currentPortal.company.highlights,
            }
          : currentPortal.company,
        person: body.portal.person
          ? {
              ...DEFAULT_PORTAL.person,
              ...currentPortal.person,
              ...body.portal.person,
              highlights:
                body.portal.person.highlights ??
                currentPortal.person.highlights,
            }
          : currentPortal.person,
        contact: body.portal.contact
          ? {
              ...DEFAULT_PORTAL_CONTACT,
              ...currentPortal.contact,
              ...body.portal.contact,
            }
          : currentPortal.contact,
        homeSectionOrder:
          body.portal.homeSectionOrder !== undefined
            ? normalizeHomeSectionOrder(body.portal.homeSectionOrder)
            : normalizeHomeSectionOrder(
                currentPortal.homeSectionOrder?.length
                  ? currentPortal.homeSectionOrder
                  : DEFAULT_HOME_SECTION_ORDER,
              ),
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
