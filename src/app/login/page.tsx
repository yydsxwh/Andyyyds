import { AuthForm } from "@/components/auth-form";
import { preferWechatFromAcceptLanguage } from "@/lib/auth-channel-preference";
import { headers } from "next/headers";
import Link from "next/link";

export default async function LoginPage() {
  const headerList = await headers();
  const preferWechat = preferWechatFromAcceptLanguage(
    headerList.get("accept-language"),
  );

  return (
    <div className="container py-16">
      <AuthForm mode="login" preferWechatDefault={preferWechat} />
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        还没有账号？{" "}
        <Link href="/register" className="text-[var(--brand)]">
          去注册
        </Link>
      </p>
    </div>
  );
}
