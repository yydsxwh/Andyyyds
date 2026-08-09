import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatInboxClient } from "@/components/chat/chat-inbox-client";
import { getSession } from "@/lib/auth";
import { listConversationsForUser } from "@/lib/chat/service";
import { resolveStoredAccessUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "消息",
};

export default async function MessagesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/messages");

  const conversations = await listConversationsForUser(session.id);
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
            私聊需对方确认接受后才能发送消息
          </p>
        </div>
        <Link href="/" className="text-sm text-[var(--brand)]">
          去首页找人
        </Link>
      </div>
      <ChatInboxClient initialConversations={withAvatars} />
    </div>
  );
}
