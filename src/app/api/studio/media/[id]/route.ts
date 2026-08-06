import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ASSET_DESC_MAX, ASSET_NAME_MAX } from "@/lib/media";
import { deleteStoredFile } from "@/lib/storage";
import { requireStudioUser, studioErrorResponse } from "@/lib/studio";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(ASSET_NAME_MAX).optional(),
  description: z.string().trim().max(ASSET_DESC_MAX).optional(),
  categoryId: z.string().nullable().optional(),
  durationSec: z.number().int().min(0).optional(),
});

async function getOwnedAsset(id: string, ownerId: string) {
  return prisma.mediaAsset.findFirst({ where: { id, ownerId } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireStudioUser();
    const { id } = await params;
    const asset = await getOwnedAsset(id, session.id);
    if (!asset) {
      return NextResponse.json({ error: "素材不存在" }, { status: 404 });
    }

    const body = patchSchema.parse(await req.json());
    if (body.categoryId) {
      const category = await prisma.mediaCategory.findFirst({
        where: { id: body.categoryId, ownerId: session.id },
      });
      if (!category) {
        return NextResponse.json({ error: "分类不存在" }, { status: 400 });
      }
    }

    const updated = await prisma.mediaAsset.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.durationSec !== undefined ? { durationSec: body.durationSec } : {}),
      },
      include: { category: true },
    });

    return NextResponse.json({ asset: updated });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireStudioUser();
    const { id } = await params;
    const asset = await getOwnedAsset(id, session.id);
    if (!asset) {
      return NextResponse.json({ error: "素材不存在" }, { status: 404 });
    }

    await prisma.mediaAsset.delete({ where: { id } });
    await deleteStoredFile(asset.fileUrl, session.id, {
      vodVideoId: asset.vodVideoId,
      storageProvider: asset.storageProvider,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
