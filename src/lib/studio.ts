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

export function studioErrorResponse(error: unknown) {
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
  return { status: 400 as const, error: "请求失败" };
}
