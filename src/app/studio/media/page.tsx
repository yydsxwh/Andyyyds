import { redirect } from "next/navigation";
import { MediaCenter } from "@/components/media-center";
import { StudioNav } from "@/components/studio-nav";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StudioMediaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "TEACHER" && session.role !== "ADMIN") {
    redirect("/studio");
  }

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
      <MediaCenter initialCategories={categories} initialAssets={assets} />
    </div>
  );
}
