/**
 * 站内私聊业务：请求→对方确认→ACTIVE 后才能发消息。
 * 群聊 kind 已预留，第一期 UI/API 以 DIRECT 为主。
 */
import { prisma } from "@/lib/db";
import {
  CHAT_KIND,
  CHAT_MEMBER_ROLE,
  CHAT_MESSAGE_TYPE,
  CHAT_SEARCH_LIMIT,
  CHAT_SOURCE,
  CHAT_STATUS,
  CHAT_TEXT_MAX_LEN,
  type ChatSource,
} from "@/lib/chat/constants";
import { buildDirectKey } from "@/lib/chat/direct-key";
import { getChatRealtimeHub } from "@/lib/chat/realtime-hub";

function previewOf(type: string, body: string): string {
  if (type === CHAT_MESSAGE_TYPE.IMAGE) return "[图片]";
  if (type === CHAT_MESSAGE_TYPE.SYSTEM) return body.slice(0, 80);
  return body.slice(0, 80);
}

export async function searchUsersForChat(viewerId: string, q: string) {
  const query = q.trim().slice(0, 40);
  if (query.length < 1) return [];

  const rows = await prisma.user.findMany({
    where: {
      id: { not: viewerId },
      name: { contains: query },
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
    },
    take: CHAT_SEARCH_LIMIT,
    orderBy: { name: "asc" },
  });
  return rows;
}

export async function requestDirectChat(input: {
  requesterId: string;
  peerUserId: string;
  source: ChatSource;
  relatedCourseId?: string;
  relatedMeetupId?: string;
}) {
  const peerUserId = input.peerUserId.trim();
  if (!peerUserId) throw new Error("请选择聊天对象");
  if (peerUserId === input.requesterId) {
    throw new Error("不能与自己发起私聊");
  }

  const peer = await prisma.user.findUnique({
    where: { id: peerUserId },
    select: { id: true, name: true },
  });
  if (!peer) throw new Error("用户不存在");

  const directKey = buildDirectKey(input.requesterId, peerUserId);
  const existing = await prisma.chatConversation.findFirst({
    where: {
      kind: CHAT_KIND.DIRECT,
      directKey,
      status: { in: [CHAT_STATUS.PENDING, CHAT_STATUS.ACTIVE] },
    },
    include: {
      members: true,
    },
  });
  if (existing) {
    return { conversation: existing, created: false as const };
  }

  const requester = await prisma.user.findUnique({
    where: { id: input.requesterId },
    select: { name: true },
  });
  const sourceLabel =
    input.source === CHAT_SOURCE.PRODUCT_CONSULT
      ? "通过产品咨询"
      : input.source === CHAT_SOURCE.MEETUP_CONSULT
        ? "通过约搭咨询"
        : "通过站内搜索";
  const systemBody = `${requester?.name || "用户"} ${sourceLabel}请求与你私聊，请确认是否接受。`;

  const conversation = await prisma.$transaction(async (tx) => {
    const conv = await tx.chatConversation.create({
      data: {
        kind: CHAT_KIND.DIRECT,
        status: CHAT_STATUS.PENDING,
        directKey,
        initiatedById: input.requesterId,
        peerUserId,
        source: input.source,
        relatedCourseId: input.relatedCourseId || "",
        relatedMeetupId: input.relatedMeetupId || "",
        lastMessageAt: new Date(),
        lastMessagePreview: systemBody.slice(0, 80),
        members: {
          create: [
            {
              userId: input.requesterId,
              memberRole: CHAT_MEMBER_ROLE.REQUESTER,
              unreadCount: 0,
            },
            {
              userId: peerUserId,
              memberRole: CHAT_MEMBER_ROLE.RECIPIENT,
              unreadCount: 1,
            },
          ],
        },
        messages: {
          create: {
            senderId: input.requesterId,
            type: CHAT_MESSAGE_TYPE.SYSTEM,
            body: systemBody,
          },
        },
      },
      include: { members: true },
    });
    return conv;
  });

  getChatRealtimeHub().publishToUsers([input.requesterId, peerUserId], {
    type: "conversation",
    conversationId: conversation.id,
    status: conversation.status,
  });

  return { conversation, created: true as const };
}

