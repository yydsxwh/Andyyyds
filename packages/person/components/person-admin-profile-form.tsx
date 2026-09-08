"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PERSON_PROFILE,
  PERSON_ABOUT_MAX,
  PERSON_HEADLINE_MAX,
  PERSON_NAME_MAX,
  type PersonExtraContact,
  type PersonProfilePayload,
} from "@andyyyds/person/lib/person-site";
import {
  fetchPersonAdminProfile,
  savePersonAdminProfile,
} from "@andyyyds/person/lib/person-site-client";
import { PersonImageField } from "@andyyyds/person/components/person-image-field";

type PersonProfileTextKey = {
  [K in keyof PersonProfilePayload]: PersonProfilePayload[K] extends string ? K : never;
}[keyof PersonProfilePayload];

const CONTACT_FIELDS: { key: PersonProfileTextKey; label: string }[] = [
  { key: "email", label: "邮箱" },
  { key: "phone", label: "电话" },
  { key: "wechat", label: "微信" },
  { key: "qq", label: "QQ" },
  { key: "location", label: "地点" },
  { key: "website", label: "个人网站" },
  { key: "github", label: "GitHub" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "zhihu", label: "知乎" },
  { key: "weibo", label: "微博" },
];

export function PersonAdminProfileForm() {
  const [profile, setProfile] = useState<PersonProfilePayload>(DEFAULT_PERSON_PROFILE);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchPersonAdminProfile()
      .then((next) => {
        setProfile(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "加载失败");
        setLoading(false);
      });
  }, []);

  const setField = (key: PersonProfileTextKey, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const setExtra = (index: number, next: PersonExtraContact) => {
    setProfile((current) => {
      const extraContacts = current.extraContacts.slice();
      extraContacts[index] = next;
      return { ...current, extraContacts };
    });
  };

  const onSave = async () => {
    setError("");
    setStatus("保存中…");
    try {
      const saved = await savePersonAdminProfile(profile);
      setProfile(saved);
      setStatus("已保存");
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : "保存失败");
    }
  };

  if (loading) return <p className="text-sm text-[var(--muted)]">加载档案…</p>;

  return (
    <div className="grid gap-4">
      <label className="block text-xs text-[var(--muted)]">
        姓名 / 对外称呼
        <input
          className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
          maxLength={PERSON_NAME_MAX}
          value={profile.displayName}
          onChange={(e) => setField("displayName", e.target.value)}
        />
      </label>
      <label className="block text-xs text-[var(--muted)]">
        一句话介绍
        <input
          className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
          maxLength={PERSON_HEADLINE_MAX}
          value={profile.headline}
          onChange={(e) => setField("headline", e.target.value)}
        />
      </label>
      <label className="block text-xs text-[var(--muted)]">
        About me
        <textarea
          className="field mt-1 min-h-40 w-full rounded-xl px-3 py-3 text-sm"
          maxLength={PERSON_ABOUT_MAX}
          value={profile.about}
          onChange={(e) => setField("about", e.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <PersonImageField
          label="头像"
          value={profile.avatarUrl}
          onChange={(url) => setField("avatarUrl", url)}
        />
        <PersonImageField
          label="封面"
          value={profile.coverUrl}
          onChange={(url) => setField("coverUrl", url)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CONTACT_FIELDS.map((field) => (
          <label key={field.key} className="block text-xs text-[var(--muted)]">
            {field.label}
            <input
              className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
              value={String(profile[field.key] || "")}
              onChange={(e) => setField(field.key, e.target.value)}
            />
          </label>
        ))}
      </div>
      <p className="text-sm text-[var(--muted)]">
        B站 / 抖音 / 小红书 / 视频号主页请到「自媒体同步」填写，避免两处各写一份。
      </p>
      <div>
        <p className="text-xs text-[var(--muted)]">额外联系方式</p>
        <div className="mt-2 grid gap-2">
          {profile.extraContacts.map((item, index) => (
            <div key={`${item.label}-${index}`} className="grid gap-2 sm:grid-cols-3">
              <input
                className="field min-h-11 rounded-xl px-3 text-sm"
                placeholder="名称"
                value={item.label}
                onChange={(e) => setExtra(index, { ...item, label: e.target.value })}
              />
              <input
                className="field min-h-11 rounded-xl px-3 text-sm"
                placeholder="内容"
                value={item.value}
                onChange={(e) => setExtra(index, { ...item, value: e.target.value })}
              />
              <input
                className="field min-h-11 rounded-xl px-3 text-sm"
                placeholder="链接（可选）"
                value={item.href}
                onChange={(e) => setExtra(index, { ...item, href: e.target.value })}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-secondary mt-2 min-h-11 px-3 text-sm"
          onClick={() =>
            setProfile((current) => ({
              ...current,
              extraContacts: [...current.extraContacts, { label: "", value: "", href: "" }],
            }))
          }
        >
          加一种联系方式
        </button>
      </div>
      {error ? <p className="text-sm text-[var(--fire)]">{error}</p> : null}
      {status ? <p className="text-sm text-[var(--muted)]">{status}</p> : null}
      <button type="button" className="btn btn-primary min-h-11 px-4 text-sm" onClick={() => void onSave()}>
        保存档案
      </button>
    </div>
  );
}
