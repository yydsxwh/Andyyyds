/**
 * 短信验证码发送与校验
 *
 * 生产：系统设置填阿里云短信 AccessKey + 签名 + 模板，关闭测试模式。
 * 联调：开启「短信测试模式」后验证码写入服务端日志，并可使用固定测试码。
 */

import crypto from "crypto";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RPCClient = require("@alicloud/pop-core") as {
  new (config: {
    accessKeyId: string;
    accessKeySecret: string;
    endpoint: string;
    apiVersion: string;
  }): {
    request: (
      action: string,
      params: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => Promise<unknown>;
  };
};
import { hashPassword, verifyPassword } from "./password";
import { prisma } from "./db";
import { getSiteSettings, type SiteSettingsRow } from "./site-settings";
import { isValidCnMobile, normalizePhone } from "./phone";

/** 验证码有效期（分钟） */
export const SMS_CODE_TTL_MINUTES = 5;
/** 同一手机号最短重发间隔（秒） */
export const SMS_RESEND_COOLDOWN_SEC = 60;
/** 同一手机号每日最多发送次数 */
export const SMS_DAILY_LIMIT = 20;

export type SmsPurpose = "login" | "bind";

export function smsConfigured(settings: SiteSettingsRow) {
  if (!settings.smsEnabled) return false;
  if (settings.smsTestMode || settings.smsProvider === "test") return true;
  return Boolean(
    settings.smsAccessKeyId?.trim() &&
      settings.smsAccessKeySecret?.trim() &&
      settings.smsSignName?.trim() &&
      settings.smsTemplateCode?.trim(),
  );
}

function randomSixDigitCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function sendAliyunSms(input: {
  settings: SiteSettingsRow;
  phone: string;
  code: string;
}) {
  const client = new RPCClient({
    accessKeyId: input.settings.smsAccessKeyId.trim(),
    accessKeySecret: input.settings.smsAccessKeySecret.trim(),
    endpoint: "https://dysmsapi.aliyuncs.com",
    apiVersion: "2017-05-25",
  });
  const result = (await client.request(
    "SendSms",
    {
      PhoneNumbers: input.phone,
      SignName: input.settings.smsSignName.trim(),
      TemplateCode: input.settings.smsTemplateCode.trim(),
      TemplateParam: JSON.stringify({ code: input.code }),
    },
    { method: "POST" },
  )) as { Code?: string; Message?: string };
  if (result.Code !== "OK") {
    throw new Error(result.Message || `短信发送失败（${result.Code || "unknown"}）`);
  }
}

/**
 * 发送验证码并写入 SmsCode。
 * 返回 cooldown 秒数；测试模式下附带 debugHint（勿对公网用户展示固定码以外的提示）。
 */
export async function sendSmsCode(input: {
  phone: string;
  purpose?: SmsPurpose;
}): Promise<{ ok: true; cooldownSec: number; testMode: boolean }> {
  const phone = normalizePhone(input.phone);
  if (!isValidCnMobile(phone)) {
    throw new Error("请输入正确的手机号");
  }
  const purpose: SmsPurpose = input.purpose || "login";
  const settings = await getSiteSettings();
  if (!settings.smsEnabled) {
    throw new Error("站长尚未启用短信登录，请使用邮箱或微信登录");
  }
  if (!smsConfigured(settings)) {
    throw new Error(
      "短信未配置完整。请在系统设置填写阿里云短信参数，或开启测试模式",
    );
  }

  const sinceCooldown = new Date(Date.now() - SMS_RESEND_COOLDOWN_SEC * 1000);
  const recent = await prisma.smsCode.findFirst({
    where: { phone, purpose, createdAt: { gte: sinceCooldown } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const waitSec = Math.ceil(
      (recent.createdAt.getTime() + SMS_RESEND_COOLDOWN_SEC * 1000 - Date.now()) /
        1000,
    );
    throw new Error(`发送过于频繁，请 ${Math.max(waitSec, 1)} 秒后再试`);
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const sentToday = await prisma.smsCode.count({
    where: { phone, createdAt: { gte: dayStart } },
  });
  if (sentToday >= SMS_DAILY_LIMIT) {
    throw new Error("今日发送次数已达上限，请明天再试或改用其他登录方式");
  }

  const useTest =
    settings.smsTestMode || settings.smsProvider === "test";
  const code =
    useTest && settings.smsTestFixedCode.trim()
      ? settings.smsTestFixedCode.trim().slice(0, 8)
      : randomSixDigitCode();

  if (!/^\d{4,8}$/.test(code)) {
    throw new Error("测试验证码格式无效，请使用 4～8 位数字");
  }

  await prisma.smsCode.create({
    data: {
      phone,
      purpose,
      codeHash: await hashPassword(code),
      expiresAt: new Date(Date.now() + SMS_CODE_TTL_MINUTES * 60 * 1000),
    },
  });

  if (useTest) {
    // 测试模式不调运营商：码落日志，便于本地 / 服务器联调
    console.info(
      `[sms:test] phone=${phone} purpose=${purpose} code=${code} ttl=${SMS_CODE_TTL_MINUTES}m`,
    );
  } else {
    await sendAliyunSms({ settings, phone, code });
  }

  return {
    ok: true,
    cooldownSec: SMS_RESEND_COOLDOWN_SEC,
    testMode: useTest,
  };
}

/** 校验验证码；成功则标记已用，防止重放 */
export async function verifySmsCode(input: {
  phone: string;
  code: string;
  purpose?: SmsPurpose;
}): Promise<boolean> {
  const phone = normalizePhone(input.phone);
  const code = String(input.code || "").trim();
  const purpose: SmsPurpose = input.purpose || "login";
  if (!isValidCnMobile(phone) || !/^\d{4,8}$/.test(code)) return false;

  const row = await prisma.smsCode.findFirst({
    where: {
      phone,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return false;
  const ok = await verifyPassword(code, row.codeHash);
  if (!ok) return false;
  await prisma.smsCode.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return true;
}
