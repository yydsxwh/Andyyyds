import { AuthForm } from "@/components/auth-form";
import { preferWechatFromAcceptLanguage } from "@/lib/auth-channel-preference";
import { headers } from "next/headers";
import Link from "next/link";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
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
        <Link href="/login" className="text-[var(--brand)]">
          去登录
        </Link>
      </p>
    </div>
  );
}
