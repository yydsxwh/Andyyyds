import { AuthForm } from "@/components/auth-form";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="container py-16">
      <AuthForm mode="register" />
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        已有账号？ <Link href="/login" className="text-[var(--brand)]">去登录</Link>
      </p>
    </div>
  );
}
