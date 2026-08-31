import { AuthForm } from "@/components/auth-form";
import { preferWechatFromAcceptLanguage } from "@andyyyds/shared/auth-channel-preference";
import { headers } from "next/headers";
import Link from "next/link";

function registerHref(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/register";
  }
  return `/register?next=${encodeURIComponent(next)}`;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
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
    </div>
  );
}
