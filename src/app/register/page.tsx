import { AuthForm } from "@/components/auth-form";
import Link from "next/link";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const ref = params.ref?.trim() || "";

  return (
    <div className="container py-16">
      <AuthForm mode="register" defaultReferralCode={ref} />
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        已有账号？ <Link href="/login" className="text-[var(--brand)]">去登录</Link>
      </p>
    </div>
  );
}
