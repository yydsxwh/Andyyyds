/**
 * 群聊：建群邀请、约搭/课程自动群、公告。
 * 邀请须对方同意后 joinStatus=ACTIVE 才能发言。
 */
import { prisma } from "@/lib/db";
import {
  CHAT_GROUP_INVITE_MAX,
  CHAT_JOIN_STATUS,
  CHAT_KIND,
  CHAT_MEMBER_ROLE,
  CHAT_MESSAGE_TYPE,
  CHAT_SOURCE,
  CHAT_STATUS,
} from "@/lib/chat/constants";
import {
  assertSocialChatEnabled,
  getHideSocialChatFlag,
} from "@/lib/chat/policy";
import { getChatRealtimeHub } from "@/lib/chat/realtime-hub";

function previewOf(type: string, body: string): string {
  if (type === CHAT_MESSAGE_TYPE.IMAGE) return "[图片]";
  if (type === CHAT_MESSAGE_TYPE.NOTICE) return `[公告] ${body.slice(0, 60)}`;
  if (type === CHAT_MESSAGE_TYPE.SYSTEM) return body.slice(0, 80);
  return body.slice(0, 80);
}

async function postSystem(
  conversationId: string,
  senderId: string,
  body: string,
  type: string = CHAT_MESSAGE_TYPE.SYSTEM,
) {
  const msg = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderId,
      type,
      body,
    },
  });
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: msg.createdAt,
      lastMessagePreview: previewOf(type, body),
    },
  });
  const members = await prisma.chatMember.findMany({
    where: {
      conversationId,
      joinStatus: {
        in: [CHAT_JOIN_STATUS.ACTIVE, CHAT_JOIN_STATUS.PENDING],
      },
    },
    select: { userId: true },
  });
  await prisma.chatMember.updateMany({
    where: {
      conversationId,
      userId: { not: senderId },
      joinStatus: {
        in: [CHAT_JOIN_STATUS.ACTIVE, CHAT_JOIN_STATUS.PENDING],
      },
    },
    data: { unreadCount: { increment: 1 } },
  });
  getChatRealtimeHub().publishToUsers(
    members.map((m) => m.userId),
    {
      type: "conversation",
      conversationId,
      status: CHAT_STATUS.ACTIVE,
    },
  );
  return msg;
}

export async function createGroupChat(input: {
  ownerId: string;
  title: string;
  inviteeIds: string[];
}) {
  await assertSocialChatEnabled();
  const title = input.title.trim().slice(0, 40);
  if (!title) throw new Error("请填写群名称");
  const inviteeIds = [
    ...new Set(
      input.inviteeIds.map((id) => id.trim()).filter((id) => id && id !== input.ownerId),
    ),
  ].slice(0, CHAT_GROUP_INVITE_MAX);
  if (inviteeIds.length < 1) throw new Error("请至少邀请一位好友");

  const users = await prisma.user.findMany({
    where: { id: { in: inviteeIds } },
    select: { id: true, name: true },
  });
  if (users.length !== inviteeIds.length) {
    throw new Error("部分用户不存在");
  }

  const owner = await prisma.user.findUnique({
    where: { id: input.ownerId },
    select: { name: true },
  });

  const conversation = await prisma.$transaction(async (tx) => {
    const conv = await tx.chatConversation.create({
      data: {
        kind: CHAT_KIND.GROUP,
        status: CHAT_STATUS.ACTIVE,
        initiatedById: input.ownerId,
        source: CHAT_SOURCE.GROUP,
        title,
        lastMessageAt: new Date(),
        lastMessagePreview: "群聊已创建",
        members: {
          create: [
            {
              userId: input.ownerId,
              memberRole: CHAT_MEMBER_ROLE.OWNER,
              joinStatus: CHAT_JOIN_STATUS.ACTIVE,
            },
            ...inviteeIds.map((userId) => ({
              userId,
              memberRole: CHAT_MEMBER_ROLE.MEMBER,
              joinStatus: CHAT_JOIN_STATUS.PENDING,
              unreadCount: 1,
            })),
          ],
        },
      },
    });
    const names = users.map((u) => u.name).join("、");
    await tx.chatMessage.create({
      data: {
        conversationId: conv.id,
        senderId: input.ownerId,
        type: CHAT_MESSAGE_TYPE.SYSTEM,
        body: `${owner?.name || "用户"} 创建了群「${title}」，并邀请 ${names}。被邀请人同意后即可进群聊天。`,
      },
    });
    return conv;
  });

  getChatRealtimeHub().publishToUsers([input.ownerId, ...inviteeIds], {
    type: "conversation",
    conversationId: conversation.id,
    status: CHAT_STATUS.ACTIVE,
  });

  return conversation;
}

