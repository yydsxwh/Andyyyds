"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PublicSettings = {
  siteUrl: string;
  paymentMode: string;
  wechatEnabled: boolean;
  alipayEnabled: boolean;
  wechatAppId: string;
  wechatMchId: string;
  wechatApiV3Key: string;
  wechatMchSerialNo: string;
  wechatMchPrivateKey: string;
  wechatConfigured: boolean;
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
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function set<K extends keyof PublicSettings>(key: K, value: PublicSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/studio/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error || "保存失败");
      return;
    }
    setForm(data.settings);
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
              状态：{form.wechatConfigured ? "已配置" : "未配置完整"} · 回调
              /api/payments/wechat/notify
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="AppID">
            <input
              className={inputClass}
              value={form.wechatAppId}
              onChange={(e) => set("wechatAppId", e.target.value)}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="应用 AppID">
            <input
              className={inputClass}
              value={form.alipayAppId}
              onChange={(e) => set("alipayAppId", e.target.value)}
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
          <Field label="应用私钥">
            <textarea
              className={inputClass}
              rows={4}
              value={form.alipayPrivateKey}
              onChange={(e) => set("alipayPrivateKey", e.target.value)}
            />
          </Field>
          <Field label="支付宝公钥">
            <textarea
              className={inputClass}
              rows={4}
              value={form.alipayPublicKey}
              onChange={(e) => set("alipayPublicKey", e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="surface space-y-4 rounded-[28px] p-6">
        <div>
          <h2 className="text-lg font-semibold">存储方式</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            素材中心上传视频时使用。本地适合起步；流量大时建议阿里云 OSS。
          </p>
        </div>
        <Field label="存储提供方">
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
        {form.storageProvider === "ALIYUN_OSS" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Region（如 oss-cn-hongkong）">
              <input
                className={inputClass}
                value={form.ossRegion}
                onChange={(e) => set("ossRegion", e.target.value)}
              />
            </Field>
            <Field label="Bucket">
              <input
                className={inputClass}
                value={form.ossBucket}
                onChange={(e) => set("ossBucket", e.target.value)}
              />
            </Field>
            <Field label="AccessKey ID">
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
                placeholder="bucket.oss-cn-xxx.aliyuncs.com"
              />
            </Field>
            <Field label="公网访问前缀 / CDN（可选）">
              <input
                className={inputClass}
                value={form.ossPublicBaseUrl}
                onChange={(e) => set("ossPublicBaseUrl", e.target.value)}
                placeholder="https://cdn.example.com"
              />
            </Field>
            <Field label="对象前缀">
              <input
                className={inputClass}
                value={form.ossPrefix}
                onChange={(e) => set("ossPrefix", e.target.value)}
              />
            </Field>
            <p className="text-sm text-[var(--muted)] sm:col-span-2">
              OSS 状态：{form.ossConfigured ? "参数已填" : "尚未填完整"}
            </p>
          </div>
        ) : null}
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
