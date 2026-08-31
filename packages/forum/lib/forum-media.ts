import { parseForumMedia, type ForumMediaItem } from "@andyyyds/forum/lib/forum";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";

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