export async function inviteUsersToGroup(input: {
  conversationId: string;
  actorId: string;
  inviteeIds: string[];
}) {
  await assertSocialChatEnabled();
  const conv = await prisma.chatConversation.findUnique({
    where: { id: input.conversationId },
    include: { members: true },
  });
  if (!conv || conv.kind !== CHAT_KIND.GROUP) throw new Error("群不存在");
  const actor = conv.members.find((m) => m.userId === input.actorId);
  if (
    !actor ||
    actor.joinStatus !== CHAT_JOIN_STATUS.ACTIVE ||
    (actor.memberRole !== CHAT_MEMBER_ROLE.OWNER &&
      actor.memberRole !== CHAT_MEMBER_ROLE.ADMIN)
  ) {
    throw new Error("仅群主/管理员可邀请");
  }

  const inviteeIds = [
    ...new Set(
      input.inviteeIds
        .map((id) => id.trim())
        .filter((id) => id && id !== input.actorId),
    ),
  ].slice(0, CHAT_GROUP_INVITE_MAX);

  const existingActive = new Set(
    conv.members
      .filter((m) => m.joinStatus === CHAT_JOIN_STATUS.ACTIVE)
      .map((m) => m.userId),
  );
  const toInvite = inviteeIds.filter((id) => !existingActive.has(id));
  if (toInvite.length < 1) throw new Error("没有可邀请的新成员");

  const users = await prisma.user.findMany({
    where: { id: { in: toInvite } },
    select: { id: true, name: true },
  });
  const actorUser = await prisma.user.findUnique({
    where: { id: input.actorId },
    select: { name: true },
  });

  for (const u of users) {
    await prisma.chatMember.upsert({
      where: {
        conversationId_userId: {
          conversationId: input.conversationId,
          userId: u.id,
        },
      },
      create: {
        conversationId: input.conversationId,
        userId: u.id,
        memberRole: CHAT_MEMBER_ROLE.MEMBER,
        joinStatus: CHAT_JOIN_STATUS.PENDING,
        unreadCount: 1,
      },
      update: {
        joinStatus: CHAT_JOIN_STATUS.PENDING,
        unreadCount: { increment: 1 },
      },
    });
  }

  await postSystem(
    input.conversationId,
    input.actorId,
    `${actorUser?.name || "管理员"} 邀请 ${users.map((u) => u.name).join("、")} 进群，对方同意后即可聊天。`,
  );

  return { invited: users.map((u) => u.id) };
}

export async function acceptGroupInvite(
  conversationId: string,
  userId: string,
) {
  await assertSocialChatEnabled();
  const member = await prisma.chatMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    include: { conversation: true, user: { select: { name: true } } },
  });
  if (!member || member.conversation.kind !== CHAT_KIND.GROUP) {
    throw new Error("邀请不存在");
  }
  if (member.joinStatus !== CHAT_JOIN_STATUS.PENDING) {
    throw new Error("当前状态无法接受");
  }
  await prisma.chatMember.update({
    where: { id: member.id },
    data: { joinStatus: CHAT_JOIN_STATUS.ACTIVE, unreadCount: 0 },
  });
  await postSystem(
    conversationId,
    userId,
    `${member.user.name} 已同意进群`,
  );
  return { ok: true as const };
}

