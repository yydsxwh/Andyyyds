"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FORUM_CAMPUS_EMAIL_MAX,
  FORUM_REAL_NAME_MAX,
  FORUM_STUDENT_ID_MAX,
} from "@andyyyds/forum/lib/forum";
import {
  FORUM_DEGREE_LABEL,
  FORUM_VERIFY_STATUS_LABEL,
  type ForumDegreeLevel,
} from "@andyyyds/forum/lib/forum-school";
import { FORUM_UNIVERSITY_REGION_LABEL } from "@andyyyds/forum/lib/forum-university";
import {
  classifyForumFile,
  uploadForumMediaFile,
} from "@andyyyds/forum/lib/forum-browser-upload";

export type ForumVerifyUniversityOption = {
  id: string;
  name: string;
  slug: string;
  region?: string;
};

export type ForumVerifySlotView = {
  degreeLevel: string;
  universityId: string;
  universityName?: string;
  universitySlug?: string;
  status: string;
  realName?: string;
  studentId?: string;
  campusEmail?: string;
  proofUrl?: string;
  /** 已签发的 inline 预览链；没有则回退 proofUrl */
  proofPreview?: string;
  reviewNote?: string;
};

type Props = {
  universities: ForumVerifyUniversityOption[];
  /** 在某校分区页认证时锁定学校；个人中心则靠下拉选择 */
  lockedUniversityId?: string;
  slots: ForumVerifySlotView[];
  defaultDegree?: ForumDegreeLevel;
  compact?: boolean;
};

function slotOf(
  slots: ForumVerifySlotView[],
  degree: ForumDegreeLevel,
): ForumVerifySlotView | undefined {
  return slots.find((slot) => slot.degreeLevel === degree);
}

