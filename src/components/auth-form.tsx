"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "操作失败");
      return;
    }
    router.push(mode === "login" ? "/learn" : "/courses");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="surface mx-auto w-full max-w-md space-y-4 rounded-[28px] p-8">
      <div>
        <h1 className="brand-mark text-3xl text-[var(--brand)]">
          {mode === "login" ? "欢迎回来" : "创建账号"}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {mode === "login"
            ? "登录后继续学习、下单和管理课程。"
            : "注册成为学员，也可稍后升级为创作者。"}
        </p>
      </div>
      {mode === "register" ? (
        <input className="field" name="name" placeholder="昵称" required />
      ) : null}
      <input className="field" type="email" name="email" placeholder="邮箱" required />
      <input
        className="field"
        type="password"
        name="password"
        placeholder="密码（至少 6 位）"
        minLength={6}
        required
      />
      {mode === "register" ? (
        <input className="field" name="referralCode" placeholder="邀请码（可选）" />
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="btn btn-primary w-full" disabled={loading} type="submit">
        {loading ? "提交中..." : mode === "login" ? "登录" : "注册"}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        演示账号：student@yyds.local / 123456
      </p>
    </form>
  );
}
