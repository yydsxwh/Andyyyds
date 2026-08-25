/**
 * 第三方 / 手机号登录：创建或查找用户并建立会话前的公共逻辑。
 * 微信 openid、手机号均可作为身份；邮箱登录仍走原有路由。
 *
 * 注册页可带 requestedRole（代理/商家/老师待审）；登录页新建账号一律学员。
 */

import {
  createSession,
  hashPassword,
  makeReferralCode,
  verifyPassword,
} from "./auth";
import {
  accountPlaceholderEmail,
  isPlaceholderEmail,
  phonePlaceholderEmail,
  wechatPlaceholderEmail,
} from "./auth-email";
import { validateUsername } from "./auth-username";
import { prisma } from "./db";
import {
  fieldsForSignup,
  PENDING_REVIEW_MESSAGE,
} from "./role-applications";
import {
  APPLYABLE_ROLES,
  isRoleApplicationPending,
  type ApplyableRole,
  type Role,
} from "./roles";

export {
  accountPlaceholderEmail,
  isPlaceholderEmail,
  phonePlaceholderEmail,
  wechatPlaceholderEmail,
} from "./auth-email";

/** 微信/手机号自动注册时的不可登录占位密码（用户仍可用邮箱注册另一账号） */
async function unusablePasswordHash() {
  return hashPassword(`!no-password!${cryptoRandom()}`);
}

function cryptoRandom() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function resolveApplyRole(
  requestedRole?: string | null,
): ApplyableRole {
  if (
    requestedRole &&
    (APPLYABLE_ROLES as readonly string[]).includes(requestedRole)
  ) {
    return requestedRole as ApplyableRole;
  }
  return "STUDENT";
}

export type AuthResultPayload = {
  ok: true;
  pendingReview?: boolean;
  message?: string;
  requestedRole?: string;
  isNewUser?: boolean;
};

async function sessionPayloadForUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  roleApplicationStatus: string;
  requestedRole: string;
}): Promise<AuthResultPayload> {
  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
  });
  if (isRoleApplicationPending(user.roleApplicationStatus || "")) {
    return {
      ok: true,
      pendingReview: true,
      message: PENDING_REVIEW_MESSAGE,
      requestedRole: user.requestedRole || "",
    };
  }
  return { ok: true };
}

async function resolveReferrerId(referralCode?: string) {
  const { normalizeReferralCode } = await import("./referral-code");
  const code = normalizeReferralCode(referralCode || "");
  if (!code) return undefined;
  const inviter = await prisma.user.findFirst({
    where: { referralCode: code },
    select: { id: true },
  });
  return inviter?.id;
}

/** oa=公众号；web=网站扫码；mobile=Android App 微信 SDK */
export type WechatIdentityChannel = "oa" | "web" | "mobile";

/** 仅查找微信身份对应用户，不建号、不写会话（用于静默登录分流） */
export async function findUserByWechatIdentity(input: {
  openid: string;
  unionid?: string;
  /** 默认 oa：按公众号 openid 查；web/mobile 按各自字段查；均再按 unionid 兜底 */
  channel?: WechatIdentityChannel;
}) {
  const openid = input.openid.trim();
  if (!openid) return null;
  const unionid = (input.unionid || "").trim();
  const channel = input.channel || "oa";
  // 先按本渠道 openid，再按 unionid（绑同一开放平台时可合并账号）
  const byOpenId =
    channel === "web"
      ? await prisma.user.findFirst({ where: { wechatWebOpenId: openid } })
      : channel === "mobile"
        ? await prisma.user.findFirst({ where: { wechatMobileOpenId: openid } })
        : await prisma.user.findFirst({ where: { wechatOpenId: openid } });
  if (byOpenId) return byOpenId;
  if (!unionid) return null;
  return prisma.user.findFirst({ where: { wechatUnionId: unionid } });
}

/**
 * 按本渠道 openid（优先）或 unionid 查找用户；没有则按注册身份自动建号并写会话。
 * 已登录用户走「绑定」时应调用 bindWechatToUser，而不是本函数。
 *
 * 为何分开存：网站应用 openid ≠ 公众号 openid；若把扫码 openid 写入 wechatOpenId，
 * 微信内 JSAPI 支付会用错 openid 失败。
 */
