import { redirect, notFound } from "next/navigation";
import { ChatThreadClient } from "@/components/chat/chat-thread-client";
import { getSession } from "@/lib/auth";
import {
  getConversationForUser,
  listMessages,
} from "@/lib/chat/service";
import { resolveStoredAccessUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) {
    const { id } = await params;
    redirect(`/login?next=/messages/${id}`);
  }

  const { id } = await params;
  try {
    const [conversation, messages] = await Promise.all([
      getConversationForUser(id, session.id),
      listMessages({ conversationId: id, userId: session.id }),
    ]);

    const peerAvatar = conversation.peer?.avatarUrl
      ? (await resolveStoredAccessUrl(conversation.peer.avatarUrl)) ||
        conversation.peer.avatarUrl
      : "";

    return (
      <div className="container py-4 sm:py-8">
        <ChatThreadClient
          conversationId={id}
          currentUserId={session.id}
          initialConversation={{
            ...conversation,
            peer: conversation.peer
              ? { ...conversation.peer, avatarUrl: peerAvatar }
              : null,
          }}
          initialMessages={messages}
        />
      </div>
    );
  } catch {
    notFound();
  }
}
