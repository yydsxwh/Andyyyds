"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PublicSettings = {
  siteUrl: string;
  paymentMode: string;
  wechatEnabled: boolean;
  alipayEnabled: boolean;
  wechatAppId: string;
  wechatAppSecret: string;
  wechatMchId: string;
  wechatApiV3Key: string;
  wechatMchSerialNo: string;
  wechatMchPrivateKey: string;
  wechatConfigured: boolean;
  wechatOauthConfigured?: boolean;
  alipayAppId: string;
  alipayPrivateKey: string;
  alipayPublicKey: string;
  alipayGateway: string;
  alipayConfigured: boolean;
  storageProvider: "LOCAL" | "ALIYUN_OSS";
  ossRegion: string;
  ossBucket: string;
  ossAccessKeyId: string;
  ossAccessKeySecret: string;
  ossEndpoint: string;
  ossPublicBaseUrl: string;
  ossPrefix: string;
  ossConfigured: boolean;
  videoStorageProvider: "LOCAL" | "ALIYUN_VOD";
  vodRegionId: string;
  vodAccessKeyId: string;
  vodAccessKeySecret: string;
  vodTemplateGroupId: string;
  vodPlayDomain: string;
  vodConfigured: boolean;
};

type Props = { initial: PublicSettings };

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";