export async function findOrCreateUserByWechat(input: {
  openid: string;
  unionid?: string;
  channel?: WechatIdentityChannel;
  referralCode?: string;
  /** 仅新建账号时生效；已有账号直接登录 */
  requestedRole?: string;
  /** snsapi_userinfo / snsapi_login 授权后的微信昵称 */
  nickname?: string;
  /** 微信头像 URL（可直接存；展示时按外链使用） */
  headimgurl?: string;
}): Promise<{ userId: string; isNewUser: boolean; result: AuthResultPayload }> {
  const openid = input.openid.trim();
  if (!openid) throw new Error("缺少微信 openid");
  const unionid = (input.unionid || "").trim();
  const channel = input.channel || "oa";
  const nickname = (input.nickname || "").trim().slice(0, 40);
  const headimgurl = (input.headimgurl || "").trim();

  let user = await findUserByWechatIdentity({ openid, unionid, channel });

  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const applyRole = resolveApplyRole(input.requestedRole);
    const roleFields = fieldsForSignup(applyRole);
    user = await prisma.user.create({
      data: {
        name: nickname || "微信用户",
        avatarUrl: headimgurl,
        email: wechatPlaceholderEmail(openid),
        passwordHash: await unusablePasswordHash(),
        passwordSet: false,
        // 各渠道 openid 分字段存，避免 JSAPI / 扫码 / App 登录互相覆盖
        ...(channel === "web"
          ? { wechatWebOpenId: openid }
          : channel === "mobile"
            ? { wechatMobileOpenId: openid }
            : { wechatOpenId: openid }),
        wechatUnionId: unionid,
        referralCode: makeReferralCode(),
        referredById: await resolveReferrerId(input.referralCode),
        ...roleFields,
      },
    });
  } else {
    // 补写本渠道 openid / unionid；授权到资料时同步昵称与头像
    const patch: {
      wechatOpenId?: string;
      wechatWebOpenId?: string;
      wechatMobileOpenId?: string;
      wechatUnionId?: string;
      name?: string;
      avatarUrl?: string;
    } = {};
    if (channel === "web") {
      if (user.wechatWebOpenId !== openid) patch.wechatWebOpenId = openid;
    } else if (channel === "mobile") {
      if (user.wechatMobileOpenId !== openid) patch.wechatMobileOpenId = openid;
    } else if (!user.wechatOpenId && openid) {
      patch.wechatOpenId = openid;
    }
    if (unionid && user.wechatUnionId !== unionid) patch.wechatUnionId = unionid;
    if (nickname) patch.name = nickname;
    if (headimgurl) patch.avatarUrl = headimgurl;
    if (Object.keys(patch).length) {
      user = await prisma.user.update({ where: { id: user.id }, data: patch });
    }
  }

  const result = await sessionPayloadForUser(user);
  return { userId: user.id, isNewUser, result: { ...result, isNewUser } };
}

/**
 * 已登录用户绑定微信（支付 / 账号关联）；若 openid 已被他人占用则报错。
 * channel=oa 写公众号 openid（JSAPI）；channel=web 写网站应用 openid。
 */
export async function bindWechatToUser(input: {
  userId: string;
  openid: string;
  unionid?: string;
  channel?: WechatIdentityChannel;
  nickname?: string;
  headimgurl?: string;
}) {
  const openid = input.openid.trim();
  const unionid = (input.unionid || "").trim();
  const channel = input.channel || "oa";
  if (!openid) throw new Error("缺少微信 openid");

  const occupied =
    channel === "web"
      ? await prisma.user.findFirst({
          where: { wechatWebOpenId: openid, NOT: { id: input.userId } },
          select: { id: true },
        })
      : channel === "mobile"
        ? await prisma.user.findFirst({
            where: { wechatMobileOpenId: openid, NOT: { id: input.userId } },
            select: { id: true },
          })
        : await prisma.user.findFirst({
            where: { wechatOpenId: openid, NOT: { id: input.userId } },
            select: { id: true },
          });
  if (occupied) {
    throw new Error("该微信已绑定其他账号，请先用微信登录原账号或联系站长");
  }

  const nickname = (input.nickname || "").trim().slice(0, 40);
  const headimgurl = (input.headimgurl || "").trim();

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      ...(channel === "web"
        ? { wechatWebOpenId: openid }
        : channel === "mobile"
          ? { wechatMobileOpenId: openid }
          : { wechatOpenId: openid }),
      ...(unionid ? { wechatUnionId: unionid } : {}),
      ...(nickname ? { name: nickname } : {}),
      ...(headimgurl ? { avatarUrl: headimgurl } : {}),
    },
  });
}

/**
 * 手机号 + 已校验验证码后登录或注册。
 * - mode=login：有则登录，无则自动注册学员
 * - mode=register：已存在则报错；新建时可带身份申请与可选密码
 */
export async function findOrCreateUserByPhone(input: {
  phone: string;
  name?: string;
  referralCode?: string;
  requestedRole?: string;
  /** 可选：手机号注册时同时设密码，便于以后邮箱旁路登录 */
  password?: string;
  mode?: "login" | "register";
}): Promise<{ userId: string; isNewUser: boolean; result: AuthResultPayload }> {
  const phone = input.phone;
  const mode = input.mode || "login";
  let user = await prisma.user.findFirst({ where: { phone } });
  let isNewUser = false;

  if (user) {
    if (mode === "register") {
      throw new Error("该手机号已注册，请直接登录");
    }
  } else {
    isNewUser = true;
    // 登录页首次用手机号：一律学员；注册页尊重所选身份
    const applyRole =
      mode === "register"
        ? resolveApplyRole(input.requestedRole)
        : ("STUDENT" as ApplyableRole);
    const roleFields = fieldsForSignup(applyRole);
    const name = (input.name || "").trim() || `用户${phone.slice(-4)}`;
    const password = (input.password || "").trim();
    const hasPassword = password.length >= 6;
    const passwordHash = hasPassword
      ? await hashPassword(password)
      : await unusablePasswordHash();

    user = await prisma.user.create({
      data: {
        name,
        phone,
        email: phonePlaceholderEmail(phone),
        passwordHash,
        passwordSet: hasPassword,
        referralCode: makeReferralCode(),
        referredById: await resolveReferrerId(input.referralCode),
        ...roleFields,
      },
    });
  }

  const result = await sessionPayloadForUser(user);
  return { userId: user.id, isNewUser, result: { ...result, isNewUser } };
}

