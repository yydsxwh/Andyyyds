import { AuthForm } from "@/components/auth-form";
import { preferWechatFromAcceptLanguage } from "@andyyyds/shared/auth-channel-preference";
import { isAccountOidcConfigured } from "@andyyyds/shared/account-oidc";
import { getSession } from "@andyyyds/shared/auth";
import { safeNextPath } from "@andyyyds/shared/safe-next-path";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

function loginHref(next: string) {
  if (next === "/") return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}

function startHref(next: string, ref: string) {
  const url = new URL("/api/auth/account/start", "http://localhost");
  url.searchParams.set("mode", "register");
  url.searchParams.set("next", next);
  if (ref) url.searchParams.set("ref", ref);
  return `${url.pathname}${url.search}`;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const ref = params.ref?.trim() || "";
  const session = await getSession();
  if (session) redirect(next);

  if (isAccountOidcConfigured()) {
    const error = (params.error || "").trim();
    if (!error) {
      redirect(startHref(next, ref));
    }
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">注册未完成</h1>
          <p className="text-sm text-[var(--muted)]">{error}</p>
          <Link href={startHref(next, ref)} className="btn btn-primary">
            重新注册
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
      <AuthForm
        mode="register"
        defaultReferralCode={ref}
        preferWechatDefault={preferWechat}
      />
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        已有账号？{" "}
        <Link href={loginHref(next)} className="text-[var(--brand)]">
          去登录
        </Link>
      </p>
    </div>
  );
}
