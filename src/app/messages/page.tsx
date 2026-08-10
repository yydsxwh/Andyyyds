import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatInboxClient } from "@/components/chat/chat-inbox-client";
import { getSession } from "@/lib/auth";
import { getHideSocialChatFlag } from "@/lib/site-settings";
import { listConversationsForUser } from "@/lib/chat/service";
import { resolveStoredAccessUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "消息",
};

export default async function MessagesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/messages");

  const [conversations, hideSocialChat] = await Promise.all([
    listConversationsForUser(session.id),
    getHideSocialChatFlag(),
  ]);
  const withAvatars = await Promise.all(
    conversations.map(async (c) => ({
      ...c,
      peer: c.peer
        ? {
            ...c.peer,
            avatarUrl: c.peer.avatarUrl
              ? (await resolveStoredAccessUrl(c.peer.avatarUrl)) ||
                c.peer.avatarUrl
              : "",
          }
        : null,
    })),
  );

  return (
    <div className="container space-y-4 py-6 sm:py-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">消息</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {hideSocialChat
              ? "产品/约搭咨询私信；对方确认后即可沟通"
              : "私聊/群邀请需对方确认；约搭报名与购课会自动进群"}
          </p>
        </div>
        {/* 合规模式下隐藏社交建群与首页找人入口，咨询私信列表仍可用 */}
        {!hideSocialChat ? (
          <div className="flex flex-col items-end gap-1 text-sm">
            <Link
              href="/messages/new-group"
              className="min-h-11 inline-flex items-center text-[var(--brand)] touch-manipulation"
            >
              发起群聊
            </Link>
            <Link href="/" className="text-[var(--muted)]">
              首页找人
            </Link>
          </div>
        ) : null}
      </div>
      <ChatInboxClient initialConversations={withAvatars} />
    </div>
  );
}