export function SiteSettingsPanel({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({
    ...initial,
    wechatAppSecret: initial.wechatAppSecret || "",
    wechatOauthConfigured: Boolean(initial.wechatOauthConfigured),
    ossRegion: initial.ossRegion || "oss-cn-hongkong",
    ossBucket: initial.ossBucket || "yydsxwh-course-media",
    ossPrefix: initial.ossPrefix || "uploads",
    videoStorageProvider: initial.videoStorageProvider || "LOCAL",
    vodRegionId: initial.vodRegionId || "cn-shanghai",
    vodTemplateGroupId: initial.vodTemplateGroupId || "VOD_NO_TRANSCODE",
  }));
  const [saving, setSaving] = useState(false);
  const [ossBusy, setOssBusy] = useState(false);
  const [vodBusy, setVodBusy] = useState(false);
  const [message, setMessage] = useState("");

  function set<K extends keyof PublicSettings>(key: K, value: PublicSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function testVod() {
    setVodBusy(true);
    setMessage("");
    const res = await fetch("/api/studio/settings/vod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "test",
        vodRegionId: form.vodRegionId || "cn-shanghai",
        vodAccessKeyId: form.vodAccessKeyId,
        vodAccessKeySecret: form.vodAccessKeySecret,
        vodTemplateGroupId: form.vodTemplateGroupId || "VOD_NO_TRANSCODE",
        vodPlayDomain: form.vodPlayDomain,
      }),
    });
    const data = await res.json();
    setVodBusy(false);
    if (!res.ok) {
      setMessage(data.error || "点播连接失败");
      return;
    }
    if (data.settings) setForm((f) => ({ ...f, ...data.settings }));
    setMessage(data.message || "点播连接成功");
    router.refresh();
  }

  async function runOssAction(action: "test" | "create") {
    setOssBusy(true);
    setMessage("");
    const res = await fetch("/api/studio/settings/oss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ossRegion: form.ossRegion || "oss-cn-hongkong",
        ossBucket: form.ossBucket,
        ossAccessKeyId: form.ossAccessKeyId,
        ossAccessKeySecret: form.ossAccessKeySecret,
        ossEndpoint: form.ossEndpoint,
        ossPublicBaseUrl: form.ossPublicBaseUrl,
        ossPrefix: form.ossPrefix || "uploads",
        enableAfterCreate: true,
      }),
    });
    const data = await res.json();
    setOssBusy(false);
    if (!res.ok) {
      setMessage(data.error || "OSS 操作失败");
      return;
    }
    if (data.settings) {
      setForm((f) => ({
        ...f,
        ...data.settings,
        ossRegion: data.settings.ossRegion || "oss-cn-hongkong",
        ossBucket: data.settings.ossBucket || "yydsxwh-course-media",
        ossPrefix: data.settings.ossPrefix || "uploads",
      }));
    }
    setMessage(data.message || (action === "test" ? "连接成功" : "OSS 已就绪"));
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/studio/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteUrl: form.siteUrl,
        paymentMode: form.paymentMode,
        wechatEnabled: form.wechatEnabled,
        alipayEnabled: form.alipayEnabled,
        wechatAppId: form.wechatAppId,
        wechatAppSecret: form.wechatAppSecret,
        wechatMchId: form.wechatMchId,
        wechatApiV3Key: form.wechatApiV3Key,
        wechatMchSerialNo: form.wechatMchSerialNo,
        wechatMchPrivateKey: form.wechatMchPrivateKey,
        alipayAppId: form.alipayAppId,
        alipayPrivateKey: form.alipayPrivateKey,
        alipayPublicKey: form.alipayPublicKey,
        alipayGateway: form.alipayGateway,
        storageProvider: form.storageProvider,
        ossRegion: form.ossRegion,
        ossBucket: form.ossBucket,
        ossAccessKeyId: form.ossAccessKeyId,
        ossAccessKeySecret: form.ossAccessKeySecret,
        ossEndpoint: form.ossEndpoint,
        ossPublicBaseUrl: form.ossPublicBaseUrl,
        ossPrefix: form.ossPrefix,
        videoStorageProvider: form.videoStorageProvider,
        vodRegionId: form.vodRegionId,
        vodAccessKeyId: form.vodAccessKeyId,
        vodAccessKeySecret: form.vodAccessKeySecret,
        vodTemplateGroupId: form.vodTemplateGroupId,
        vodPlayDomain: form.vodPlayDomain,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error || "保存失败");
      return;
    }
    if (data.settings) {
      setForm((f) => ({
        ...f,
        ...data.settings,
        ossRegion: data.settings.ossRegion || "oss-cn-hongkong",
        ossBucket: data.settings.ossBucket || "yydsxwh-course-media",
        ossPrefix: data.settings.ossPrefix || "uploads",
        vodRegionId: data.settings.vodRegionId || "cn-shanghai",
        vodTemplateGroupId:
          data.settings.vodTemplateGroupId || "VOD_NO_TRANSCODE",
      }));
    }
    setMessage("系统设置已保存");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="surface space-y-4 rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">站点基础</h2>
        <Field
          label="站点公网地址"
          hint="用于支付回调，例如 https://www.yydsxwh.com"
        >
          <input
            className={inputClass}
            value={form.siteUrl}
            onChange={(e) => set("siteUrl", e.target.value)}
            placeholder="https://www.yydsxwh.com"
          />
        </Field>
        <Field label="支付模式">
          <select
            className={inputClass}
            value={form.paymentMode}
            onChange={(e) => set("paymentMode", e.target.value)}
          >
            <option value="auto">自动（按下方开关与是否已配置）</option>
            <option value="mock">仅模拟支付（调试）</option>
            <option value="wechat">仅微信支付</option>
            <option value="alipay">仅支付宝</option>
            <option value="both">微信 + 支付宝</option>
          </select>
        </Field>
      </div>

      <div className="surface space-y-4 rounded-[28px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">微信支付</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              状态：{form.wechatConfigured ? "已配置" : "未配置完整"}
              {form.wechatOauthConfigured
                ? " · 微信内直接支付已就绪"
                : " · 未配 AppSecret（微信内无法直接调起支付）"}
              · 回调 /api/payments/wechat/notify
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.wechatEnabled}
              onChange={(e) => set("wechatEnabled", e.target.checked)}
            />
            启用
          </label>
        </div>
        <p className="rounded-2xl bg-[var(--bg-deep)]/60 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          电脑端：扫码（Native）。手机浏览器：H5（需商户开通 H5
          支付并配置域名）。微信内：JSAPI（需同一 AppID
          的公众号 AppSecret，并在公众号后台设置网页授权域名{" "}
          <code className="text-[var(--ink)]">www.yydsxwh.com</code>
          ；支付目录与 JSAPI 安全域名按微信商户平台要求配置）。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="AppID">
            <input
              className={inputClass}
              value={form.wechatAppId}
              onChange={(e) => set("wechatAppId", e.target.value)}
            />
          </Field>
          <Field
            label="公众号 AppSecret（手机微信直接支付必填）"
            hint="与上方 AppID 同属一个公众号。微信公众平台 → 开发 → 基本配置。已保存会打码，不改请留原样"
          >
            <input
              className={inputClass}
              value={form.wechatAppSecret}
              onChange={(e) => set("wechatAppSecret", e.target.value)}
              placeholder="填写后微信内可直接调起支付，无需扫码"
            />
          </Field>
          <Field label="商户号 mchid">
            <input
              className={inputClass}
              value={form.wechatMchId}
              onChange={(e) => set("wechatMchId", e.target.value)}
            />
          </Field>
          <Field label="APIv3 密钥（32位）" hint="已保存的密钥会打码，不改请留原样">
            <input
              className={inputClass}
              value={form.wechatApiV3Key}
              onChange={(e) => set("wechatApiV3Key", e.target.value)}
            />
          </Field>
          <Field label="证书序列号">
            <input
              className={inputClass}
              value={form.wechatMchSerialNo}
              onChange={(e) => set("wechatMchSerialNo", e.target.value)}
            />
          </Field>
          <Field label="商户私钥 PEM" hint="粘贴 apiclient_key.pem 全文">
            <textarea
              className={inputClass}
              rows={5}
              value={form.wechatMchPrivateKey}
              onChange={(e) => set("wechatMchPrivateKey", e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----"
            />
          </Field>
        </div>
      </div>

      <div className="surface space-y-4 rounded-[28px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">支付宝支付</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              状态：{form.alipayConfigured ? "已配置" : "未配置完整"} · 回调
              /api/payments/alipay/notify
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.alipayEnabled}
              onChange={(e) => set("alipayEnabled", e.target.checked)}
            />
            启用
          </label>
        </div>
        <p className="rounded-2xl bg-[var(--bg-deep)]/60 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          在{" "}
          <a
            className="text-[var(--brand)] underline"
            href="https://open.alipay.com"
            target="_blank"
            rel="noreferrer"
          >
            open.alipay.com
          </a>{" "}
          创建应用并开通「手机网站支付」「电脑网站支付」。异步通知地址填{" "}
          <code className="text-[var(--ink)]">
            https://www.yydsxwh.com/api/payments/alipay/notify
          </code>
          ；回跳可用{" "}
          <code className="text-[var(--ink)]">
            https://www.yydsxwh.com/checkout/return
          </code>
          。密钥用 RSA2。支付方式建议选「微信 + 支付宝」。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="应用 AppID">
            <input
              className={inputClass}
              value={form.alipayAppId}
              onChange={(e) => set("alipayAppId", e.target.value)}
              placeholder="2021xxxxxxxxxx"
            />
          </Field>
          <Field label="网关环境">
            <select
              className={inputClass}
              value={form.alipayGateway}
              onChange={(e) => set("alipayGateway", e.target.value)}
            >
              <option value="production">正式环境</option>
              <option value="sandbox">沙箱</option>
            </select>
          </Field>
          <Field
            label="应用私钥"
            hint="你自己生成的 RSA2 私钥。已保存会打码，不改请留原样"
          >
            <textarea
              className={inputClass}
              rows={4}
              value={form.alipayPrivateKey}
              onChange={(e) => set("alipayPrivateKey", e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY----- ..."
            />
          </Field>
          <Field
            label="支付宝公钥"
            hint="开放平台「支付宝公钥」，不是应用公钥。已保存会打码，不改请留原样"
          >
            <textarea
              className={inputClass}
              rows={4}
              value={form.alipayPublicKey}
              onChange={(e) => set("alipayPublicKey", e.target.value)}
              placeholder="-----BEGIN PUBLIC KEY----- ..."
            />
          </Field>
        </div>
      </div>

      <div className="surface space-y-4 rounded-[28px] p-6">
        <div>
          <h2 className="text-lg font-semibold">课程视频 · 阿里云点播</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            素材中心上传的<strong>课程视频</strong>走点播（转码/播放）。可与下方
            OSS 同时开启：视频用点播，图片等其他文件用 OSS。
          </p>
        </div>
        <Field label="视频存储方式">
          <select
            className={inputClass}
            value={form.videoStorageProvider}
            onChange={(e) =>
              set(
                "videoStorageProvider",
                e.target.value as "LOCAL" | "ALIYUN_VOD",
              )
            }
          >
            <option value="LOCAL">本地磁盘（或回退到下方 OSS）</option>
            <option value="ALIYUN_VOD">阿里云点播（推荐）</option>
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="regionId"
            hint="例：上海 cn-shanghai、北京 cn-beijing、深圳 cn-shenzhen"
          >
            <input
              className={inputClass}
              value={form.vodRegionId}
              onChange={(e) => set("vodRegionId", e.target.value)}
              placeholder="cn-shanghai"
            />
          </Field>
          <Field label="不转码模板组 ID">
            <input
              className={inputClass}
              value={form.vodTemplateGroupId}
              onChange={(e) => set("vodTemplateGroupId", e.target.value)}
              placeholder="VOD_NO_TRANSCODE"
            />
          </Field>
          <Field
            label="AccessKey ID"
            hint="需具备视频点播权限的 RAM AccessKey"
          >
            <input
              className={inputClass}
              value={form.vodAccessKeyId}
              onChange={(e) => set("vodAccessKeyId", e.target.value)}
            />
          </Field>
          <Field label="AccessKey Secret">
            <input
              className={inputClass}
              value={form.vodAccessKeySecret}
              onChange={(e) => set("vodAccessKeySecret", e.target.value)}
            />
          </Field>
          <Field
            label="播放域名（选填）"
            hint="不含 http/https，多域名时指定要用的那个"
          >
            <input
              className={inputClass}
              value={form.vodPlayDomain}
              onChange={(e) => set("vodPlayDomain", e.target.value)}
              placeholder="例如 play.example.com"
            />
          </Field>
          <p className="text-sm text-[var(--muted)] sm:col-span-2">
            当前：
            {form.videoStorageProvider === "ALIYUN_VOD"
              ? "已启用点播"
              : "视频未走点播"}
            {" · "}
            {form.vodConfigured ? "密钥已填" : "请先填写点播 AccessKey"}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={vodBusy}
          onClick={() => void testVod()}
        >
          {vodBusy ? "测试中…" : "测试点播连接"}
        </button>
      </div>

      <div className="surface space-y-4 rounded-[28px] p-6">
        <div>
          <h2 className="text-lg font-semibold">其他文件 · 阿里云 OSS</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            店铺装修图片、封面、附件等走 OSS。服务器在香港时，Region 推荐
            <code className="mx-1">oss-cn-hongkong</code>。
          </p>
        </div>
        <Field label="其他文件存储方式">
          <select
            className={inputClass}
            value={form.storageProvider}
            onChange={(e) =>
              set("storageProvider", e.target.value as "LOCAL" | "ALIYUN_OSS")
            }
          >
            <option value="LOCAL">本地磁盘（服务器 public/uploads）</option>
            <option value="ALIYUN_OSS">阿里云 OSS</option>
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Region">
            <input
              className={inputClass}
              value={form.ossRegion}
              onChange={(e) => set("ossRegion", e.target.value)}
              placeholder="oss-cn-hongkong"
            />
          </Field>
          <Field label="Bucket 名称（全球唯一）">
            <input
              className={inputClass}
              value={form.ossBucket}
              onChange={(e) => set("ossBucket", e.target.value)}
              placeholder="yydsxwh-course-media"
            />
          </Field>
          <Field
            label="AccessKey ID"
            hint="可与点播共用同一 RAM 用户（需同时开 OSS + 点播权限）"
          >
            <input
              className={inputClass}
              value={form.ossAccessKeyId}
              onChange={(e) => set("ossAccessKeyId", e.target.value)}
            />
          </Field>
          <Field label="AccessKey Secret">
            <input
              className={inputClass}
              value={form.ossAccessKeySecret}
              onChange={(e) => set("ossAccessKeySecret", e.target.value)}
            />
          </Field>
          <Field label="自定义 Endpoint（可选）">
            <input
              className={inputClass}
              value={form.ossEndpoint}
              onChange={(e) => set("ossEndpoint", e.target.value)}
              placeholder="一般留空即可"
            />
          </Field>
          <Field label="公网访问前缀 / CDN（可选）">
            <input
              className={inputClass}
              value={form.ossPublicBaseUrl}
              onChange={(e) => set("ossPublicBaseUrl", e.target.value)}
              placeholder="创建成功后会自动填 Bucket 域名"
            />
          </Field>
          <Field label="对象前缀">
            <input
              className={inputClass}
              value={form.ossPrefix || "uploads"}
              onChange={(e) => set("ossPrefix", e.target.value)}
            />
          </Field>
          <p className="text-sm text-[var(--muted)] sm:col-span-2">
            当前：
            {form.storageProvider === "ALIYUN_OSS" ? "已启用 OSS" : "本地存储"}
            {" · "}
            {form.ossConfigured ? "密钥参数已填" : "请先填写 AccessKey 与 Bucket"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={ossBusy}
            onClick={() => void runOssAction("test")}
          >
            {ossBusy ? "处理中…" : "测试 OSS 连接"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={ossBusy}
            onClick={() => void runOssAction("create")}
          >
            {ossBusy ? "处理中…" : "一键创建 Bucket 并启用 OSS"}
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">
          一键创建会：新建 Bucket（若已存在则复用）→ 公共读 → CORS →
          把「其他文件」切到阿里云 OSS。AccessKey 需要有 OSS 权限。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "保存中…" : "保存系统设置"}
        </button>
        {message ? (
          <span className="text-sm text-[var(--brand-strong)]">{message}</span>
        ) : null}
      </div>
    </form>
  );
}