export async function acceptDirectChat(conversationId: string, userId: string) {
  const conv = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: { members: true },
  });
  if (!conv || conv.kind !== CHAT_KIND.DIRECT) {
    throw new Error("会话不存在");
  }
  if (conv.status !== CHAT_STATUS.PENDING) {
    throw new Error("当前状态无法接受");
  }
  const me = conv.members.find((m) => m.userId === userId);
  if (!me || me.memberRole !== CHAT_MEMBER_ROLE.RECIPIENT) {
    throw new Error("只有被请求方可以接受");
  }

  const systemBody = "对方已接受私聊，现在可以开始聊天了。";
  const updated = await prisma.$transaction(async (tx) => {
    await tx.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        type: CHAT_MESSAGE_TYPE.SYSTEM,
        body: systemBody,
      },
    });
    // 发起人应看到「已接受」提示
    await tx.chatMember.updateMany({
      where: {
        conversationId,
        userId: { not: userId },
      },
      data: { unreadCount: { increment: 1 } },
    });
    return tx.chatConversation.update({
      where: { id: conversationId },
      data: {
        status: CHAT_STATUS.ACTIVE,
        lastMessageAt: new Date(),
        lastMessagePreview: systemBody,
      },
      include: { members: true },
    });
  });

  getChatRealtimeHub().publishToUsers(
    updated.members.map((m) => m.userId),
    {
      type: "conversation",
      conversationId,
      status: CHAT_STATUS.ACTIVE,
    },
  );
  return updated;
}

export async function rejectDirectChat(conversationId: string, userId: string) {
  const conv = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: { members: true },
  });
  if (!conv || conv.kind !== CHAT_KIND.DIRECT) {
    throw new Error("会话不存在");
  }
  if (conv.status !== CHAT_STATUS.PENDING) {
    throw new Error("当前状态无法拒绝");
  }
  const me = conv.members.find((m) => m.userId === userId);
  if (!me || me.memberRole !== CHAT_MEMBER_ROLE.RECIPIENT) {
    throw new Error("只有被请求方可以拒绝");
  }

  const systemBody = "对方已拒绝本次私聊请求。";
  const updated = await prisma.$transaction(async (tx) => {
    await tx.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        type: CHAT_MESSAGE_TYPE.SYSTEM,
        body: systemBody,
      },
    });
    await tx.chatMember.updateMany({
      where: { conversationId, userId: { not: userId } },
      data: { unreadCount: { increment: 1 } },
    });
    return tx.chatConversation.update({
      where: { id: conversationId },
      data: {
        status: CHAT_STATUS.REJECTED,
        lastMessageAt: new Date(),
        lastMessagePreview: systemBody,
      },
      include: { members: true },
    });
  });

  getChatRealtimeHub().publishToUsers(
    updated.members.map((m) => m.userId),
    {
      type: "conversation",
      conversationId,
      status: CHAT_STATUS.REJECTED,
    },
  );
  return updated;
}

export async function listConversationsForUser(userId: string) {
  const memberships = await prisma.chatMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  // 按会话最后消息时间排
  const rows = memberships
    .map((m) => m.conversation)
    .filter((c) => c.status !== CHAT_STATUS.CLOSED)
    .sort((a, b) => {
      const at = a.lastMessageAt?.getTime() || a.createdAt.getTime();
      const bt = b.lastMessageAt?.getTime() || b.createdAt.getTime();
      return bt - at;
    });

  return rows.map((c) => {
    const my = c.members.find((m) => m.userId === userId);
    const peer = c.members.find((m) => m.userId !== userId)?.user;
    return {
      id: c.id,
      kind: c.kind,
      status: c.status,
      source: c.source,
      title:
        c.kind === CHAT_KIND.GROUP
          ? c.title || "群聊"
          : peer?.name || "私聊",
      peer: peer
        ? { id: peer.id, name: peer.name, avatarUrl: peer.avatarUrl || "" }
        : null,
      lastMessageAt: c.lastMessageAt?.toISOString() || null,
      lastMessagePreview: c.lastMessagePreview,
      unreadCount: my?.unreadCount || 0,
      memberRole: my?.memberRole || "",
      relatedCourseId: c.relatedCourseId,
      relatedMeetupId: c.relatedMeetupId,
      createdAt: c.createdAt.toISOString(),
    };
  });
}

export async function getUnreadTotal(userId: string): Promise<number> {
  const agg = await prisma.chatMember.aggregate({
    where: { userId },
    _sum: { unreadCount: true },
  });
  return agg._sum.unreadCount || 0;
}

