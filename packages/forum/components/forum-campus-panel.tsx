"use client";

import { ForumSchoolVerifyForm, type ForumVerifySlotView } from "@andyyyds/forum/components/forum-school-verify-form";

type Uni = { id: string; name: string; slug: string; region?: string };

type Props = {
  universities: Uni[];
  slots: ForumVerifySlotView[];
};

export function ForumCampusPanel({ universities, slots }: Props) {
  const undergrad = slots.find((slot) => slot.degreeLevel === "UNDERGRAD");
  const graduate = slots.find((slot) => slot.degreeLevel === "GRADUATE");

  if (universities.length === 0) {
    return (
      <section className="surface rounded-[28px] p-5">
        <h2 className="text-lg font-semibold">大学论坛</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          站长尚未开放高校分区。
        </p>
      </section>
    );
  }

  return (
    <section className="surface rounded-[28px] p-5">
      <h2 className="text-lg font-semibold">大学论坛 · 实名学校认证</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        每人只能认证一所本科学校，研究生可再认证一所。通过后可在对应学校发帖，并能看「仅本校认证用户可见」的内容。
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <StatusChip
          label="本科"
          slot={undergrad}
          universities={universities}
        />
        <StatusChip
          label="研究生"
          slot={graduate}
          universities={universities}
        />
        <a
          className="btn btn-secondary inline-flex min-h-11 items-center justify-center px-5"
          href="/forum/mine"
        >
          我的帖子
        </a>
        <a
          className="btn btn-secondary inline-flex min-h-11 items-center justify-center px-5"
          href="/forum"
        >
          逛论坛
        </a>
      </div>
      <div className="mt-4">
        <ForumSchoolVerifyForm universities={universities} slots={slots} />
      </div>
    </section>
  );
}

function StatusChip({
  label,
  slot,
  universities,
}: {
  label: string;
  slot?: ForumVerifySlotView;
  universities: Uni[];
}) {
  if (!slot) {
    return (
      <span className="inline-flex min-h-11 items-center rounded-full bg-[var(--line)]/40 px-4 text-[var(--muted)]">
        {label}未认证
      </span>
    );
  }
  const uni =
    universities.find((item) => item.id === slot.universityId) ||
    (slot.universitySlug
      ? { slug: slot.universitySlug, name: slot.universityName || label }
      : null);
  const statusText =
    slot.status === "VERIFIED"
      ? "已认证"
      : slot.status === "PENDING"
        ? "审核中"
        : "未通过";
  if (uni?.slug) {
    return (
      <a
        className="inline-flex min-h-11 items-center rounded-full bg-[var(--brand)]/10 px-4 text-[var(--brand)]"
        href={`/forum/${uni.slug}`}
      >
        {label} · {slot.universityName || uni.name} · {statusText}
      </a>
    );
  }
  return (
    <span className="inline-flex min-h-11 items-center rounded-full bg-[var(--line)]/40 px-4">
      {label} · {statusText}
    </span>
  );
}
