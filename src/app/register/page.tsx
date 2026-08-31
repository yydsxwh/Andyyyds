import { AuthForm } from "@/components/auth-form";
import { preferWechatFromAcceptLanguage } from "@andyyyds/shared/auth-channel-preference";
import { headers } from "next/headers";
import Link from "next/link";

function loginHref(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/login";
  }
  return `/login?next=${encodeURIComponent(next)}`;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; next?: string }>;
}) {
  const params = await searchParams;
  const ref = params.ref?.trim() || "";
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
        <Link href={loginHref(params.next)} className="text-[var(--brand)]">
          去登录
        </Link>
      </p>
    </div>
  );
}
