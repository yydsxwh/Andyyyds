import { z } from "zod";
import { getSession, type SessionUser } from "./auth";
import { prisma } from "./db";
import {
  canAccessStudio,
  canCreateSellableProducts,
  canManageCourses,
  isAdmin,
} from "./roles";

export async function requireStudioUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (!canAccessStudio(session)) {
    throw new Error("FORBIDDEN");
  }
  // 角色申请待审核期间即使 JWT/角色异常，也不开放后台特权
  if (session.rolePending) {
    throw new Error("ROLE_PENDING");
  }
  if (isAdmin(session)) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { merchant: true },
  });
  if (!user || !canAccessStudio({ role: user.role, roles: user.roles })) {
    throw new Error("FORBIDDEN");
  }
  // 已建档商家必须以「已入驻」才能进后台（停用立即生效）；加盟代理同理
  if (user.merchant && user.merchant.status !== "APPROVED") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

/** 需要课程/素材权限的接口（不含纯分销的加盟代理） */
export async function requireCourseStudioUser(): Promise<SessionUser> {
  const session = await requireStudioUser();
  if (!canManageCourses(session)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

/** 新建可售课程/专栏/商品（站长、入驻商家、加盟代理） */
export async function requireCreateSellableUser(): Promise<SessionUser> {
  const session = await requireStudioUser();
  if (!canCreateSellableProducts(session)) {
    throw new Error("CREATE_FORBIDDEN");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (!isAdmin(session)) {
    throw new Error("ADMIN_ONLY");
  }
  return session;
}

const FIELD_LABELS: Record<string, string> = {
  title: "标题",
  subtitle: "副标题",
  description: "产品介绍",
  price: "价格",
  assetIds: "素材",
  productType: "产品类型",
  coverUrl: "封面",
  name: "名称",
};

function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "参数无效";
  const field = issue.path.map(String).join(".");
  const label = FIELD_LABELS[field] || (field ? field : "参数");

  if (issue.code === "too_small") {
    const minimum = "minimum" in issue ? Number(issue.minimum) : undefined;
    if (field === "assetIds") return "请至少选择 1 个素材";
    if (typeof minimum === "number") {
      if (issue.origin === "string") {
        return `${label}至少需要 ${minimum} 个字`;
      }
      return `${label}不能小于 ${minimum}`;
    }
    return `${label}过短`;
  }
  if (issue.code === "too_big") {
    const maximum = "maximum" in issue ? Number(issue.maximum) : undefined;
    if (typeof maximum === "number" && issue.origin === "string") {
      return `${label}不能超过 ${maximum} 个字`;
    }
    return `${label}过长`;
  }
  if (issue.code === "invalid_type") {
    return `${label}格式不正确`;
  }
  return `${label}无效`;
}

export function studioErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return { status: 400 as const, error: formatZodError(error) };
  }

  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") {
    return { status: 401 as const, error: "请先登录" };
  }
  if (message === "FORBIDDEN") {
    return { status: 403 as const, error: "仅创作者可操作" };
  }
  if (message === "ROLE_PENDING") {
    return { status: 403 as const, error: "账号待站长审核" };
  }
  if (message === "CREATE_FORBIDDEN") {
    return {
      status: 403 as const,
      error: "仅入驻商家、加盟代理与站长可新建课程、专栏或商品",
    };
  }
  if (message === "ADMIN_ONLY") {
    return { status: 403 as const, error: "仅站长可操作" };
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  ) {
    return { status: 400 as const, error: "已存在相同内容，请修改标题后重试" };
  }

  console.error("[studio]", error);

  // 把 Prisma / 运行时错误露出可读信息，避免前端只显示「请求失败」
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = String((error as { code: string }).code);
    const meta = (error as { meta?: { target?: string[] | string } }).meta;
    if (code === "P2003") {
      return { status: 400 as const, error: "关联数据无效，请刷新后重试" };
    }
    if (code.startsWith("P")) {
      const target = Array.isArray(meta?.target)
        ? meta.target.join(",")
        : meta?.target || "";
      return {
        status: 400 as const,
        error: target ? `数据写入失败（${code}:${target}）` : `数据写入失败（${code}）`,
      };
    }
  }

  if (error instanceof Error && error.message && error.message !== "UNKNOWN") {
    const msg = error.message.slice(0, 180);
    // FormData 截断（middleware/proxy 默认 10MB）时 body 损坏，给可操作提示
    if (/Failed to parse body as FormData|Unexpected end of form|formdata/i.test(msg)) {
      return {
        status: 400 as const,
        error: "上传内容过大或被网关截断，请改用直传或缩小文件后重试",
      };
    }
    if (/body.*exceed|Payload Too Large|entity too large|413/i.test(msg)) {
      return {
        status: 413 as const,
        error: "文件过大，请使用云直传通道或缩小后重试",
      };
    }
    if (/Cannot find module|ENOENT|EACCES|SQLITE/i.test(msg)) {
      return { status: 500 as const, error: `服务异常：${msg}` };
    }
    // 业务/存储抛出的中文或短英文错误直接回传，避免前端只看到「请求失败」
    if (
      /[\u4e00-\u9fff]/.test(msg) ||
      /^(点播|OSS|上传|文件|分类|参数|请)/.test(msg)
    ) {
      return { status: 400 as const, error: msg };
    }
  }

  return { status: 400 as const, error: "请求失败，请稍后重试" };
}
