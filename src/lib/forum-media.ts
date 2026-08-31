import { parseForumMedia, type ForumMediaItem } from "@/lib/forum";
import { resolveStoredAccessUrl } from "@/lib/storage";

export async function signForumMedia(
  items: ForumMediaItem[],
): Promise<ForumMediaItem[]> {
  return Promise.all(
    items.map(async (item) => ({
      kind: item.kind,
      url: (await resolveStoredAccessUrl(item.url)) || item.url,
    })),
  );
}

export async function signedForumMediaFromJson(raw: string | null | undefined) {
  return signForumMedia(parseForumMedia(raw));
}
