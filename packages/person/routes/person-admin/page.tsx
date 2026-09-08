import Link from "next/link";
import { PERSON_ENTRY_KIND_LABEL, PERSON_ENTRY_KINDS } from "@andyyyds/person/lib/person-site";
import { getPersonProfile, listPersonEntries } from "@andyyyds/person/lib/person-site-store";

export default async function PersonAdminHomePage() {
  const [profile, entries] = await Promise.all([getPersonProfile(), listPersonEntries()]);
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-[var(--line)] p-4 sm:p-5">
        <p className="text-xs text-[var(--muted)]">当前对外名称</p>
        <p className="mt-1 text-xl font-semibold">{profile.displayName || "还没写姓名"}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">{profile.headline || "还没写一句话介绍"}</p>
        <Link href="/person-admin/profile" className="btn btn-primary mt-4 inline-flex min-h-11 px-4 text-sm">
          编辑档案
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PERSON_ENTRY_KINDS.map((kind) => {
          const count = entries.filter((item) => item.kind === kind).length;
          return (
            <Link
              key={kind}
              href={`/person-admin/entries/${kind.toLowerCase()}`}
              className="min-h-11 rounded-2xl border border-[var(--line)] p-4"
            >
              <p className="font-medium">{PERSON_ENTRY_KIND_LABEL[kind]}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{count} 条</p>
            </Link>
          );
        })}
      </div>
      <Link href="/person-admin/social" className="btn btn-secondary min-h-11 px-4 text-sm">
        去同步抖音 / B站 / 小红书 / 视频号
      </Link>
    </div>
  );
}
