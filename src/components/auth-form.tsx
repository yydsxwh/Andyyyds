"use client";

/**
 * 登录 / 注册统一表单：邮箱 | 手机号 | 微信。
 *
 * - 邮箱：原有密码流程
 * - 手机号：短信验证码；注册可带身份申请与可选密码
 * - 微信：公众号网页授权；首次授权即注册，再次即登录（须微信内打开）
 *
 * 注册页三种方式均可选「我是…」身份；代理/商家/老师待站长审核。
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  APPLYABLE_ROLES,
  ROLE_HINT,
  ROLE_LABEL,
  type ApplyableRole,
} from "@/lib/roles";
import { REFERRAL_STORAGE_KEY } from "@/lib/invite";
import { PENDING_REVIEW_MESSAGE } from "@/lib/role-applications";
import { normalizeReferralCode } from "@/lib/referral-code";
import { isWeChatBrowser } from "@/lib/wechat-env";

type AuthChannel = "email" | "phone" | "wechat";

type Props = {
  mode: "login" | "register";
  defaultReferralCode?: string;
};

type MethodsState = {
  email: boolean;
  phone: boolean;
  wechat: boolean;
  smsTestMode: boolean;
};

/** 仅允许站内相对路径，防止开放重定向 */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export function AuthForm({ mode, defaultReferralCode = "" }: Props) {
  const router = useRouter();
  const [channel, setChannel] = useState<AuthChannel>("email");
  const [methods, setMethods] = useState<MethodsState>({
    email: true,
    phone: true,
    wechat: true,
    smsTestMode: false,
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestedRole, setRequestedRole] = useState<ApplyableRole>("STUDENT");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [inWeChat, setInWeChat] = useState(false);
  /** URL ?ref= 优先，其次本地记住的分享码 */
  const [resolvedRef, setResolvedRef] = useState(defaultReferralCode);

  useEffect(() => {
    setInWeChat(isWeChatBrowser());
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = normalizeReferralCode(
        params.get("ref") || params.get("referralCode") || "",
      );
      const fromStore = normalizeReferralCode(
        window.localStorage.getItem(REFERRAL_STORAGE_KEY) || "",
      );
      const next =
        fromUrl ||
        normalizeReferralCode(defaultReferralCode) ||
        fromStore ||
        "";
      if (next) {
        setResolvedRef(next);
        window.localStorage.setItem(REFERRAL_STORAGE_KEY, next);
      }
    } catch {
      /* ignore */
    }
    let cancelled = false;
    fetch("/api/auth/methods")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setMethods({
          email: data.email !== false,
          phone: Boolean(data.phone),
          wechat: Boolean(data.wechat),
          smsTestMode: Boolean(data.smsTestMode),
        });
      })
      .catch(() => {
        /* 探测失败时仍展示入口，提交时再报错 */
      });
    return () => {
      cancelled = true;
    };
  }, [defaultReferralCode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  function finishAuth(data: {
    pendingReview?: boolean;
    message?: string;
    isNewUser?: boolean;
  }) {
    if (data.pendingReview) {
      setNotice(data.message || PENDING_REVIEW_MESSAGE);
      router.push("/account?pending=1");
      router.refresh();
      return;
    }
    // 约搭等流程会带 ?next=，登录后回到原页面继续报名/发起
    const nextPath = safeNextPath(
      new URLSearchParams(window.location.search).get("next"),
    );
    if (nextPath) {
      router.push(nextPath);
      router.refresh();
      return;
    }
    // 登录与各渠道注册成功后统一进个人中心；邮箱注册成功去课程广场选课
    if (mode === "register" && channel === "email") {
      router.push("/courses");
    } else {
      router.push("/account");
    }
    router.refresh();
  }

  async function onEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    if (mode === "register") {
      payload.requestedRole = requestedRole;
    }

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
    finishAuth(data);
  }

  async function sendCode() {
    setError("");
    setNotice("");
    if (!phone.trim()) {
      setError("请先填写手机号");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, purpose: "login" }),
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
        ? "测试模式：请查看服务器日志中的验证码，或使用系统设置里的固定测试码"
        : "验证码已发送，请查收短信",
    );
  }

  async function onPhoneSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "");
    const password = String(form.get("password") || "");
    const referralCode = String(
      form.get("referralCode") || resolvedRef || "",
    );

    const res = await fetch("/api/auth/phone/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        code: smsCode,
        mode,
        name: mode === "register" ? name : undefined,
        password: password || undefined,
        referralCode: referralCode || undefined,
        requestedRole: mode === "register" ? requestedRole : "STUDENT",
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "操作失败");
      return;
    }
    finishAuth(data);
  }

  function startWechat() {
    setError("");
    if (!inWeChat) {
      setError("请在微信内打开本站后使用微信登录 / 注册");
      return;
    }
    if (!methods.wechat) {
      setError(
        "微信登录未配置。请站长在系统设置填写公众号 AppID / AppSecret，并配置网页授权域名",
      );
      return;
    }
    // 微信资料在首次授权时已写入；登录成功回业务页/首页，不再进个人中心改头像昵称
    const nextPath =
      safeNextPath(
        new URLSearchParams(window.location.search).get("next"),
      ) || "/";
    const params = new URLSearchParams({
      purpose: "login",
      returnUrl: nextPath,
    });
    if (mode === "register") {
      params.set("requestedRole", requestedRole);
      if (resolvedRef) {
        params.set("referralCode", resolvedRef);
      }
    }
    window.location.href = `/api/auth/wechat?${params.toString()}`;
  }

  const tabs: { id: AuthChannel; label: string; show: boolean }[] = [
    { id: "email", label: "邮箱", show: methods.email },
    { id: "phone", label: "手机号", show: true },
    { id: "wechat", label: "微信", show: true },
  ];

  return (
    <div className="surface mx-auto w-full max-w-md space-y-4 rounded-[28px] p-5 sm:p-8">
      <div>
        <h1 className="brand-mark text-3xl text-[var(--brand)]">
          {mode === "login" ? "欢迎回来" : "创建账号"}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {mode === "login"
            ? "可用邮箱、手机号或微信登录。"
            : "可用邮箱、手机号或微信注册。普通用户即用；加盟代理 / 入驻商家 / 老师需站长审核。"}
        </p>
      </div>

      {/* 大触控分区，保证手机微信内拇指可点 */}
      <div
        className="grid grid-cols-3 gap-2 rounded-2xl bg-[var(--bg-deep)]/50 p-1"
        role="tablist"
        aria-label="登录方式"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={channel === tab.id}
            className={`min-h-11 rounded-xl px-2 text-sm font-medium transition ${
              channel === tab.id
                ? "bg-white/55 text-[var(--ink)] shadow-[var(--glass-inset)] backdrop-blur-md"
                : "text-[var(--muted)]"
            }`}
            onClick={() => {
              setChannel(tab.id);
              setError("");
              setNotice("");
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {channel === "email" ? (
        <form onSubmit={onEmailSubmit} className="space-y-4">
          {mode === "register" ? (
            <input className="field" name="name" placeholder="昵称" required />
          ) : null}
          <input
            className="field"
            type="email"
            name="email"
            placeholder="邮箱"
            required
          />
          <input
            className="field"
            type="password"
            name="password"
            placeholder="密码（至少 6 位）"
            minLength={6}
            required
          />
          {mode === "register" ? (
            <>
              <RolePicker
                requestedRole={requestedRole}
                onChange={setRequestedRole}
              />
              <input
                className="field"
                name="referralCode"
                placeholder="邀请码（可选）"
                defaultValue={resolvedRef}
              />
            </>
          ) : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {notice ? (
            <p className="text-sm text-[var(--brand-strong)]">{notice}</p>
          ) : null}
          <button
            className="btn btn-primary w-full"
            disabled={loading}
            type="submit"
          >
            {loading
              ? "提交中..."
              : mode === "login"
                ? "邮箱登录"
                : "邮箱注册"}
          </button>
          {mode === "login" ? (
            <p className="text-center text-sm text-[var(--muted)]">
              演示账号：student@yyds.local / 123456
            </p>
          ) : null}
        </form>
      ) : null}

      {channel === "phone" ? (
        <form onSubmit={onPhoneSubmit} className="space-y-4">
          {!methods.phone ? (
            <p className="rounded-2xl bg-[var(--bg-deep)]/60 px-3 py-2 text-sm text-[var(--muted)]">
              站长尚未启用短信登录。请在「系统设置 → 短信」开启测试模式或配置阿里云短信后重试。
            </p>
          ) : null}
          {mode === "register" ? (
            <input
              className="field"
              name="name"
              placeholder="昵称"
              required
            />
          ) : null}
          <input
            className="field"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            name="phone"
            placeholder="手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <input
              className="field min-w-0 flex-1"
              inputMode="numeric"
              name="code"
              placeholder="短信验证码"
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value)}
              required
            />
            <button
              type="button"
              className="btn btn-secondary shrink-0 min-h-11 px-3 text-sm"
              disabled={loading || cooldown > 0 || !methods.phone}
              onClick={sendCode}
            >
              {cooldown > 0 ? `${cooldown}s` : "获取验证码"}
            </button>
          </div>
          {mode === "register" ? (
            <>
              <input
                className="field"
                type="password"
                name="password"
                placeholder="设置密码（可选，至少 6 位）"
                minLength={6}
              />
              <RolePicker
                requestedRole={requestedRole}
                onChange={setRequestedRole}
              />
              <input
                className="field"
                name="referralCode"
                placeholder="邀请码（可选）"
                defaultValue={resolvedRef}
              />
            </>
          ) : null}
          {methods.smsTestMode ? (
            <p className="text-xs text-[var(--muted)]">
              当前为短信测试模式：验证码见服务器日志，或使用站长设置的固定测试码。
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {notice ? (
            <p className="text-sm text-[var(--brand-strong)]">{notice}</p>
          ) : null}
          <button
            className="btn btn-primary w-full"
            disabled={loading || !methods.phone}
            type="submit"
          >
            {loading
              ? "提交中..."
              : mode === "login"
                ? "手机号登录"
                : "手机号注册"}
          </button>
        </form>
      ) : null}

      {channel === "wechat" ? (
        <div className="space-y-4">
          {mode === "register" ? (
            <>
              <RolePicker
                requestedRole={requestedRole}
                onChange={setRequestedRole}
              />
              {resolvedRef ? (
                <p className="text-xs text-[var(--muted)]">
                  将使用邀请码：{resolvedRef}
                </p>
              ) : null}
            </>
          ) : null}
          {!inWeChat ? (
            <p className="rounded-2xl border border-[var(--line)] bg-white/70 px-3 py-3 text-sm leading-6 text-[var(--muted)]">
              微信登录 / 注册需在
              <span className="text-[var(--ink)]">微信内置浏览器</span>
              中打开本站。请用微信扫一扫打开站点，或从公众号菜单进入后再点下方按钮。
              <br />
              （电脑浏览器暂不支持网页授权登录；开放平台扫码登录未接入。）
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              {mode === "login"
                ? "将跳转微信授权昵称与头像。已有账号直接登录；首次授权将自动注册为学员。"
                : "将跳转微信授权昵称与头像。首次授权按上方所选身份创建账号；若该微信已注册则直接登录。"}
            </p>
          )}
          {!methods.wechat ? (
            <p className="text-sm text-amber-800">
              尚未配置微信 AppSecret，请联系站长在系统设置中填写。
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="button"
            className="btn btn-primary w-full min-h-12"
            disabled={loading || !methods.wechat}
            onClick={startWechat}
          >
            {mode === "login" ? "微信登录" : "微信注册 / 登录"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RolePicker({
  requestedRole,
  onChange,
}: {
  requestedRole: ApplyableRole;
  onChange: (role: ApplyableRole) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-[var(--ink)]">我是…</legend>
      <div className="grid gap-2">
        {APPLYABLE_ROLES.map((role) => {
          const selected = requestedRole === role;
          return (
            <label
              key={role}
              className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition ${
                selected
                  ? "border-[var(--brand)] bg-[var(--brand)]/5"
                  : "border-[var(--line)] bg-white/70 hover:border-[var(--brand)]/40"
              }`}
            >
              <input
                type="radio"
                name="requestedRoleUi"
                className="mt-1 h-4 w-4 shrink-0"
                checked={selected}
                onChange={() => onChange(role)}
              />
              <span>
                <span className="block text-sm font-medium">
                  {ROLE_LABEL[role]}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  {ROLE_HINT[role]}
                  {role !== "STUDENT" ? " · 注册后待站长审核" : " · 注册即用"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