async function assertMember(conversationId: string, userId: string) {
  const member = await prisma.chatMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    include: { conversation: true },
  });
  if (!member) throw new Error("无权访问该会话");
  return member;
}

export async function listMessages(input: {
  conversationId: string;
  userId: string;
  beforeId?: string;
  limit?: number;
}) {
  await assertMember(input.conversationId, input.userId);
  const limit = Math.min(Math.max(input.limit || 50, 1), 100);

  let beforeCreatedAt: Date | undefined;
  if (input.beforeId) {
    const before = await prisma.chatMessage.findUnique({
      where: { id: input.beforeId },
      select: { createdAt: true, conversationId: true },
    });
    if (before && before.conversationId === input.conversationId) {
      beforeCreatedAt = before.createdAt;
    }
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      conversationId: input.conversationId,
      ...(beforeCreatedAt ? { createdAt: { lt: beforeCreatedAt } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  // 标记已读
  await prisma.chatMember.updateMany({
    where: { conversationId: input.conversationId, userId: input.userId },
    data: { unreadCount: 0, lastReadAt: new Date() },
  });

  return messages.reverse().map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    type: m.type,
    body: m.body,
    mediaUrl: m.mediaUrl,
    createdAt: m.createdAt.toISOString(),
    sender: {
      id: m.sender.id,
      name: m.sender.name,
      avatarUrl: m.sender.avatarUrl || "",
    },
  }));
}

export async function sendTextMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
}) {
  const text = input.body.trim();
  if (!text) throw new Error("消息不能为空");
  if (text.length > CHAT_TEXT_MAX_LEN) {
    throw new Error(`消息过长（最多 ${CHAT_TEXT_MAX_LEN} 字）`);
  }

  const member = await assertMember(input.conversationId, input.senderId);
  if (member.conversation.status !== CHAT_STATUS.ACTIVE) {
    // 待确认时不允许普通聊天，避免未接受就骚扰
    throw new Error(
      member.conversation.status === CHAT_STATUS.PENDING
        ? "对方接受私聊后才能发送消息"
        : "当前会话不可发送消息",
    );
  }

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.chatMessage.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.senderId,
        type: CHAT_MESSAGE_TYPE.TEXT,
        body: text,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    await tx.chatConversation.update({
      where: { id: input.conversationId },
      data: {
        lastMessageAt: msg.createdAt,
        lastMessagePreview: previewOf(CHAT_MESSAGE_TYPE.TEXT, text),
      },
    });
    await tx.chatMember.updateMany({
      where: {
        conversationId: input.conversationId,
        userId: { not: input.senderId },
      },
      data: { unreadCount: { increment: 1 } },
    });
    await tx.chatMember.updateMany({
      where: {
        conversationId: input.conversationId,
        userId: input.senderId,
      },
      data: { unreadCount: 0, lastReadAt: new Date(), updatedAt: new Date() },
    });
    return msg;
  });

  const members = await prisma.chatMember.findMany({
    where: { conversationId: input.conversationId },
    select: { userId: true },
  });

  const payload = {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    type: message.type,
    body: message.body,
    mediaUrl: message.mediaUrl,
    createdAt: message.createdAt.toISOString(),
  };

  getChatRealtimeHub().publishToUsers(
    members.map((m) => m.userId),
    { type: "message", conversationId: input.conversationId, message: payload },
  );

  return {
    ...payload,
    sender: {
      id: message.sender.id,
      name: message.sender.name,
      avatarUrl: message.sender.avatarUrl || "",
    },
  };
}

export async function getConversationForUser(
  conversationId: string,
  userId: string,
) {
  const member = await assertMember(conversationId, userId);
  const c = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });
  if (!c) throw new Error("会话不存在");
  const peer = c.members.find((m) => m.userId !== userId)?.user;
  return {
    id: c.id,
    kind: c.kind,
    status: c.status,
    source: c.source,
    title:
      c.kind === CHAT_KIND.GROUP ? c.title || "群聊" : peer?.name || "私聊",
    peer: peer
      ? { id: peer.id, name: peer.name, avatarUrl: peer.avatarUrl || "" }
      : null,
    memberRole: member.memberRole,
    relatedCourseId: c.relatedCourseId,
    relatedMeetupId: c.relatedMeetupId,
  };
}
