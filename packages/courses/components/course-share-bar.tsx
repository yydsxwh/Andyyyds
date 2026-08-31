"use client";

/**
 * 课程/资料详情页分享：带邀请码的链接 + 简易海报入口（登录后可见自己的码）。
 */

import { useEffect, useState } from "react";
import { InviteSharePanel } from "@/components/invite-share-panel";
import { productTypeLabel } from "@andyyyds/shared/product-types";

type Props = {
  slug: string;
  title: string;
  inviteCode?: string;
  productType?: string;
};

export function CourseShareBar({
  slug,
  title,
  inviteCode = "",
  productType = "COURSE",
}: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(inviteCode);
  const kind = productTypeLabel(productType);

  useEffect(() => {
    setCode(inviteCode);
  }, [inviteCode]);

  if (!code) {
    return (
      <div className="surface mt-4 rounded-2xl p-4 text-sm text-[var(--muted)]">
        登录后可生成带你邀请码的{kind}分享链接与海报，好友购买后计入你的分销业绩。
      </div>
    );
  }

  return (
    <div className="surface mt-4 space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">分享本{kind}赚提成</div>
          <div className="text-xs text-[var(--muted)]">
            链接与海报均带邀请码 {code}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary min-h-10 px-3 text-sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "收起" : "分享 / 海报"}
        </button>
      </div>
      {open ? (
        <InviteSharePanel
          inviteCode={code}
          courseSlug={slug}
          courseTitle={title}
          productType={productType}
        />
      ) : null}
    </div>
  );
}
