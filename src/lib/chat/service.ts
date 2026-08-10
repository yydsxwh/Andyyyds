/**
 * 站内私聊 / 群消息：请求确认、发送、已读、撤回、本地删等。
 * 建群/约搭课程群见 group-service.ts。
 */
import { prisma } from "@/lib/db";
import {
  CHAT_JOIN_STATUS,
  CHAT_KIND,
  CHAT_MEMBER_ROLE,
  CHAT_MESSAGE_TYPE,
  CHAT_RECALL_WINDOW_MS,
  CHAT_SEARCH_LIMIT,
  CHAT_SOURCE,
  CHAT_STATUS,
  CHAT_TEXT_MAX_LEN,
  parseMentionIds,
  type ChatSource,
} from "@/lib/chat/constants";
import { buildDirectKey } from "@/lib/chat/direct-key";
import {
  assertCanStartDirectChat,
  getHideSocialChatFlag,
  isConsultChatSource,
  socialChatListWhere,
} from "@/lib/chat/policy";
import { getChatRealtimeHub } from "@/lib/chat/realtime-hub";

function previewOf(type: string, body: string): string {
  if (type === CHAT_MESSAGE_TYPE.IMAGE) return "[图片]";
  if (type === CHAT_MESSAGE_TYPE.NOTICE) return `[公告] ${body.slice(0, 60)}`;
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
  // 合规关闭社交私聊时，仅允许产品/约搭咨询来源
  await assertCanStartDirectChat(input.source);

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
  const hideSocialChat = await getHideSocialChatFlag();
  const memberships = await prisma.chatMember.findMany({
    where: {
      userId,
      joinStatus: {
        in: [CHAT_JOIN_STATUS.ACTIVE, CHAT_JOIN_STATUS.PENDING],
      },
      ...socialChatListWhere(hideSocialChat),
    },
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

  // 列表预览跳过「本地已删」消息，避免会话摘要仍显示已清内容
  const previews = await Promise.all(
    rows.map(async (c) => {
      const last = await prisma.chatMessage.findFirst({
        where: {
          conversationId: c.id,
          hides: { none: { userId } },
        },
        orderBy: { createdAt: "desc" },
        select: {
          type: true,
          body: true,
          createdAt: true,
        },
      });
      if (!last) {
        return {
          lastMessageAt: null as string | null,
          lastMessagePreview: "",
        };
      }
      return {
        lastMessageAt: last.createdAt.toISOString(),
        lastMessagePreview: previewOf(last.type, last.body),
      };
    }),
  );

  return rows.map((c, index) => {
    const my = c.members.find((m) => m.userId === userId);
    const peer = c.members.find((m) => m.userId !== userId)?.user;
    const preview = previews[index];
    const activeCount = c.members.filter(
      (m) => m.joinStatus === CHAT_JOIN_STATUS.ACTIVE,
    ).length;
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
      lastMessageAt: preview.lastMessageAt,
      lastMessagePreview: preview.lastMessagePreview,
      unreadCount: my?.unreadCount || 0,
      memberRole: my?.memberRole || "",
      joinStatus: my?.joinStatus || CHAT_JOIN_STATUS.ACTIVE,
      memberCount: activeCount,
      relatedCourseId: c.relatedCourseId,
      relatedMeetupId: c.relatedMeetupId,
      createdAt: c.createdAt.toISOString(),
    };
  });
}

export async function getUnreadTotal(userId: string): Promise<number> {
  const hideSocialChat = await getHideSocialChatFlag();
  const agg = await prisma.chatMember.aggregate({
    where: {
      userId,
      ...socialChatListWhere(hideSocialChat),
    },
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
  if (
    member.joinStatus === CHAT_JOIN_STATUS.REJECTED ||
    member.joinStatus === CHAT_JOIN_STATUS.LEFT
  ) {
    throw new Error("无权访问该会话");
  }
  return member;
}

function assertCanSend(member: {
  joinStatus: string;
  conversation: { kind: string; status: string };
}) {
  if (member.conversation.kind === CHAT_KIND.DIRECT) {
    if (member.conversation.status !== CHAT_STATUS.ACTIVE) {
      throw new Error(
        member.conversation.status === CHAT_STATUS.PENDING
          ? "对方接受私聊后才能发送消息"
          : "当前会话不可发送消息",
      );
    }
    return;
  }
  // 群聊：须已入群（邀请同意或自动进群）
  if (member.joinStatus !== CHAT_JOIN_STATUS.ACTIVE) {
    throw new Error("请先同意进群邀请后再发言");
  }
  if (member.conversation.status === CHAT_STATUS.CLOSED) {
    throw new Error("群已关闭");
  }
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
      // 本地删除：该用户已隐藏的消息不再返回
      hides: { none: { userId: input.userId } },
      ...(beforeCreatedAt ? { createdAt: { lt: beforeCreatedAt } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
      reads: { select: { userId: true, readAt: true } },
      _count: { select: { reads: true } },
    },
  });

  // 标记会话未读清零 + 写入已读回执（不含自己发的）
  await prisma.chatMember.updateMany({
    where: { conversationId: input.conversationId, userId: input.userId },
    data: { unreadCount: 0, lastReadAt: new Date() },
  });
  const toMark = messages.filter((m) => m.senderId !== input.userId);
  for (const m of toMark) {
    await prisma.chatMessageRead.upsert({
      where: {
        messageId_userId: { messageId: m.id, userId: input.userId },
      },
      create: { messageId: m.id, userId: input.userId },
      update: { readAt: new Date() },
    });
  }

  return messages.reverse().map((m) => {
    const recalled = Boolean(m.recalledAt);
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      type: m.type,
      body: recalled ? "" : m.body,
      mediaUrl: recalled ? "" : m.mediaUrl,
      mentionIds: recalled ? [] : parseMentionIds(m.mentionJson),
      recalled,
      recalledAt: m.recalledAt?.toISOString() || null,
      createdAt: m.createdAt.toISOString(),
      readCount: m._count.reads,
      readByMe: m.reads.some((r) => r.userId === input.userId),
      sender: {
        id: m.sender.id,
        name: m.sender.name,
        avatarUrl: m.sender.avatarUrl || "",
      },
    };
  });
}

/**
 * 本地删除：只对本用户隐藏，对方会话不受影响。
 */
export async function hideMessageLocally(input: {
  conversationId: string;
  messageId: string;
  userId: string;
}) {
  await assertMember(input.conversationId, input.userId);
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: input.messageId,
      conversationId: input.conversationId,
    },
    select: { id: true },
  });
  if (!message) throw new Error("消息不存在");

  await prisma.chatMessageHide.upsert({
    where: {
      messageId_userId: {
        messageId: input.messageId,
        userId: input.userId,
      },
    },
    create: {
      messageId: input.messageId,
      userId: input.userId,
    },
    update: {},
  });

  return { ok: true as const, messageId: input.messageId };
}