export function ForumSchoolVerifyForm({
  universities,
  lockedUniversityId = "",
  slots,
  defaultDegree,
  compact = false,
}: Props) {
  const router = useRouter();
  const locked = universities.find((item) => item.id === lockedUniversityId);
  const initialDegree: ForumDegreeLevel =
    defaultDegree ||
    (slotOf(slots, "UNDERGRAD") ? "GRADUATE" : "UNDERGRAD");
  const [degreeLevel, setDegreeLevel] = useState<ForumDegreeLevel>(initialDegree);
  const currentSlot = slotOf(slots, degreeLevel);
  const [universityId, setUniversityId] = useState(
    lockedUniversityId || currentSlot?.universityId || universities[0]?.id || "",
  );
  const [realName, setRealName] = useState(currentSlot?.realName || "");
  const [studentId, setStudentId] = useState(currentSlot?.studentId || "");
  const [campusEmail, setCampusEmail] = useState(currentSlot?.campusEmail || "");
  const [proofUrl, setProofUrl] = useState(currentSlot?.proofUrl || "");
  const [proofPreview, setProofPreview] = useState(
    currentSlot?.proofPreview || currentSlot?.proofUrl || "",
  );
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedName =
    locked?.name ||
    universities.find((item) => item.id === universityId)?.name ||
    "该校";

  const occupying = useMemo(() => {
    const slot = slotOf(slots, degreeLevel);
    if (!slot) return "";
    if (lockedUniversityId && slot.universityId === lockedUniversityId) return "";
    if (!lockedUniversityId && slot.universityId === universityId) return "";
    return slot.universityName || "另一所学校";
  }, [degreeLevel, lockedUniversityId, slots, universityId]);

  const chinaUnis = useMemo(
    () =>
      universities.filter((uni) => (uni.region || "CHINA") !== "INTERNATIONAL"),
    [universities],
  );
  const intlUnis = useMemo(
    () => universities.filter((uni) => uni.region === "INTERNATIONAL"),
    [universities],
  );

  function applyDegree(next: ForumDegreeLevel) {
    setDegreeLevel(next);
    const slot = slotOf(slots, next);
    if (slot) {
      if (!lockedUniversityId) setUniversityId(slot.universityId);
      setRealName(slot.realName || "");
      setStudentId(slot.studentId || "");
      setCampusEmail(slot.campusEmail || "");
      setProofUrl(slot.proofUrl || "");
      setProofPreview(slot.proofPreview || slot.proofUrl || "");
    }
    setError("");
    setHint("");
  }

  async function onPickProof(file: File | null) {
    if (!file) return;
    if (classifyForumFile(file) !== "image") {
      setError("学生证请上传图片（jpg / png / webp / gif）");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadForumMediaFile(file);
      // 入库用 canonical URL；预览用签名链，避免私有 OSS 在 <img> 里 403
      setProofUrl(uploaded.url);
      setProofPreview(uploaded.previewUrl || uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "学生证上传失败");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!universityId) {
      setError("请选择学校");
      return;
    }
    if (
      occupying &&
      !window.confirm(
        `你的${FORUM_DEGREE_LABEL[degreeLevel]}档已认证「${occupying}」。每人限一所本科和一所研究生，确定改成本校？`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setHint("");
    try {
      const res = await fetch("/api/forum/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityId,
          degreeLevel,
          realName,
          studentId,
          campusEmail,
          proofUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "提交失败");
        return;
      }
      setHint(data.message || "已提交");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="grid grid-cols-2 gap-2">
        {(["UNDERGRAD", "GRADUATE"] as const).map((degree) => {
          const slot = slotOf(slots, degree);
          const active = degreeLevel === degree;
          return (
            <button
              key={degree}
              type="button"
              className={`min-h-11 rounded-2xl border px-3 text-sm ${
                active
                  ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "border-[var(--line)]"
              }`}
              onClick={() => applyDegree(degree)}
            >
              <span className="block font-medium">{FORUM_DEGREE_LABEL[degree]}</span>
              <span className="block truncate text-xs text-[var(--muted)]">
                {slot
                  ? `${slot.universityName || "已选学校"} · ${
                      FORUM_VERIFY_STATUS_LABEL[
                        slot.status as keyof typeof FORUM_VERIFY_STATUS_LABEL
                      ] || slot.status
                    }`
                  : "未认证"}
              </span>
            </button>
          );
        })}
      </div>

      {lockedUniversityId ? null : (
        <label className="block text-sm">
          <span className="text-[var(--muted)]">学校</span>
          <select
            className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
            value={universityId}
            onChange={(e) => setUniversityId(e.target.value)}
          >
            <option value="">选择高校分区</option>
            {chinaUnis.length > 0 ? (
              <optgroup label={FORUM_UNIVERSITY_REGION_LABEL.CHINA}>
                {chinaUnis.map((uni) => (
                  <option key={uni.id} value={uni.id}>
                    {uni.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {intlUnis.length > 0 ? (
              <optgroup label={FORUM_UNIVERSITY_REGION_LABEL.INTERNATIONAL}>
                {intlUnis.map((uni) => (
                  <option key={uni.id} value={uni.id}>
                    {uni.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
      )}

      <label className="block text-sm">
        <span className="text-[var(--muted)]">真实姓名</span>
        <input
          className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
          value={realName}
          onChange={(e) => setRealName(e.target.value)}
          maxLength={FORUM_REAL_NAME_MAX}
          autoComplete="name"
          placeholder="与学生证一致"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">学号</span>
        <input
          className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          maxLength={FORUM_STUDENT_ID_MAX}
          inputMode="text"
          placeholder="在校学号"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--muted)]">校园邮箱（选填）</span>
        <input
          className="mt-1 w-full min-h-11 rounded-2xl border border-[var(--line)] bg-transparent px-3"
          value={campusEmail}
          onChange={(e) => setCampusEmail(e.target.value)}
          maxLength={FORUM_CAMPUS_EMAIL_MAX}
          type="email"
          placeholder="命中学校后缀可当场通过"
        />
      </label>
      <div className="block text-sm">
        <span className="text-[var(--muted)]">学生证 / 学生卡照片</span>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          拍清晰的正面。站点启用 OSS 时文件进 Bucket；后台「查看图片」在页内预览，不会直接下载。
        </p>
        {proofPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proofPreview}
            alt="学生证预览"
            className="mt-2 max-h-40 w-full rounded-2xl border border-[var(--line)] object-contain"
          />
        ) : null}
        <label className="btn btn-secondary mt-2 inline-flex min-h-11 cursor-pointer items-center justify-center px-5 touch-manipulation">
          {busy ? "上传中…" : proofUrl ? "重新上传" : "上传照片"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              e.target.value = "";
              void onPickProof(file);
            }}
          />
        </label>
      </div>

      {occupying ? (
        <p className="text-xs leading-5 text-amber-800">
          {FORUM_DEGREE_LABEL[degreeLevel]}档目前是「{occupying}」。提交后会改成
          {selectedName}。
        </p>
      ) : null}
      {currentSlot?.status === "PENDING" &&
      currentSlot.universityId === (lockedUniversityId || universityId) ? (
        <p className="text-xs leading-5 text-[var(--muted)]">
          该档正在审核，站长通过后即可发仅本校可见帖。
        </p>
      ) : null}
      {currentSlot?.status === "REJECTED" && currentSlot.reviewNote ? (
        <p className="text-xs leading-5 text-[var(--brand)]">
          未通过：{currentSlot.reviewNote}
        </p>
      ) : null}

      {error ? <p className="text-sm text-[var(--brand)]">{error}</p> : null}
      {hint ? <p className="text-sm text-[var(--muted)]">{hint}</p> : null}

      <button
        type="button"
        className="btn btn-primary min-h-11 w-full sm:w-auto sm:px-6"
        disabled={busy || !universityId}
        onClick={() => void submit()}
      >
        {busy ? "提交中…" : `认证${selectedName}（${FORUM_DEGREE_LABEL[degreeLevel]}）`}
      </button>
    </div>
  );
}