export async function rejectGroupInvite(
  conversationId: string,
  userId: string,
) {
  await assertSocialChatEnabled();
  const member = await prisma.chatMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    include: { conversation: true, user: { select: { name: true } } },
  });
  if (!member || member.conversation.kind !== CHAT_KIND.GROUP) {
    throw new Error("邀请不存在");
  }
  if (member.joinStatus !== CHAT_JOIN_STATUS.PENDING) {
    throw new Error("当前状态无法拒绝");
  }
  await prisma.chatMember.update({
    where: { id: member.id },
    data: { joinStatus: CHAT_JOIN_STATUS.REJECTED },
  });
  await postSystem(
    conversationId,
    userId,
    `${member.user.name} 已拒绝进群邀请`,
  );
  return { ok: true as const };
}

export async function setGroupAnnouncement(input: {
  conversationId: string;
  actorId: string;
  text: string;
}) {
  await assertSocialChatEnabled();
  const text = input.text.trim().slice(0, 1000);
  const conv = await prisma.chatConversation.findUnique({
    where: { id: input.conversationId },
    include: { members: true },
  });
  if (!conv || conv.kind !== CHAT_KIND.GROUP) throw new Error("群不存在");
  const actor = conv.members.find((m) => m.userId === input.actorId);
  if (
    !actor ||
    actor.joinStatus !== CHAT_JOIN_STATUS.ACTIVE ||
    (actor.memberRole !== CHAT_MEMBER_ROLE.OWNER &&
      actor.memberRole !== CHAT_MEMBER_ROLE.ADMIN)
  ) {
    throw new Error("仅群主/管理员可设置公告");
  }

  await prisma.chatConversation.update({
    where: { id: input.conversationId },
    data: {
      announcement: text,
      announcementUpdatedAt: new Date(),
      announcementById: input.actorId,
    },
  });

  if (text) {
    await postSystem(
      input.conversationId,
      input.actorId,
      text,
      CHAT_MESSAGE_TYPE.NOTICE,
    );
  }
  return { ok: true as const, announcement: text };
}

/** 约搭活动群：报名/支付后自动入群（无需再确认） */
export async function ensureMeetupGroupAndJoin(input: {
  meetupId: string;
  hostId: string;
  meetupTitle: string;
  userId: string;
}) {
  // 合规隐藏社交群时：不创建/不入约搭群
  if (await getHideSocialChatFlag()) return null;
  let conv = await prisma.chatConversation.findFirst({
    where: {
      kind: CHAT_KIND.GROUP,
      source: CHAT_SOURCE.MEETUP_GROUP,
      relatedMeetupId: input.meetupId,
      status: { not: CHAT_STATUS.CLOSED },
    },
  });

  if (!conv) {
    conv = await prisma.chatConversation.create({
      data: {
        kind: CHAT_KIND.GROUP,
        status: CHAT_STATUS.ACTIVE,
        initiatedById: input.hostId,
        source: CHAT_SOURCE.MEETUP_GROUP,
        relatedMeetupId: input.meetupId,
        title: `约搭：${input.meetupTitle}`.slice(0, 40),
        lastMessageAt: new Date(),
        lastMessagePreview: "约搭群已创建",
        members: {
          create: {
            userId: input.hostId,
            memberRole: CHAT_MEMBER_ROLE.OWNER,
            joinStatus: CHAT_JOIN_STATUS.ACTIVE,
          },
        },
      },
    });
    await prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        senderId: input.hostId,
        type: CHAT_MESSAGE_TYPE.SYSTEM,
        body: `约搭「${input.meetupTitle}」群聊已创建，报名成员将自动入群。`,
      },
    });
  }

  // 确保发起人在群
  await prisma.chatMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: conv.id,
        userId: input.hostId,
      },
    },
    create: {
      conversationId: conv.id,
      userId: input.hostId,
      memberRole: CHAT_MEMBER_ROLE.OWNER,
      joinStatus: CHAT_JOIN_STATUS.ACTIVE,
    },
    update: {
      joinStatus: CHAT_JOIN_STATUS.ACTIVE,
      memberRole: CHAT_MEMBER_ROLE.OWNER,
    },
  });

  if (input.userId !== input.hostId) {
    const existing = await prisma.chatMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: conv.id,
          userId: input.userId,
        },
      },
    });
    if (!existing || existing.joinStatus !== CHAT_JOIN_STATUS.ACTIVE) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { name: true },
      });
      await prisma.chatMember.upsert({
        where: {
          conversationId_userId: {
            conversationId: conv.id,
            userId: input.userId,
          },
        },
        create: {
          conversationId: conv.id,
          userId: input.userId,
          memberRole: CHAT_MEMBER_ROLE.MEMBER,
          joinStatus: CHAT_JOIN_STATUS.ACTIVE,
        },
        update: { joinStatus: CHAT_JOIN_STATUS.ACTIVE },
      });
      await postSystem(
        conv.id,
        input.userId,
        `${user?.name || "用户"} 报名约搭，已自动入群`,
      );
    }
  }

  return conv.id;
}

