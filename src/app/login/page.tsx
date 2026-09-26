import { AuthForm } from "@/components/auth-form";
import { preferWechatFromAcceptLanguage } from "@andyyyds/shared/auth-channel-preference";
import { ACCOUNT_CENTER_HREF } from "@andyyyds/shared/portal";
import { isAccountOidcConfigured } from "@andyyyds/shared/account-oidc";
import { getSession } from "@andyyyds/shared/auth";
import { safeNextPath } from "@andyyyds/shared/safe-next-path";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

function registerHref(next: string) {
  if (next === "/") return "/register";
  return `/register?next=${encodeURIComponent(next)}`;
}

function startHref(mode: "login" | "register", next: string) {
  const url = new URL(
    `/api/auth/account/start`,
    "http://localhost",
  );
  url.searchParams.set("mode", mode);
  url.searchParams.set("next", next);
  return `${url.pathname}${url.search}`;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const session = await getSession();
  if (session) redirect(next);

  if (isAccountOidcConfigured()) {
    const error = (params.error || "").trim();
    if (!error) {
      redirect(startHref("login", next));
    }
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">登录未完成</h1>
          <p className="text-sm text-[var(--muted)]">{error}</p>
          <Link href={startHref("login", next)} className="btn btn-primary">
            重新登录
          </Link>
        </div>
      </div>
    );
  }

  const headerList = await headers();
  const preferWechat = preferWechatFromAcceptLanguage(
    headerList.get("accept-language"),
  );

  return (
    <div className="container py-16">
      <AuthForm mode="login" preferWechatDefault={preferWechat} />
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        还没有账号？{" "}
        <Link href={registerHref(next)} className="text-[var(--brand)]">
          去注册
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-[var(--muted)]">
        也可前往{" "}
        <Link href={ACCOUNT_CENTER_HREF} className="text-[var(--brand)]">
          打开账号中心
        </Link>
      </p>
    </div>
  );
}
