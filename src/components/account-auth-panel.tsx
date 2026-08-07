"use client";

/**
 * 个人中心「账号安全」：绑定唯一邮箱 / 手机号 / 微信，三种方式登录同一账号。
 * 微信/手机自动注册使用占位邮箱时，须绑定真实邮箱并设密码后才能邮箱登录。
 */

import { useEffect, useState } from "react";
import { isPlaceholderEmail } from "@/lib/auth-email";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { isWeChatBrowser } from "@/lib/wechat-env";

type Props = {
  email: string;
  phone: string;
  hasWechat: boolean;
  /** 是否已设置过可用登录密码（手机/微信自动注册可能为 false） */
  passwordSet?: boolean;
};

export function AccountAuthPanel({
  email,
  phone,
  hasWechat,
  passwordSet = true,
}: Props) {
  const initialHasRealEmail = Boolean(email) && !isPlaceholderEmail(email);
  const [currentEmail, setCurrentEmail] = useState(
    initialHasRealEmail ? email : "",
  );
  const [hasRealEmail, setHasRealEmail] = useState(initialHasRealEmail);
  const [currentPhone, setCurrentPhone] = useState(phone);
  const [boundWechat, setBoundWechat] = useState(hasWechat);
  const [hasPassword, setHasPassword] = useState(passwordSet);
  const [smsReady, setSmsReady] = useState(false);
  const [wechatReady, setWechatReady] = useState(false);
  const [inWeChat, setInWeChat] = useState(false);
  const [showBindPhone, setShowBindPhone] = useState(false);
  const [showBindEmail, setShowBindEmail] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bindEmail, setBindEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailConfirmPassword, setEmailConfirmPassword] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [bindPhone, setBindPhone] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setInWeChat(isWeChatBrowser());
    fetch("/api/auth/methods")
      .then((r) => r.json())
      .then((data) => {
        setSmsReady(Boolean(data.phone));
        setWechatReady(Boolean(data.wechat));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("wechat_oauth") === "ok") {
      setBoundWechat(true);
      setNotice("微信绑定成功");
    } else if (params.get("wechat_oauth") === "error") {
      setError(params.get("msg") || "微信绑定失败");
    }
  }, []);

  async function sendCode() {
    setError("");
    setNotice("");
    if (!bindPhone.trim()) {
      setError("请先填写手机号");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: bindPhone, purpose: "bind" }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "验证码发送失败");
      return;
    }
    setCooldown(Number(data.cooldownSec) || 60);
    setNotice(
      data.testMode
        ? "测试模式：请查看服务器日志中的验证码，或使用固定测试码"
        : "验证码已发送",
    );
  }

  async function onBindPhone(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/auth/phone/bind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: bindPhone, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "绑定失败");
      return;
    }
    setCurrentPhone(normalizePhone(bindPhone));
    setShowBindPhone(false);
    setCode("");
    setNotice("手机号绑定成功，可用验证码登录同一账号");
  }

  async function onBindEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: bindEmail,
        // 未设密码时一并设置；已有真实邮箱更换时校验当前密码
        password: !hasPassword ? emailPassword : undefined,
        confirmPassword: !hasPassword ? emailConfirmPassword : undefined,
        currentPassword: hasRealEmail ? emailCurrentPassword : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "绑定失败");
      return;
    }
    const nextEmail = String(data.email || bindEmail).trim().toLowerCase();
    setCurrentEmail(nextEmail);
    setHasRealEmail(true);
    if (data.passwordSet) setHasPassword(true);
    setShowBindEmail(false);
    setBindEmail("");
    setEmailPassword("");
    setEmailConfirmPassword("");
    setEmailCurrentPassword("");
    setNotice(data.message || "邮箱已绑定");
  }

  function startWechatBind() {
    setError("");
    if (!inWeChat) {
      setError("请在微信内打开本站后再绑定微信");
      return;
    }
    if (!wechatReady) {
      setError("微信登录未配置，请联系站长填写 AppSecret");
      return;
    }
    window.location.href =
      "/api/auth/wechat?purpose=bind&returnUrl=/account";
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword,
        confirmPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "修改密码失败");
      return;
    }
    setHasPassword(true);
    setShowPasswordForm(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNotice(data.message || "密码已更新");
  }

  return (
    <section className="surface rounded-[28px] p-5 sm:p-6">
      <h2 className="text-lg font-semibold">账号安全</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        绑定唯一邮箱与手机号后，可用邮箱密码、手机验证码或微信登录同一账号。
      </p>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs text-[var(--muted)]">登录邮箱</div>
            <div className="mt-0.5 break-all text-sm font-medium">
              {hasRealEmail ? currentEmail : "未绑定"}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary min-h-10 shrink-0 px-3 text-sm"
            onClick={() => {
              setShowBindEmail((v) => !v);
              setShowPasswordForm(false);
              setError("");
              setNotice("");
            }}
          >
            {showBindEmail ? "取消" : hasRealEmail ? "更换邮箱" : "绑定邮箱"}
          </button>
        </div>

        {showBindEmail ? (
          <form
            onSubmit={onBindEmail}
            className="space-y-3 rounded-2xl bg-[var(--bg-deep)]/40 p-4"
          >
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">邮箱</span>
              <input
                className="field w-full"
                type="email"
                autoComplete="email"
                value={bindEmail}
                onChange={(e) => setBindEmail(e.target.value)}
                required
                placeholder="用于登录的真实邮箱"
              />
            </label>
            {hasRealEmail ? (
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">当前密码</span>
                <input
                  className="field w-full"
                  type="password"
                  autoComplete="current-password"
                  value={emailCurrentPassword}
                  onChange={(e) => setEmailCurrentPassword(e.target.value)}
                  required
                  placeholder="验证身份后更换邮箱"
                />
              </label>
            ) : null}
            {!hasPassword ? (
              <>
                <p className="text-sm text-[var(--muted)]">
                  微信/手机注册尚未设置密码，绑定邮箱时请一并设置登录密码。
                </p>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">
                    登录密码
                  </span>
                  <input
                    className="field w-full"
                    type="password"
                    autoComplete="new-password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="至少 6 位"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">
                    确认密码
                  </span>
                  <input
                    className="field w-full"
                    type="password"
                    autoComplete="new-password"
                    value={emailConfirmPassword}
                    onChange={(e) => setEmailConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="再输入一次"
                  />
                </label>
              </>
            ) : null}
            <button
              type="submit"
              className="btn btn-primary w-full min-h-11"
              disabled={loading}
            >
              {loading ? "提交中…" : hasRealEmail ? "确认更换" : "确认绑定"}
            </button>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-4 py-3">
          <div>
            <div className="text-xs text-[var(--muted)]">登录密码</div>
            <div className="mt-0.5 text-sm font-medium">
              {hasPassword ? "已设置" : "未设置（手机/微信注册）"}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary min-h-10 px-3 text-sm"
            onClick={() => {
              setShowPasswordForm((v) => !v);
              setShowBindEmail(false);
              setError("");
              setNotice("");
            }}
          >
            {showPasswordForm ? "取消" : hasPassword ? "修改密码" : "设置密码"}
          </button>
        </div>

        {showPasswordForm ? (
          <form
            onSubmit={onChangePassword}
            className="space-y-3 rounded-2xl bg-[var(--bg-deep)]/40 p-4"
          >
            {hasPassword ? (
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">当前密码</span>
                <input
                  className="field w-full"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="请输入当前密码"
                />
              </label>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                尚未设置登录密码。若还没有真实邮箱，请优先使用上方「绑定邮箱」一并设置。
              </p>
            )}
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">新密码</span>
              <input
                className="field w-full"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="至少 6 位"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">确认新密码</span>
              <input
                className="field w-full"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="再输入一次"
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary w-full min-h-11"
              disabled={loading}
            >
              {loading ? "提交中…" : hasPassword ? "确认修改" : "确认设置"}
            </button>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-4 py-3">
          <div>
            <div className="text-xs text-[var(--muted)]">手机号</div>
            <div className="mt-0.5 text-sm font-medium">
              {currentPhone ? maskPhone(currentPhone) : "未绑定"}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary min-h-10 px-3 text-sm"
            disabled={!smsReady}
            onClick={() => setShowBindPhone((v) => !v)}
          >
            {showBindPhone ? "取消" : currentPhone ? "更换" : "绑定手机号"}
          </button>
        </div>

        {showBindPhone ? (
          <form
            onSubmit={onBindPhone}
            className="space-y-3 rounded-2xl bg-[var(--bg-deep)]/40 p-4"
          >
            {!smsReady ? (
              <p className="text-sm text-[var(--muted)]">
                站长尚未启用短信，暂时无法绑定手机号。
              </p>
            ) : (
              <>
                <input
                  className="field"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="手机号"
                  value={bindPhone}
                  onChange={(e) => setBindPhone(e.target.value)}
                  required
                />
                <div className="flex gap-2">
                  <input
                    className="field min-w-0 flex-1"
                    inputMode="numeric"
                    placeholder="短信验证码"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-secondary shrink-0 min-h-11 px-3 text-sm"
                    disabled={loading || cooldown > 0}
                    onClick={sendCode}
                  >
                    {cooldown > 0 ? `${cooldown}s` : "获取验证码"}
                  </button>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary w-full min-h-11"
                  disabled={loading}
                >
                  {loading ? "提交中…" : "确认绑定"}
                </button>
              </>
            )}
          </form>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-4 py-3">
          <div>
            <div className="text-xs text-[var(--muted)]">微信</div>
            <div className="mt-0.5 text-sm font-medium">
              {boundWechat ? "已绑定" : "未绑定"}
            </div>
          </div>
          {!boundWechat ? (
            <button
              type="button"
              className="btn btn-secondary min-h-10 px-3 text-sm"
              disabled={!wechatReady}
              onClick={startWechatBind}
            >
              绑定微信
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {notice ? (
        <p className="mt-3 text-sm text-[var(--brand-strong)]">{notice}</p>
      ) : null}
    </section>
  );
}
