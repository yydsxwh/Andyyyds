"use client";

/**
 * 登录 / 注册统一表单：微信 | 账号 | 手机号 | 邮箱。
 *
 * - 微信内：公众号网页授权（/api/auth/wechat）
 * - 站外浏览器：开放平台网站应用扫码（/api/auth/wechat/qr）
 * - Capacitor Android：开放平台移动应用 SDK（/api/auth/wechat/mobile）
 * - 账号：登录名 + 密码（与邮箱通道分开，不填邮箱）
 * - 手机号：短信验证码；注册可带身份申请与可选密码
 * - 邮箱：真实邮箱 + 密码
 *
 * 国内用户默认落在微信 Tab；微信未配置时回退账号/手机/邮箱，避免空白页。
 * 注册页各方式均可选「我是…」身份；代理/商家/老师待站长审核。
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import {
  APPLYABLE_ROLES,
  ROLE_HINT,
  ROLE_LABEL,
  type ApplyableRole,
} from "@andyyyds/shared/roles";
import { REFERRAL_STORAGE_KEY } from "@andyyyds/shared/invite";
import { PENDING_REVIEW_MESSAGE } from "@andyyyds/shared/role-applications";
import { normalizeReferralCode } from "@andyyyds/shared/referral-code";
import { preferWechatFromClient } from "@andyyyds/shared/auth-channel-preference";
import {
  isCapacitorAndroid,
  isWeChatBrowser,
} from "@andyyyds/shared/wechat-env";
import { WechatLogin } from "@andyyyds/shared/wechat-login-plugin";

type AuthChannel = "email" | "account" | "phone" | "wechat";

type Props = {
  mode: "login" | "register";
  defaultReferralCode?: string;
  /**
   * 服务端按 Accept-Language 给出的首屏默认。
   * 为何需要：避免国内用户先水合出「邮箱」再跳到微信。
   */
  preferWechatDefault?: boolean;
};

type MethodsState = {
  email: boolean;
  phone: boolean;
  /** 公众号网页授权（微信内） */
  wechat: boolean;
  /** 开放平台网站应用扫码（PC/站外浏览器） */
  wechatQr: boolean;
  /** Android App 微信 SDK 快捷登录 */
  wechatMobile: boolean;
  /** 移动应用公开 AppID（SDK 调起用） */
  wechatMobileAppId: string;
  smsTestMode: boolean;
};

/** 仅允许站内相对路径，防止开放重定向 */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/**
 * 是否把默认 Tab 定在微信。
 * 微信内无公众号配置时授权按钮不可用 → 回退；
 * PC 扫码未就绪仍默认可进微信 Tab（展示现有说明，勿空白）。
 */
function shouldDefaultToWechat(
  inWeChat: boolean,
  methods: Pick<MethodsState, "wechat" | "wechatQr">,
): boolean {
  if (inWeChat) return methods.wechat;
  return true;
}

/** 微信不可用时的回退：账号密码（不依赖短信/扫码配置） */
function fallbackChannel(
  _methods?: Pick<MethodsState, "phone" | "email">,
): AuthChannel {
  return "account";
}

