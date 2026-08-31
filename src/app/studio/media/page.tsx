import { redirect } from "next/navigation";
import { MediaCenter } from "@/components/media-center";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { classifyMediaKind } from "@andyyyds/shared/media";
import { canCreateSellableProducts, canDeleteMedia, canManageMedia } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

/** 按 MIME/文件名回填历史素材的 type（mediaKind），仅修正与识别结果不一致的行 */
async function backfillMediaKinds(ownerId: string) {
  const assets = await prisma.mediaAsset.findMany({
    where: { ownerId },
    select: { id: true, type: true, mimeType: true, fileName: true },
  });
  const fixes = assets.filter((asset) => {
    const kind = classifyMediaKind(asset.mimeType, asset.fileName);
    return kind !== asset.type;
  });
  if (fixes.length === 0) return;
  await Promise.all(
    fixes.map((asset) =>
      prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { type: classifyMediaKind(asset.mimeType, asset.fileName) },
      }),
    ),
  );
}

export default async function StudioMediaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageMedia(session.role)) {
    redirect("/studio");
  }

  await backfillMediaKinds(session.id);

  const [categories, assets] = await Promise.all([
    prisma.mediaCategory.findMany({
      where: { ownerId: session.id },
      include: { _count: { select: { assets: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.mediaAsset.findMany({
      where: { ownerId: session.id },
      include: { category: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div className="container space-y-6 py-12">
      <StudioNav current="media" />
      <MediaCenter
        initialCategories={categories}
        initialAssets={assets}
        canDelete={canDeleteMedia(session.role)}
        canCreateSellable={canCreateSellableProducts(session.role)}
      />
    </div>
  );
}
