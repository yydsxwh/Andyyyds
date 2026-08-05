"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils";

type Settings = {
  enabled: boolean;
  level1Percent: number;
  level2Percent: number;
  level3Percent: number;
};

type CommissionRow = {
  id: string;
  level: number;
  ratePercent: number;
  amount: number;
  status: string;
  createdAt: string;
  buyer: { name: string; email: string };
  beneficiary: { name: string; email: string };
  order: { orderNo: string; amount: number; course: { title: string } };
};

type Props = {
  initialSettings: Settings;
  commissions: CommissionRow[];
  inviteCode: string;
  inviteUrl: string;
  myEarnings: number;
  teamCount: number;
};

export function DistributionPanel({
  initialSettings,
  commissions,
  inviteCode,
  inviteUrl,
  myEarnings,
  teamCount,
}: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/studio/distribution", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: settings.enabled,
        level1Percent: Number(settings.level1Percent),
        level2Percent: Number(settings.level2Percent),
        level3Percent: Number(settings.level3Percent),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error || "保存失败");
      return;
    }
    setSettings(data.settings);
    setMessage("分销比例已保存");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface rounded-[24px] p-5">
          <div className="text-sm text-[var(--muted)]">我的累计佣金</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--brand)]">
            {formatPrice(myEarnings)}
          </div>
        </div>
        <div className="surface rounded-[24px] p-5">
          <div className="text-sm text-[var(--muted)]">直推人数</div>
          <div className="mt-2 text-3xl font-semibold">{teamCount}</div>
        </div>
        <div className="surface rounded-[24px] p-5">
          <div className="text-sm text-[var(--muted)]">我的邀请码</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--brand)]">{inviteCode}</div>
        </div>
      </div>

      <div className="surface rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">邀请链接</h2>
        <p className="mt-2 break-all text-sm text-[var(--muted)]">{inviteUrl}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          好友注册时填写你的邀请码，或打开带邀请码的注册页，会成为你的一级下线。
        </p>
      </div>

      <div className="surface space-y-4 rounded-[28px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">一二三级分销比例</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              按实付金额分成。三级合计不能超过 100%。
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
            />
            启用分销
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["level1Percent", "一级分销（直推）"],
              ["level2Percent", "二级分销"],
              ["level3Percent", "三级分销"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="text-[var(--muted)]">{label}</span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="field"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={settings[key]}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, [key]: Number(e.target.value) }))
                  }
                />
                <span>%</span>
              </div>
            </label>
          ))}
        </div>

        <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-[var(--muted)]">
          当前合计：
          {settings.level1Percent + settings.level2Percent + settings.level3Percent}%
          （平台/讲师保留其余部分）
        </div>

        {message ? <p className="text-sm text-[var(--brand)]">{message}</p> : null}
        <button className="btn btn-primary" type="button" disabled={saving} onClick={save}>
          {saving ? "保存中..." : "保存分销设置"}
        </button>
      </div>

      <div className="surface rounded-[28px] p-6">
        <h2 className="text-lg font-semibold">最近佣金记录</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="py-2 font-medium">时间</th>
                <th className="py-2 font-medium">层级</th>
                <th className="py-2 font-medium">受益人</th>
                <th className="py-2 font-medium">买家</th>
                <th className="py-2 font-medium">课程</th>
                <th className="py-2 font-medium">比例</th>
                <th className="py-2 font-medium">佣金</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((row) => (
                <tr key={row.id} className="border-t border-[var(--line)]">
                  <td className="py-3">{new Date(row.createdAt).toLocaleString("zh-CN")}</td>
                  <td className="py-3">{row.level} 级</td>
                  <td className="py-3">{row.beneficiary.name}</td>
                  <td className="py-3">{row.buyer.name}</td>
                  <td className="py-3">{row.order.course.title}</td>
                  <td className="py-3">{row.ratePercent}%</td>
                  <td className="py-3 font-medium text-[var(--brand)]">
                    {formatPrice(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {commissions.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              暂无佣金。有下级用户付费购课后会自动生成。
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