export function AuthForm({
  mode,
  defaultReferralCode = "",
  preferWechatDefault = true,
}: Props) {
  const router = useRouter();
  // 国内站默认微信；海外语言首屏邮箱（客户端时区还会再校正）
  const [channel, setChannel] = useState<AuthChannel>(
    preferWechatDefault ? "wechat" : "email",
  );
  const [methods, setMethods] = useState<MethodsState>({
    email: true,
    phone: true,
    wechat: true,
    wechatQr: false,
    wechatMobile: false,
    wechatMobileAppId: "",
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
  /** Capacitor Android 壳：优先微信 SDK 快捷登录 */
  const [inCapacitorAndroid, setInCapacitorAndroid] = useState(false);
  /** URL ?ref= 优先，其次本地记住的分享码 */
  const [resolvedRef, setResolvedRef] = useState(defaultReferralCode);

  useEffect(() => {
    const inWx = isWeChatBrowser();
    const inCapAndroid = isCapacitorAndroid();
    setInWeChat(inWx);
    setInCapacitorAndroid(inCapAndroid);
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
        const nextMethods: MethodsState = {
          email: data.email !== false,
          phone: Boolean(data.phone),
          wechat: Boolean(data.wechat),
          wechatQr: Boolean(data.wechatQr),
          wechatMobile: Boolean(data.wechatMobile),
          wechatMobileAppId: String(data.wechatMobileAppId || ""),
          smsTestMode: Boolean(data.smsTestMode),
        };
        setMethods(nextMethods);

        // Capacitor Android 已配移动应用时默认微信 Tab（快捷登录）
        if (inCapAndroid && nextMethods.wechatMobile) {
          setChannel("wechat");
          return;
        }

        // 以客户端时区/语言/微信内为准校正首屏；微信内未配置公众号则回退
        const wantWechat = preferWechatFromClient({ inWeChat: inWx });
        if (wantWechat && shouldDefaultToWechat(inWx, nextMethods)) {
          setChannel("wechat");
        } else if (wantWechat) {
          setChannel(fallbackChannel(nextMethods));
        } else {
          setChannel("email");
        }
      })
      .catch(() => {
        /* 探测失败时仍展示入口，提交时再报错 */
        if (cancelled) return;
        if (inCapAndroid || preferWechatFromClient({ inWeChat: inWx })) {
          // methods 未知时保持微信 Tab（有引导文案），勿空白
          setChannel("wechat");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [defaultReferralCode, preferWechatDefault]);

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
    // 登录与各渠道注册成功后统一进个人中心；账号/邮箱密码注册去课程广场选课
    if (mode === "register" && (channel === "email" || channel === "account")) {
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

  async function onAccountSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const form = new FormData(e.currentTarget);
    const username = String(form.get("username") || "");
    const password = String(form.get("password") || "");
    const name = String(form.get("name") || "");
    const referralCode = String(
      form.get("referralCode") || resolvedRef || "",
    );

    const res = await fetch("/api/auth/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        mode,
        name: mode === "register" ? name : undefined,
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

  function buildWechatLoginParams() {
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
    return params;
  }

  /** 微信内：公众号网页授权（拿公众号 openid，便于后续 JSAPI） */
  function startWechatOa() {
    setError("");
    if (!inWeChat) {
      setError("请在微信内打开本站后使用「微信授权登录」");
      return;
    }
    if (!methods.wechat) {
      setError(
        "微信登录未配置。请站长在系统设置填写公众号 AppID / AppSecret，并配置网页授权域名",
      );
      return;
    }
    window.location.href = `/api/auth/wechat?${buildWechatLoginParams().toString()}`;
  }

  /** 站外浏览器：跳转开放平台扫码页（微信扫一扫） */
  function startWechatQr() {
    setError("");
    if (inWeChat) {
      // 微信内扫码页体验差且拿不到公众号 openid，引导走公众号授权
      setError("当前已在微信内，请直接使用下方「微信授权登录」");
      return;
    }
    if (!methods.wechatQr) {
      setError(
        "微信扫码登录未配置。请站长在系统设置填写开放平台「网站应用」AppID / AppSecret，并配置授权回调域",
      );
      return;
    }
    window.location.href = `/api/auth/wechat/qr?${buildWechatLoginParams().toString()}`;
  }

  /**
   * Capacitor Android：调起微信 SDK 拿 code，再 POST 服务端换登录 Cookie。
   * 为何不用网页 OAuth：App WebView 无法走微信内授权，须原生 openSDK。
   */
  async function startWechatMobile() {
    setError("");
    setNotice("");
    if (!methods.wechatMobile || !methods.wechatMobileAppId) {
      setError(
        "微信快捷登录未配置。请站长在系统设置填写开放平台「移动应用」AppID / AppSecret",
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
      const { code } = await WechatLogin.login({
        appId: methods.wechatMobileAppId,
      });
      if (!code) {
        setError("微信授权未返回凭证，请重试");
        setLoading(false);
        return;
      }
      const nextPath =
        safeNextPath(
          new URLSearchParams(window.location.search).get("next"),
        ) || "/account";
      const res = await fetch("/api/auth/wechat/mobile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          purpose: "login",
          returnUrl: nextPath,
          requestedRole: mode === "register" ? requestedRole : undefined,
          referralCode:
            mode === "register" && resolvedRef ? resolvedRef : undefined,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error || "微信登录失败");
        return;
      }
      finishAuth(data);
    } catch (err) {
      setLoading(false);
      const message =
        err instanceof Error ? err.message : "微信登录已取消或失败";
      setError(message);
    }
  }

  const useMobileQuickLogin =
    inCapacitorAndroid && methods.wechatMobile && Boolean(methods.wechatMobileAppId);

  // Tab 顺序：微信 → 账号 → 手机号 → 邮箱（账号与邮箱分开，电脑端可走账号密码）
  const visibleTabs = (
    [
      { id: "wechat" as const, label: "微信", show: true },
      { id: "account" as const, label: "账号", show: true },
      { id: "phone" as const, label: "手机号", show: true },
      { id: "email" as const, label: "邮箱", show: methods.email },
    ] as const
  ).filter((tab) => tab.show);

  const tabGridClass =
    visibleTabs.length <= 2
      ? "grid-cols-2"
      : visibleTabs.length === 3
        ? "grid-cols-3"
        : "grid-cols-2 sm:grid-cols-4";

  const { t } = useLocale();

  return (
    <div className="surface mx-auto w-full max-w-md space-y-4 rounded-[28px] p-5 sm:p-8">
      <div>
        <h1 className="brand-mark text-3xl text-[var(--brand)]">
          {mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {mode === "login"
            ? "可用微信、账号密码、手机号或邮箱登录。"
            : "可用微信、账号密码、手机号或邮箱注册。普通用户即用；加盟代理 / 入驻商家 / 老师需站长审核。"}
        </p>
      </div>

      {/* 大触控分区，保证手机微信内拇指可点；四项时手机两列避免挤成一条 */}
      <div
        className={`grid gap-2 rounded-2xl bg-[var(--bg-deep)]/50 p-1 ${tabGridClass}`}
        role="tablist"
        aria-label="登录方式"
      >
        {visibleTabs.map((tab) => (
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

      {channel === "account" ? (
        <form onSubmit={onAccountSubmit} className="space-y-4">
          <p className="rounded-2xl bg-[var(--bg-deep)]/60 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
            使用登录账号 + 密码（不是邮箱）。账号为 4–20
            位，小写字母开头，仅含字母、数字、下划线。
          </p>
          {mode === "register" ? (
            <input className="field" name="name" placeholder="昵称" required />
          ) : null}
          <input
            className="field"
            name="username"
            autoComplete="username"
            placeholder="登录账号"
            spellCheck={false}
            required
          />
          <input
            className="field"
            type="password"
            name="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
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
                ? "账号登录"
                : "账号注册"}
          </button>
        </form>
      ) : null}

      {channel === "email" ? (
        <form onSubmit={onEmailSubmit} className="space-y-4">
          <p className="rounded-2xl bg-[var(--bg-deep)]/60 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
            使用真实邮箱 + 密码。若要用登录名注册，请切换到「账号」。
          </p>
          {mode === "register" ? (
            <input className="field" name="name" placeholder="昵称" required />
          ) : null}
          <input
            className="field"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="邮箱"
            required
          />
          <input
            className="field"
            type="password"
            name="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
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
          {useMobileQuickLogin ? (
            <p className="text-sm text-[var(--muted)]">
              {mode === "login"
                ? "将打开微信完成授权。已有账号直接登录；首次授权将自动注册为学员。"
                : "将打开微信完成授权。首次授权按上方所选身份创建账号；若该微信已注册则直接登录。"}
            </p>
          ) : inWeChat ? (
            <p className="text-sm text-[var(--muted)]">
              {mode === "login"
                ? "将跳转微信授权。已有账号直接登录；首次授权将自动注册为学员。"
                : "将跳转微信授权。首次授权按上方所选身份创建账号；若该微信已注册则直接登录。"}
            </p>
          ) : (
            <p className="rounded-2xl border border-[var(--line)] bg-white/70 px-3 py-3 text-sm leading-6 text-[var(--muted)]">
              电脑或手机浏览器可使用
              <span className="text-[var(--ink)]">微信扫码登录</span>
              ：点击后将打开微信官方扫码页，用手机微信扫一扫即可。
              <br />
              若已在微信内打开本站，请改用「微信授权登录」。
            </p>
          )}
          {useMobileQuickLogin && !methods.wechatMobile ? (
            <p className="text-sm text-amber-800">
              尚未配置开放平台移动应用，App 快捷登录暂不可用。请站长在系统设置填写移动应用
              AppID / AppSecret。
            </p>
          ) : null}
          {!useMobileQuickLogin && !inWeChat && !methods.wechatQr ? (
            <p className="text-sm text-amber-800">
              尚未配置开放平台网站应用，扫码登录暂不可用。请站长在系统设置填写网站应用
              AppID / AppSecret。
            </p>
          ) : null}
          {!useMobileQuickLogin && inWeChat && !methods.wechat ? (
            <p className="text-sm text-amber-800">
              尚未配置公众号 AppSecret，请联系站长在系统设置中填写。
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {useMobileQuickLogin ? (
            <button
              type="button"
              className="btn btn-primary w-full min-h-12"
              disabled={loading || !methods.wechatMobile}
              onClick={() => void startWechatMobile()}
            >
              {loading
                ? "正在打开微信…"
                : mode === "login"
                  ? "微信快捷登录"
                  : "微信快捷注册 / 登录"}
            </button>
          ) : inWeChat ? (
            <button
              type="button"
              className="btn btn-primary w-full min-h-12"
              disabled={loading || !methods.wechat}
              onClick={startWechatOa}
            >
              {mode === "login" ? "微信授权登录" : "微信授权注册 / 登录"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary w-full min-h-12"
              disabled={loading || !methods.wechatQr}
              onClick={startWechatQr}
            >
              {mode === "login" ? "微信扫码登录" : "微信扫码注册 / 登录"}
            </button>
          )}
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
