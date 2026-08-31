import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateGroupForm } from "@/components/chat/create-group-form";
import { getSession } from "@andyyyds/shared/auth";
import { getHideSocialChatFlag } from "@andyyyds/shared/site-settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "发起群聊" };

export default async function NewGroupPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/messages/new-group");
  // 合规隐藏社交群聊：直达建群页也拦截回消息列表
  if (await getHideSocialChatFlag()) redirect("/messages");

  return (
    <div className="container max-w-lg space-y-4 py-6 sm:py-10">
      <div className="flex items-center gap-3">
        <Link
          href="/messages"
          className="min-h-11 inline-flex items-center text-sm text-[var(--brand)]"
        >
          ← 消息
        </Link>
        <h1 className="text-xl font-semibold">发起群聊</h1>
      </div>
      <CreateGroupForm />
    </div>
  );
}
