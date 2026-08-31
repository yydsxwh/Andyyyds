"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ForumSchoolVerifyForm, type ForumVerifySlotView } from "@andyyyds/forum/components/forum-school-verify-form";

type Props = {
  universityId: string;
  universitySlug: string;
  universityName: string;
  loggedIn: boolean;
  isMember: boolean;
  isVerified: boolean;
  isAdminUser: boolean;
  loginNext: string;
  allowPost?: boolean;
  hideComposeOnMobile?: boolean;
  slots?: ForumVerifySlotView[];
};

export function ForumJoinBar({
  universityId,
  universitySlug,
  universityName,
  loggedIn,
  isMember,
  isVerified,
  isAdminUser,
  loginNext,
  allowPost = true,
  hideComposeOnMobile = false,
  slots = [],
}: Props) {
  const router = useRouter();
  const [openVerify, setOpenVerify] = useState(false);
  const here = slots.find((slot) => slot.universityId === universityId);
  const defaultDegree =
    here?.degreeLevel === "GRADUATE"
      ? "GRADUATE"
      : here?.degreeLevel === "UNDERGRAD"
        ? "UNDERGRAD"
        : slots.some((slot) => slot.degreeLevel === "UNDERGRAD")
          ? "GRADUATE"
          : "UNDERGRAD";

  if (isMember || isAdminUser) {
    if (!allowPost) {
      return (
        <p className="max-w-xs text-sm leading-6 text-[var(--muted)]">
          站长已关闭普通用户发帖，仅站长可发。
        </p>
      );
    }
    return (
      <div className="flex max-w-sm flex-col items-stretch gap-2 sm:items-end">
        <a
          href={`/forum/${universitySlug}/new`}
          className={`btn btn-primary inline-flex min-h-11 items-center justify-center px-5 ${
            hideComposeOnMobile ? "hidden sm:inline-flex" : ""
          }`}
        >
          发帖
        </a>
        {isVerified ? (
          <p className="text-xs text-[var(--muted)]">已认证本校</p>
        ) : (
          <button
            type="button"
            className="min-h-11 text-left text-sm text-[var(--brand)] sm:text-right"
            onClick={() => setOpenVerify((open) => !open)}
          >
            {openVerify ? "收起认证" : "实名认证本校，可发仅本校可见帖"}
          </button>
        )}
        {openVerify && loggedIn ? (
          <div className="w-full rounded-[24px] border border-[var(--line)] p-3 sm:w-80">
            <ForumSchoolVerifyForm
              universities={[
                { id: universityId, name: universityName, slug: universitySlug },
              ]}
              lockedUniversityId={universityId}
              slots={slots}
              defaultDegree={defaultDegree}
              compact
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <button
        type="button"
        className="btn btn-primary min-h-11 w-full sm:w-auto sm:px-6"
        onClick={() =>
          router.push(`/login?next=${encodeURIComponent(loginNext)}`)
        }
      >
        登录后实名认证本校
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-3 rounded-[24px] border border-[var(--line)] p-3">
      <p className="text-sm leading-6 text-[var(--muted)]">
        认证一所本科、可选再认证一所研究生后，即可在对应学校发帖。
      </p>
      <ForumSchoolVerifyForm
        universities={[
          { id: universityId, name: universityName, slug: universitySlug },
        ]}
        lockedUniversityId={universityId}
        slots={slots}
        defaultDegree={defaultDegree}
        compact
      />
    </div>
  );
}

/** 手机微信：右下角发帖，避开刘海与底部安全区 */
export function ForumComposeFab({ slug }: { slug: string }) {
  return (
    <a
      href={`/forum/${slug}/new`}
      className="fixed right-4 z-40 flex min-h-12 min-w-12 items-center justify-center rounded-full bg-[var(--brand)] text-2xl leading-none text-white shadow-lg sm:hidden"
      style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
      aria-label="发帖"
    >
      +
    </a>
  );
}