export async function bindPhoneToUser(input: {
  userId: string;
  phone: string;
}) {
  const occupied = await prisma.user.findFirst({
    where: {
      phone: input.phone,
      NOT: { id: input.userId },
    },
    select: { id: true },
  });
  if (occupied) {
    throw new Error("该手机号已绑定其他账号，请用该手机号登录后再绑定微信");
  }
  await prisma.user.update({
    where: { id: input.userId },
    data: { phone: input.phone },
  });
}

/**
 * 绑定或更换真实登录邮箱（全站唯一）。
 * 微信/手机注册用户须先（或同时）设置密码，才能用邮箱登录同一账号。
 */
export async function bindEmailToUser(input: {
  userId: string;
  email: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("请填写有效邮箱");
  }
  if (isPlaceholderEmail(email)) {
    throw new Error("请使用真实邮箱，不能使用系统占位地址");
  }

  const occupied = await prisma.user.findFirst({
    where: {
      email,
      NOT: { id: input.userId },
    },
    select: { id: true },
  });
  if (occupied) {
    throw new Error(
      "该邮箱已绑定其他账号，请用该邮箱登录后再绑定微信或手机号",
    );
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { email },
  });
}

/**
 * 已登录用户绑定或更换登录账号（username）。
 * 被其他用户占用则拒绝；未设密码时须同时设密码，才能用账号登录。
 */
export async function bindUsernameToUser(input: {
  userId: string;
  username: string;
  /** 当前用户尚未设密码时必填 */
  password?: string;
}) {
  const checked = validateUsername(input.username);
  if (!checked.ok) throw new Error(checked.error);

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, passwordSet: true, username: true },
  });
  if (!user) throw new Error("用户不存在");

  const occupied = await prisma.user.findFirst({
    where: {
      username: checked.username,
      NOT: { id: input.userId },
    },
    select: { id: true },
  });
  if (occupied) {
    throw new Error("该登录账号已被其他用户占用");
  }

  const data: {
    username: string;
    passwordHash?: string;
    passwordSet?: boolean;
  } = { username: checked.username };

  if (!user.passwordSet) {
    const password = (input.password || "").trim();
    if (password.length < 6) {
      throw new Error("请同时设置至少 6 位登录密码，以便用账号登录");
    }
    data.passwordHash = await hashPassword(password);
    data.passwordSet = true;
  }

  await prisma.user.update({
    where: { id: input.userId },
    data,
  });

  return { username: checked.username, passwordSet: true as const };
}

/**
 * 账号 + 密码注册（与邮箱注册分开：身份靠 username，邮箱为占位）。
 */
export async function registerUserByUsername(input: {
  username: string;
  password: string;
  name: string;
  referralCode?: string;
  requestedRole?: string;
}): Promise<{ userId: string; result: AuthResultPayload }> {
  const checked = validateUsername(input.username);
  if (!checked.ok) throw new Error(checked.error);

  const password = (input.password || "").trim();
  if (password.length < 6) {
    throw new Error("密码至少 6 位");
  }
  const name = (input.name || "").trim();
  if (!name) throw new Error("请填写昵称");

  const exists = await prisma.user.findUnique({
    where: { username: checked.username },
    select: { id: true },
  });
  if (exists) {
    throw new Error("该登录账号已被注册，请换一个或直接登录");
  }

  const applyRole = resolveApplyRole(input.requestedRole);
  const roleFields = fieldsForSignup(applyRole);
  const user = await prisma.user.create({
    data: {
      name,
      username: checked.username,
      email: accountPlaceholderEmail(checked.username),
      passwordHash: await hashPassword(password),
      passwordSet: true,
      referralCode: makeReferralCode(),
      referredById: await resolveReferrerId(input.referralCode),
      ...roleFields,
    },
  });

  const result = await sessionPayloadForUser(user);
  return { userId: user.id, result };
}

/**
 * 账号 + 密码登录（只查 username，不走邮箱字段）。
 */
export async function loginUserByUsername(input: {
  username: string;
  password: string;
}): Promise<{ userId: string; result: AuthResultPayload }> {
  const checked = validateUsername(input.username);
  if (!checked.ok) throw new Error(checked.error);

  const password = (input.password || "").trim();
  if (password.length < 6) {
    throw new Error("密码至少 6 位");
  }

  const user = await prisma.user.findUnique({
    where: { username: checked.username },
  });
  if (
    !user ||
    !user.passwordSet ||
    !(await verifyPassword(password, user.passwordHash))
  ) {
    throw new Error("账号或密码错误");
  }

  const result = await sessionPayloadForUser(user);
  return { userId: user.id, result };
}
