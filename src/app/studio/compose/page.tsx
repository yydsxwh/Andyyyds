import Link from "next/link";
import { redirect } from "next/navigation";
import { ComposeProductForm } from "@/components/compose-product-form";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StudioComposePage({
  searchParams,
}: {
  searchParams: Promise<{ assets?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "TEACHER" && session.role !== "ADMIN") {
    redirect("/studio");
  }

  const params = await searchParams;
  const initialSelectedIds = (params.assets || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const assets = await prisma.mediaAsset.findMany({
    where: { ownerId: session.id },
    include: { category: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="compose" />
      <div>
        <h1 className="text-3xl font-semibold">用素材做课 / 专栏</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          多选素材、调整顺序，一键生成可售卖的单课或专栏。
          {assets.length === 0 ? (
            <>
              {" "}
              还没有素材？先去{" "}
              <Link href="/studio/media" className="text-[var(--brand)]">
                素材中心
              </Link>{" "}
              上传。
            </>
          ) : null}
        </p>
      </div>
      <ComposeProductForm assets={assets} initialSelectedIds={initialSelectedIds} />
    </div>
  );
}
