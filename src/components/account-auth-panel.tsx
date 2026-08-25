"use client";

/**
 * 个人中心「账号安全」：绑定登录账号 / 邮箱 / 手机号 / 微信，四种方式登录同一用户。
 * 任一方式注册后，在此补绑其余方式即可合并到同一账号（占用他人身份则拒绝）。
 */

import { useEffect, useState } from "react";
import { isPlaceholderEmail } from "@/lib/auth-email";
import { maskPhone, normalizePhone } from "@/lib/phone";
import {
  isCapacitorAndroid,
  isWeChatBrowser,
} from "@/lib/wechat-env";
import { WechatLogin } from "@/lib/wechat-login-plugin";

type Props = {
  username?: string | null;
  email: string;
  phone: string;
  hasWechatOa?: boolean;
  hasWechatWeb?: boolean;
  hasWechatMobile?: boolean;
  /** 是否已设置过可用登录密码（手机/微信自动注册可能为 false） */
  passwordSet?: boolean;
};

export function AccountAuthPanel({
  username = "",
  email,
  phone,
  hasWechatOa = false,
  hasWechatWeb = false,
  hasWechatMobile = false,
  passwordSet = true,
}: Props) {
  const initialHasRealEmail = Boolean(email) && !isPlaceholderEmail(email);
  const [currentUsername, setCurrentUsername] = useState(
    (username || "").trim(),
  );
  const [currentEmail, setCurrentEmail] = useState(
    initialHasRealEmail ? email : "",
  );
  const [hasRealEmail, setHasRealEmail] = useState(initialHasRealEmail);
  const [currentPhone, setCurrentPhone] = useState(phone);
  const [boundWechatOa, setBoundWechatOa] = useState(hasWechatOa);
  const [boundWechatWeb, setBoundWechatWeb] = useState(hasWechatWeb);
  const [boundWechatMobile, setBoundWechatMobile] = useState(hasWechatMobile);
  const [hasPassword, setHasPassword] = useState(passwordSet);
  const [smsReady, setSmsReady] = useState(false);
  const [wechatReady, setWechatReady] = useState(false);
  const [wechatQrReady, setWechatQrReady] = useState(false);
  const [wechatMobileReady, setWechatMobileReady] = useState(false);
  const [wechatMobileAppId, setWechatMobileAppId] = useState("");
  const [inWeChat, setInWeChat] = useState(false);
  const [inCapacitorAndroid, setInCapacitorAndroid] = useState(false);
  const [showBindUsername, setShowBindUsername] = useState(false);
  const [showBindPhone, setShowBindPhone] = useState(false);
  const [showBindEmail, setShowBindEmail] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bindUsername, setBindUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [usernameConfirmPassword, setUsernameConfirmPassword] = useState("");
  const [usernameCurrentPassword, setUsernameCurrentPassword] = useState("");
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

  const boundWechat = boundWechatOa || boundWechatWeb || boundWechatMobile;
  const hasUsername = Boolean(currentUsername);

  function closeOtherForms(
    keep: "username" | "email" | "password" | "phone" | null,
  ) {
    setShowBindUsername(keep === "username");
    setShowBindEmail(keep === "email");
    setShowPasswordForm(keep === "password");
    setShowBindPhone(keep === "phone");
    setError("");
    setNotice("");
  }

  useEffect(() => {
    setInWeChat(isWeChatBrowser());
    setInCapacitorAndroid(isCapacitorAndroid());
    fetch("/api/auth/methods")
      .then((r) => r.json())
      .then((data) => {
        setSmsReady(Boolean(data.phone));
        setWechatReady(Boolean(data.wechat));
        setWechatQrReady(Boolean(data.wechatQr));
        setWechatMobileReady(Boolean(data.wechatMobile));
        setWechatMobileAppId(String(data.wechatMobileAppId || ""));
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
    if (params.get("wechat_oauth") === "ok" || params.get("wechat_login") === "ok") {
      // 绑定回调后刷新状态；OA / 扫码均可能写入
      setBoundWechatOa(true);
      setBoundWechatWeb(true);
      setNotice("微信绑定成功，可用微信登录同一账号");
    } else if (
      params.get("wechat_oauth") === "error" ||
      params.get("wechat_login") === "error"
    ) {
      setError(params.get("msg") || "微信绑定失败");
    }
  }, []);

  async function startWechatBindMobile() {
    setError("");
    setNotice("");
    if (!wechatMobileReady || !wechatMobileAppId) {
      setError(
        "微信快捷绑定未配置，请联系站长填写开放平台「移动应用」AppID / AppSecret",
      );
      return;
    }
    setLoading(true);
    try {
      const installed = await WechatLogin.isInstalled();
      if (!installed.installed) {
        setError("未检测到微信，请先安装微信后再试");
        setLoading(false);
        return;
      }
      const { code } = await WechatLogin.login({ appId: wechatMobileAppId });
      if (!code) {
        setError("微信授权未返回凭证，请重试");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/auth/wechat/mobile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          purpose: "bind",
          returnUrl: "/account",
        }),
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(data.error || "微信绑定失败");
        return;
      }
      setBoundWechatMobile(true);
      setNotice("微信绑定成功，可用 App 内微信快捷登录同一账号");
    } catch (err) {
      setLoading(false);
      const message =
        err instanceof Error ? err.message : "微信绑定已取消或失败";
      setError(message);
    }
  }

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

  async function onBindUsername(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/account/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: bindUsername,
        password: !hasPassword ? usernamePassword : undefined,
        confirmPassword: !hasPassword ? usernameConfirmPassword : undefined,
        currentPassword: hasUsername ? usernameCurrentPassword : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "绑定失败");
      return;
    }
    setCurrentUsername(String(data.username || bindUsername).trim());
    if (data.passwordSet) setHasPassword(true);
    setShowBindUsername(false);
    setBindUsername("");
    setUsernamePassword("");
    setUsernameConfirmPassword("");
    setUsernameCurrentPassword("");
    setNotice(data.message || "登录账号已绑定");
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

  function startWechatBindOa() {
    setError("");
    if (!inWeChat) {
      setError("请在微信内打开本站后再绑定微信，或使用下方扫码绑定（若已开通）");
      return;
    }
    if (!wechatReady) {
      setError("微信登录未配置，请联系站长填写公众号 AppSecret");
      return;
    }
    window.location.href =
      "/api/auth/wechat?purpose=bind&returnUrl=/account";
  }

  function startWechatBindQr() {
    setError("");
    if (inWeChat) {
      setError("当前已在微信内，请使用「微信授权绑定」");
      return;
    }
    if (!wechatQrReady) {
      setError(
        "电脑扫码绑定尚未开通（需开放平台网站应用）。请用手机微信打开本站后绑定。",
      );
      return;
    }
    window.location.href =
      "/api/auth/wechat/qr?purpose=bind&returnUrl=/account";
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
        四种登录方式可绑定到同一账号：登录账号、邮箱、手机号、微信。用任意一种注册后，在此补绑其余方式即可互通。
      </p>

      <div className="mt-4 space-y-3">
        {/* —— 登录账号 —— */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs text-[var(--muted)]">登录账号</div>
            <div className="mt-0.5 break-all text-sm font-medium">
              {hasUsername ? currentUsername : "未绑定"}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary min-h-10 shrink-0 px-3 text-sm"
            onClick={() =>
              closeOtherForms(showBindUsername ? null : "username")
            }
          >
            {showBindUsername ? "取消" : hasUsername ? "更换账号" : "绑定账号"}
          </button>
        </div>

        {showBindUsername ? (
          <form
            onSubmit={onBindUsername}
            className="space-y-3 rounded-2xl bg-[var(--bg-deep)]/40 p-4"
          >
            <p className="text-xs leading-5 text-[var(--muted)]">
              4–20 位，小写字母开头，仅含字母、数字、下划线（与邮箱不是同一种登录方式）。
            </p>
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">登录账号</span>
              <input
                className="field w-full"
                name="username"
                autoComplete="username"
                spellCheck={false}
                value={bindUsername}
                onChange={(e) => setBindUsername(e.target.value)}
                required
                placeholder="例如 xiaoming01"
              />
            </label>
            {hasUsername ? (
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">当前密码</span>
                <input
                  className="field w-full"
                  type="password"
                  autoComplete="current-password"
                  value={usernameCurrentPassword}
                  onChange={(e) => setUsernameCurrentPassword(e.target.value)}
                  required
                  placeholder="验证身份后更换登录账号"
                />
              </label>
            ) : null}
            {!hasPassword ? (
              <>
                <p className="text-sm text-[var(--muted)]">
                  尚未设置密码，绑定登录账号时请一并设置。
                </p>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">
                    登录密码
                  </span>
                  <input
                    className="field w-full"
                    type="password"
                    autoComplete="new-password"
                    value={usernamePassword}
                    onChange={(e) => setUsernamePassword(e.target.value)}
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
                    value={usernameConfirmPassword}
                    onChange={(e) => setUsernameConfirmPassword(e.target.value)}
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
              {loading ? "提交中…" : hasUsername ? "确认更换" : "确认绑定"}
            </button>
          </form>
        ) : null}

        {/* —— 邮箱 —— */}
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
            onClick={() => closeOtherForms(showBindEmail ? null : "email")}
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
                  尚未设置密码，绑定邮箱时请一并设置登录密码。
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

        {/* —— 密码 —— */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-4 py-3">
          <div>
            <div className="text-xs text-[var(--muted)]">登录密码</div>
            <div className="mt-0.5 text-sm font-medium">
              {hasPassword ? "已设置" : "未设置（可用绑定账号/邮箱时一并设置）"}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary min-h-10 px-3 text-sm"
            onClick={() =>
              closeOtherForms(showPasswordForm ? null : "password")
            }
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
                尚未设置登录密码。也可在上方「绑定账号」或「绑定邮箱」时一并设置。
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

        {/* —— 手机 —— */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-4 py-3">
          <div>
            <div className="text-xs text-[var(--muted)]">手机号</div>
            <div className="mt-0.5 text-sm font-medium">
              {currentPhone ? maskPhone(currentPhone) : "未绑定"}
            </div>
            {!smsReady ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                站长尚未启用短信，暂不可绑定
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-secondary min-h-10 px-3 text-sm"
            disabled={!smsReady}
            onClick={() => closeOtherForms(showBindPhone ? null : "phone")}
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

        {/* —— 微信 —— */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-4 py-3">
          <div>
            <div className="text-xs text-[var(--muted)]">微信</div>
            <div className="mt-0.5 text-sm font-medium">
              {boundWechat ? "已绑定" : "未绑定"}
            </div>
            {!boundWechat ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {inCapacitorAndroid && wechatMobileReady
                  ? "可在本 App 内一键调起微信绑定"
                  : inWeChat
                    ? "微信内可一键授权绑定"
                    : wechatQrReady
                      ? "可用扫码绑定，或手机微信内打开本站绑定"
                      : "请用手机微信打开本站后绑定（电脑扫码暂未开通）"}
              </p>
            ) : null}
          </div>
          {!boundWechat ? (
            <div className="flex flex-wrap gap-2">
              {inCapacitorAndroid && wechatMobileReady ? (
                <button
                  type="button"
                  className="btn btn-secondary min-h-10 px-3 text-sm"
                  disabled={loading}
                  onClick={() => void startWechatBindMobile()}
                >
                  {loading ? "打开微信…" : "微信快捷绑定"}
                </button>
              ) : inWeChat ? (
                <button
                  type="button"
                  className="btn btn-secondary min-h-10 px-3 text-sm"
                  disabled={!wechatReady}
                  onClick={startWechatBindOa}
                >
                  微信授权绑定
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-10 px-3 text-sm"
                    disabled={!wechatQrReady}
                    onClick={startWechatBindQr}
                  >
                    扫码绑定
                  </button>
                  {!wechatQrReady ? (
                    <span className="self-center text-xs text-[var(--muted)]">
                      请微信内打开绑定
                    </span>
                  ) : null}
                </>
              )}
            </div>
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
