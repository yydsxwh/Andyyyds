import { AuthForm } from "@/components/auth-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="container py-16">
      <AuthForm mode="login" />
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        还没有账号？ <Link href="/register" className="text-[var(--brand)]">去注册</Link>
      </p>
    </div>
  );
}
