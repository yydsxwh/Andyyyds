import { z } from "zod";
import { getSession, type SessionUser } from "./auth";
import { prisma } from "./db";

export async function requireStudioUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (session.role === "ADMIN") return session;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { merchant: true },
  });
  if (!user || user.role !== "TEACHER") {
    throw new Error("FORBIDDEN");
  }
  // 已建档商家必须以「已入驻」才能进入创作者后台（停用立即生效）
  if (user.merchant && user.merchant.status !== "APPROVED") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (session.role !== "ADMIN") {
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
    if (/Cannot find module|ENOENT|EACCES|SQLITE/i.test(msg)) {
      return { status: 500 as const, error: `服务异常：${msg}` };
    }
  }

  return { status: 400 as const, error: "请求失败，请稍后重试" };
}
