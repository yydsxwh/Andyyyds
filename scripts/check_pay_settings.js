const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

async function getWechatConfig(s) {
  const appId = s.wechatAppId || process.env.WECHAT_APP_ID || "";
  const mchId = s.wechatMchId || process.env.WECHAT_MCH_ID || "";
  const apiV3Key = s.wechatApiV3Key || process.env.WECHAT_API_V3_KEY || "";
  const serialNo = s.wechatMchSerialNo || process.env.WECHAT_MCH_SERIAL_NO || "";
  let privateKey = (s.wechatMchPrivateKey || "").replace(/\\n/g, "\n");
  if (!privateKey && process.env.WECHAT_MCH_PRIVATE_KEY) {
    privateKey = process.env.WECHAT_MCH_PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  if (!appId || !mchId || !apiV3Key || !serialNo || !privateKey) {
    throw new Error("wechat_config_incomplete");
  }
  if (apiV3Key.length !== 32) throw new Error("api_v3_key_not_32");
  return { appId, mchId, apiV3Key, serialNo, privateKey };
}

async function wechatGet(cfg, urlPath) {
  const method = "GET";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n\n`;
  const signature = crypto.createSign("RSA-SHA256").update(message).sign(cfg.privateKey, "base64");
  const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${cfg.serialNo}"`;
  const res = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    method,
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Accept-Language": "zh-CN",
      "User-Agent": "yyds-check",
    },
  });
  const text = await res.text();
  let code = "";
  try {
    code = JSON.parse(text).code || "";
  } catch {
    // ignore
  }
  return { status: res.status, code, body: text.slice(0, 500) };
}

(async () => {
  loadEnv();
  const p = new PrismaClient();
  try {
    const s = await p.siteSettings.findUnique({ where: { id: "default" } });
    if (!s) {
      console.log(JSON.stringify({ ok: false, error: "no_settings" }, null, 2));
      return;
    }

    const summary = {
      siteUrl: s.siteUrl || "",
      paymentMode: s.paymentMode,
      wechatEnabled: s.wechatEnabled,
      alipayEnabled: s.alipayEnabled,
      wechatAppId: s.wechatAppId || "",
      wechatMchId: s.wechatMchId || "",
      wechatApiV3KeyLen: (s.wechatApiV3Key || "").length,
      wechatMchSerialNo: s.wechatMchSerialNo || "",
      wechatPrivateKeyLen: (s.wechatMchPrivateKey || "").length,
      wechatPrivateKeyLooksPem: /BEGIN[\s\w]*PRIVATE KEY/.test(
        s.wechatMchPrivateKey || "",
      ),
      wechatConfigured: Boolean(
        s.wechatAppId &&
          s.wechatMchId &&
          s.wechatApiV3Key &&
          s.wechatMchSerialNo &&
          s.wechatMchPrivateKey,
      ),
      storageProvider: s.storageProvider,
    };

    let apiProbe = null;
    let channel = "mock";
    try {
      const cfg = await getWechatConfig(s);
      const ready = s.wechatEnabled && summary.wechatConfigured;
      channel =
        s.paymentMode === "mock"
          ? "mock"
          : ready
            ? "wechat"
            : "mock";
      // Lightweight signed call: certificates list
      apiProbe = await wechatGet(cfg, "/v3/certificates");
    } catch (e) {
      apiProbe = { error: String(e.message || e) };
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          summary,
          effectiveChannel: channel,
          apiProbe,
        },
        null,
        2,
      ),
    );
  } finally {
    await p.$disconnect();
  }
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e.message || e) }));
  process.exit(1);
});
