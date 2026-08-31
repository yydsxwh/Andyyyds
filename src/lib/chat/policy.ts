/**
 * 大陆合规开关：可一键关闭「找人私聊 / 群聊」等社交 IM，
 * 但保留商品/约搭页面向商家或发起人的咨询私信。
 */
import { CHAT_KIND, CHAT_SOURCE, type ChatSource } from "@/lib/chat/constants";
import { FORUM_CLOSED } from "@/lib/forum";
import { isAdmin, type RoleInput } from "@/lib/roles";

/** 合规模式下仍允许的会话来源（产品/约搭咨询私信） */
export const CONSULT_CHAT_SOURCES: ChatSource[] = [
  CHAT_SOURCE.PRODUCT_CONSULT,
  CHAT_SOURCE.MEETUP_CONSULT,
];

export function isConsultChatSource(source: string): boolean {
  return (CONSULT_CHAT_SOURCES as string[]).includes(source);
}

export async function getHideSocialChatFlag(): Promise<boolean> {
  const { getSiteSettings } = await import("@/lib/site-settings");
  const row = await getSiteSettings();
  return Boolean(row.hideSocialChat);
}

/** 社交建群 / 找人私聊等：开启合规隐藏时拒绝 */
export async function assertSocialChatEnabled(): Promise<void> {
  if (await getHideSocialChatFlag()) {
    throw new Error("站内社交聊天已关闭，仅保留产品咨询私信");
  }
}

/** 发起直聊时：合规模式下只允许咨询来源；论坛私信另受论坛开关约束，站长不受限 */
export async function assertCanStartDirectChat(
  source: ChatSource,
  requester?: RoleInput | null,
): Promise<void> {
  if (source === CHAT_SOURCE.FORUM_DM) {
    if (requester && isAdmin(requester)) return;
    const { getForumSiteConfig } = await import("@/lib/forum-settings");
    const cfg = await getForumSiteConfig();
    if (!cfg.allowMemberMessage) {
      throw new Error(FORUM_CLOSED.message);
    }
    if (await getHideSocialChatFlag()) {
      throw new Error("站内社交私聊已关闭，请通过产品页咨询商家");
    }
    return;
  }
  if (!(await getHideSocialChatFlag())) return;
  if (!isConsultChatSource(source)) {
    throw new Error("站内社交私聊已关闭，请通过产品页咨询商家");
  }
}

/** 列表/未读过滤：合规模式下只保留咨询私信，隐藏一切群聊 */
export function socialChatListWhere(hideSocialChat: boolean) {
  if (!hideSocialChat) return {};
  return {
    conversation: {
      kind: CHAT_KIND.DIRECT,
      source: { in: [...CONSULT_CHAT_SOURCES] },
    },
  };
}
