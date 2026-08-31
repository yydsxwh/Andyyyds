"use client";

/**
 * 个人中心 / 分销：邀请码、链接复制、带二维码宣传海报。
 * 微信内：复制链接发给好友；海报可长按保存后发朋友圈或聊天。
 * 海报支持多种渐变 / 实景照片背景模板（本地 /covers，避免 canvas 跨域）。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  inviteHomeUrl,
  inviteProductUrl,
  inviteRegisterUrl,
} from "@andyyyds/shared/invite";
import { productTypeLabel } from "@andyyyds/shared/product-types";
import {
  DEFAULT_POSTER_TEMPLATE_ID,
  POSTER_TEMPLATES,
  posterTemplateById,
  type PosterTemplate,
} from "@andyyyds/shared/poster-templates";
import { isWeChatBrowser } from "@andyyyds/shared/wechat-env";

type Props = {
  inviteCode: string;
  /** 可选：为某门课/资料生成分享链与海报 */
  courseSlug?: string;
  courseTitle?: string;
  productType?: string;
  siteName?: string;
};

export function InviteSharePanel({
  inviteCode,
  courseSlug,
  courseTitle,
  productType = "COURSE",
  siteName = "YYDS",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"site" | "course">(
    courseSlug ? "course" : "site",
  );
  const [templateId, setTemplateId] = useState(DEFAULT_POSTER_TEMPLATE_ID);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [inWeChat, setInWeChat] = useState(false);
  const kind = productTypeLabel(productType);

  const registerUrl = inviteRegisterUrl(inviteCode);
  const homeUrl = inviteHomeUrl(inviteCode);
  const courseUrl =
    courseSlug && inviteCode
      ? inviteProductUrl(courseSlug, inviteCode, productType)
      : "";
  const shareUrl =
    mode === "course" && courseUrl ? courseUrl : homeUrl || registerUrl;

  const drawPoster = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !inviteCode) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = 750;
    const h = 1200;
    canvas.width = w;
    canvas.height = h;

    const template = posterTemplateById(templateId);
    await paintPosterBackground(ctx, w, h, template);

    const light = template.textTone === "light";
    const titleColor = light ? "#f8fafc" : "#0f172a";
    const accentColor = light ? "#7dd3fc" : "#0284c7";
    const mutedColor = light ? "#cbd5e1" : "#5b6b7c";
    const codeColor = light ? "#fda4af" : "#f43f5e";
    const tipColor = light ? "#38bdf8" : "#0ea5e9";

    // photo-top：主文案与二维码落在下半区，避免压在顶部照片上
    const isPhotoTop = template.layout === "photo-top";
    const textBaseY = isPhotoTop ? 500 : 120;
    const qrSize = isPhotoTop ? 280 : 360;
    const qrY = isPhotoTop ? 760 : 420;

    ctx.fillStyle = titleColor;
    ctx.font = "bold 52px system-ui, sans-serif";
    ctx.fillText(siteName.slice(0, 16), 56, textBaseY);

    ctx.fillStyle = accentColor;
    ctx.font = "bold 40px system-ui, sans-serif";
    const headline =
      mode === "course" && courseTitle
        ? courseTitle.slice(0, 18)
        : "邀请你一起来学习";
    ctx.fillText(headline, 56, textBaseY + 80);

    ctx.fillStyle = mutedColor;
    ctx.font = "28px system-ui, sans-serif";
    ctx.fillText("扫码或打开链接，使用邀请码注册", 56, textBaseY + 140);
    ctx.fillStyle = codeColor;
    ctx.font = "bold 36px system-ui, sans-serif";
    ctx.fillText(`邀请码 ${inviteCode}`, 56, textBaseY + 200);

    try {
      const qrDataUrl = await QRCode.toDataURL(shareUrl, {
        width: qrSize,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("qr"));
        img.src = qrDataUrl;
      });
      const qrX = (w - qrSize) / 2;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 20);
      ctx.fill();
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
    } catch {
      ctx.fillStyle = "#ef4444";
      ctx.font = "28px system-ui, sans-serif";
      ctx.fillText("二维码生成失败", 56, 500);
    }

    ctx.fillStyle = mutedColor;
    ctx.font = isPhotoTop ? "20px system-ui, sans-serif" : "22px system-ui, sans-serif";
    wrapText(ctx, shareUrl, 56, isPhotoTop ? 1085 : 880, w - 112, isPhotoTop ? 26 : 30);

    ctx.fillStyle = tipColor;
    ctx.font = "26px system-ui, sans-serif";
    ctx.fillText("长按保存海报，分享给微信好友", 56, isPhotoTop ? 1165 : 1120);
  }, [inviteCode, mode, courseTitle, shareUrl, siteName, templateId]);

  useEffect(() => {
    setInWeChat(isWeChatBrowser());
    void drawPoster();
  }, [drawPoster]);

  async function copyText(text: string, okMsg: string) {
    setError("");
    setNotice("");
    try {
      await navigator.clipboard.writeText(text);
      setNotice(okMsg);
    } catch {
      setError("复制失败，请长按链接手动复制");
    }
  }

  function downloadPoster() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `invite-${inviteCode}-${mode}.png`;
    a.click();
    setNotice(
      inWeChat
        ? "若未开始下载，请长按上方海报图片保存后发给微信好友"
        : "海报已开始下载",
    );
  }

  async function nativeShare() {
    setError("");
    if (!navigator.share) {
      await copyText(shareUrl, "已复制链接，可粘贴发给微信好友");
      return;
    }
    try {
      await navigator.share({
        title: siteName,
        text: `邀请码 ${inviteCode}，一起来学习`,
        url: shareUrl,
      });
      setNotice("已调起系统分享");
    } catch {
      /* 用户取消 */
    }
  }

  if (!inviteCode) {
    return (
      <p className="text-sm text-[var(--muted)]">暂无邀请码，请联系站长配置。</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs text-[var(--muted)]">邀请码</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--brand)]">
            {inviteCode}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 self-end">
          <button
            type="button"
            className="btn btn-secondary min-h-10 px-3 text-sm"
            onClick={() => void copyText(inviteCode, "邀请码已复制")}
          >
            复制邀请码
          </button>
          <button
            type="button"
            className="btn btn-secondary min-h-10 px-3 text-sm"
            onClick={() => void copyText(registerUrl, "注册邀请链接已复制")}
          >
            复制注册链接
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm ${
            mode === "site"
              ? "bg-[var(--brand)] text-white"
              : "border border-[var(--line)]"
          }`}
          onClick={() => setMode("site")}
        >
          全站宣传海报
        </button>
        {courseSlug ? (
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm ${
              mode === "course"
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--line)]"
            }`}
            onClick={() => setMode("course")}
          >
            {kind}分享海报
          </button>
        ) : null}
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">海报背景模板</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {POSTER_TEMPLATES.map((tpl) => {
            const selected = templateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                className={`min-h-11 overflow-hidden rounded-xl border text-left ${
                  selected
                    ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30"
                    : "border-[var(--line)]"
                }`}
                onClick={() => setTemplateId(tpl.id)}
                aria-pressed={selected}
              >
                <PosterTemplateThumb template={tpl} />
                <div className="px-2 py-1.5">
                  <div className="truncate text-xs font-medium">{tpl.label}</div>
                  <div className="truncate text-[10px] text-[var(--muted)]">
                    {tpl.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="break-all text-sm text-[var(--muted)]">{shareUrl}</p>

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-2">
        <canvas
          ref={canvasRef}
          className="mx-auto h-auto w-full max-w-sm"
          style={{ imageRendering: "auto" }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary min-h-11"
          onClick={() => void copyText(shareUrl, "分享链接已复制，可粘贴到微信")}
        >
          复制分享链接
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11"
          onClick={downloadPoster}
        >
          保存海报
        </button>
        <button
          type="button"
          className="btn btn-fire min-h-11"
          onClick={() => void nativeShare()}
        >
          分享给好友
        </button>
      </div>

      <p className="text-sm text-[var(--muted)]">
        {inWeChat
          ? "微信内：点「复制分享链接」发给好友，或长按海报保存后发送。好友打开并注册后即绑定为你的下级。"
          : "可将链接或海报发给微信好友；对方用带邀请码的链接注册后计入你的业绩。"}
      </p>
      {notice ? <p className="text-sm text-[var(--brand)]">{notice}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function PosterTemplateThumb({ template }: { template: PosterTemplate }) {
  if (template.layout !== "gradient" && template.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={template.imageUrl}
        alt=""
        className="aspect-[16/9] w-full object-cover"
      />
    );
  }
  return (
    <div
      className="aspect-[16/9] w-full"
      style={{
        background: `linear-gradient(135deg, ${template.gradientStops[0]}, ${template.gradientStops[1]}, ${template.gradientStops[2]})`,
      }}
    />
  );
}

async function paintPosterBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  template: PosterTemplate,
) {
  if (template.layout === "gradient" || !template.imageUrl) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, template.gradientStops[0]);
    grad.addColorStop(0.45, template.gradientStops[1]);
    grad.addColorStop(1, template.gradientStops[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const photo = await loadImage(template.imageUrl);
  if (!photo) {
    // 照片加载失败时回退渐变，保证海报仍可生成
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, template.gradientStops[0]);
    grad.addColorStop(0.5, template.gradientStops[1]);
    grad.addColorStop(1, template.gradientStops[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  if (template.layout === "photo-top") {
    const topH = 460;
    drawCoverFit(ctx, photo, 0, 0, w, topH);
    const grad = ctx.createLinearGradient(0, topH, 0, h);
    grad.addColorStop(0, template.gradientStops[0]);
    grad.addColorStop(0.5, template.gradientStops[1]);
    grad.addColorStop(1, template.gradientStops[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, topH, w, h - topH);
    return;
  }

  // full-photo：铺满后加半透明遮罩，保证浅色文字可读
  drawCoverFit(ctx, photo, 0, 0, w, h);
  ctx.fillStyle = template.photoOverlay || "rgba(15, 23, 42, 0.5)";
  ctx.fillRect(0, 0, w, h);
}

/** cover 裁切：等比铺满目标矩形 */
function drawCoverFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  tw: number,
  th: number,
) {
  const scale = Math.max(tw / img.width, th / img.height);
  const sw = tw / scale;
  const sh = th / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, tw, th);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  let line = "";
  let yy = y;
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = ch;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