export async function sendTextMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
  mentionIds?: string[];
}) {
  const text = input.body.trim();
  if (!text) throw new Error("消息不能为空");
  if (text.length > CHAT_TEXT_MAX_LEN) {
    throw new Error(`消息过长（最多 ${CHAT_TEXT_MAX_LEN} 字）`);
  }

  const member = await assertMember(input.conversationId, input.senderId);
  assertCanSend(member);

  const mentionIds = [
    ...new Set((input.mentionIds || []).map((id) => id.trim()).filter(Boolean)),
  ].slice(0, 20);

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.chatMessage.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.senderId,
        type: CHAT_MESSAGE_TYPE.TEXT,
        body: text,
        mentionJson: JSON.stringify(mentionIds),
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
        joinStatus: {
          in: [CHAT_JOIN_STATUS.ACTIVE, CHAT_JOIN_STATUS.PENDING],
        },
      },
      data: { unreadCount: { increment: 1 } },
    });
    // @ 提及再加一层未读提示（已在上面 +1，这里不再重复加，仅靠正文 @）
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
    where: {
      conversationId: input.conversationId,
      joinStatus: {
        in: [CHAT_JOIN_STATUS.ACTIVE, CHAT_JOIN_STATUS.PENDING],
      },
    },
    select: { userId: true },
  });

  const payload = {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    type: message.type,
    body: message.body,
    mediaUrl: message.mediaUrl,
    mentionIds,
    recalled: false,
    recalledAt: null as string | null,
    createdAt: message.createdAt.toISOString(),
    readCount: 0,
    readByMe: false,
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

/** 撤回：发送者时限内，或群主随时 */
export async function recallMessage(input: {
  conversationId: string;
  messageId: string;
  userId: string;
}) {
  const member = await assertMember(input.conversationId, input.userId);
  if (member.joinStatus !== CHAT_JOIN_STATUS.ACTIVE) {
    throw new Error("无权撤回");
  }
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: input.messageId,
      conversationId: input.conversationId,
    },
  });
  if (!message) throw new Error("消息不存在");
  if (message.recalledAt) throw new Error("消息已撤回");
  if (message.type === CHAT_MESSAGE_TYPE.SYSTEM) {
    throw new Error("系统消息不可撤回");
  }

  const isOwner =
    member.memberRole === CHAT_MEMBER_ROLE.OWNER ||
    member.memberRole === CHAT_MEMBER_ROLE.ADMIN;
  const isSender = message.senderId === input.userId;
  if (!isSender && !isOwner) throw new Error("只能撤回自己的消息");
  if (isSender && !isOwner) {
    const age = Date.now() - message.createdAt.getTime();
    if (age > CHAT_RECALL_WINDOW_MS) {
      throw new Error("已超过撤回时限（2 分钟）");
    }
  }

  const recalledAt = new Date();
  await prisma.chatMessage.update({
    where: { id: message.id },
    data: { recalledAt, body: "", mediaUrl: "", mentionJson: "[]" },
  });
  await prisma.chatConversation.update({
    where: { id: input.conversationId },
    data: {
      lastMessagePreview: "撤回了一条消息",
      lastMessageAt: recalledAt,
    },
  });

  const members = await prisma.chatMember.findMany({
    where: {
      conversationId: input.conversationId,
      joinStatus: {
        in: [CHAT_JOIN_STATUS.ACTIVE, CHAT_JOIN_STATUS.PENDING],
      },
    },
    select: { userId: true },
  });
  getChatRealtimeHub().publishToUsers(
    members.map((m) => m.userId),
    {
      type: "conversation",
      conversationId: input.conversationId,
      status: member.conversation.status,
    },
  );
  return { ok: true as const, messageId: message.id };
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
  // 合规模式：禁止打开社交群聊 / 非咨询私聊
  if (await getHideSocialChatFlag()) {
    if (c.kind === CHAT_KIND.GROUP || !isConsultChatSource(c.source)) {
      throw new Error("该会话暂不可用");
    }
  }
  const peer = c.members.find((m) => m.userId !== userId)?.user;
  const activeMembers = c.members
    .filter((m) => m.joinStatus === CHAT_JOIN_STATUS.ACTIVE)
    .map((m) => ({
      id: m.user.id,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl || "",
      memberRole: m.memberRole,
    }));
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
    joinStatus: member.joinStatus,
    announcement: c.announcement || "",
    announcementUpdatedAt: c.announcementUpdatedAt?.toISOString() || null,
    members: activeMembers,
    relatedCourseId: c.relatedCourseId,
    relatedMeetupId: c.relatedMeetupId,
  };
}