/** 课程/专栏/资料班级群：购买开通后自动入群 */
export async function ensureCourseGroupAndJoin(input: {
  courseId: string;
  teacherId: string;
  courseTitle: string;
  userId: string;
}) {
  if (await getHideSocialChatFlag()) return null;
  let conv = await prisma.chatConversation.findFirst({
    where: {
      kind: CHAT_KIND.GROUP,
      source: CHAT_SOURCE.COURSE_GROUP,
      relatedCourseId: input.courseId,
      status: { not: CHAT_STATUS.CLOSED },
    },
  });

  if (!conv) {
    conv = await prisma.chatConversation.create({
      data: {
        kind: CHAT_KIND.GROUP,
        status: CHAT_STATUS.ACTIVE,
        initiatedById: input.teacherId,
        source: CHAT_SOURCE.COURSE_GROUP,
        relatedCourseId: input.courseId,
        title: `班级：${input.courseTitle}`.slice(0, 40),
        lastMessageAt: new Date(),
        lastMessagePreview: "班级群已创建",
        members: {
          create: {
            userId: input.teacherId,
            memberRole: CHAT_MEMBER_ROLE.OWNER,
            joinStatus: CHAT_JOIN_STATUS.ACTIVE,
          },
        },
      },
    });
    await prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        senderId: input.teacherId,
        type: CHAT_MESSAGE_TYPE.SYSTEM,
        body: `「${input.courseTitle}」班级群已创建，学员开通后自动入群。`,
      },
    });
  }

  await prisma.chatMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: conv.id,
        userId: input.teacherId,
      },
    },
    create: {
      conversationId: conv.id,
      userId: input.teacherId,
      memberRole: CHAT_MEMBER_ROLE.OWNER,
      joinStatus: CHAT_JOIN_STATUS.ACTIVE,
    },
    update: {
      joinStatus: CHAT_JOIN_STATUS.ACTIVE,
      memberRole: CHAT_MEMBER_ROLE.OWNER,
    },
  });

  if (input.userId !== input.teacherId) {
    const existing = await prisma.chatMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: conv.id,
          userId: input.userId,
        },
      },
    });
    if (!existing || existing.joinStatus !== CHAT_JOIN_STATUS.ACTIVE) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { name: true },
      });
      await prisma.chatMember.upsert({
        where: {
          conversationId_userId: {
            conversationId: conv.id,
            userId: input.userId,
          },
        },
        create: {
          conversationId: conv.id,
          userId: input.userId,
          memberRole: CHAT_MEMBER_ROLE.MEMBER,
          joinStatus: CHAT_JOIN_STATUS.ACTIVE,
        },
        update: { joinStatus: CHAT_JOIN_STATUS.ACTIVE },
      });
      await postSystem(
        conv.id,
        input.userId,
        `${user?.name || "学员"} 已加入班级群`,
      );
    }
  }

  return conv.id;
}
