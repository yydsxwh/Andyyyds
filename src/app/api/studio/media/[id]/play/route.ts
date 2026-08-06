import { NextResponse } from "next/server";
import { resolveMediaPlayUrl } from "@/lib/aliyun-vod";
import { prisma } from "@/lib/db";
import { requireStudioUser, studioErrorResponse } from "@/lib/studio";

export const runtime = "nodejs";

/** 素材预览：点播会签发临时播放地址并跳转 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireStudioUser();
    const { id } = await params;
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, ownerId: session.id },
    });
    if (!asset) {
      return NextResponse.json({ error: "素材不存在" }, { status: 404 });
    }

    const playUrl = await resolveMediaPlayUrl(asset.fileUrl);
    if (!playUrl) {
      return NextResponse.json({ error: "暂无播放地址" }, { status: 404 });
    }
    return NextResponse.redirect(playUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取播放地址失败";
    if (message.includes("处理中")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json(
      { error: mapped.error === "无权访问" ? mapped.error : message },
      { status: mapped.status === 401 || mapped.status === 403 ? mapped.status : 400 },
    );
  }
}
