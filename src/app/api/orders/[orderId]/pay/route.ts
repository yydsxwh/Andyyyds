/**
 * POST /api/orders/:orderId/pay —— 发起支付（核心）
 *
 * 请求体：channel / tradeType / allowNativeFallback
 * 微信响应 mode：wechat_need_oauth | wechat_jsapi | wechat_h5 | wechat
 *
 * 注意：同一商户订单号不能混用不同微信下单形态；冲突时引导重新下单。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAlipayPagePay, createAlipayWapPay } from "@andyyyds/shared/alipay";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { answersComplete } from "@andyyyds/shared/order-form";
import { fulfillPaidOrder } from "@andyyyds/shared/orders";
import { getPaymentChannels, getPublicSiteUrl } from "@andyyyds/shared/payments";
import { paymentReturnPath } from "@andyyyds/shared/product-types";
import { getOrderFormConfig } from "@andyyyds/shared/site-settings";
import {
  createH5Payment,
  createJsapiPayment,
  createNativePayment,
  isWechatOAuthConfigured,
} from "@andyyyds/shared/wechat-pay";

const bodySchema = z
  .object({
    channel: z.enum(["WECHAT", "ALIPAY", "MOCK"]).optional(),
    /** native=扫码 jsapi=微信内 h5=手机浏览器 */
    tradeType: z.enum(["native", "jsapi", "h5"]).optional(),
    /** 手机端默认 false：直连失败时不自动落成扫码单，避免锁单 */
    allowNativeFallback: z.boolean().optional(),
  })
  .optional();

/** H5 下单需要付款人客户端 IP */
function clientIpFrom(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

function uaFrom(req: Request) {
  return req.headers.get("user-agent") || "";
}

function isWeChatUa(ua: string) {
  return /MicroMessenger/i.test(ua);
}

function isMobileUa(ua: string) {
  return /Android|webOS|iPhone|iPod|iPad|Mobile|BlackBerry|IEMobile|Opera Mini/i.test(
    ua,
  );
}

function wechatOauthReturnPath(order: {
  id: string;
  orderNo: string;
  course: { productType: string };
}) {
  return paymentReturnPath({
    orderId: order.id,
    orderNo: order.orderNo,
    productType: order.course.productType,
  });
}

async function wechatH5RedirectUrl(order: {
  id: string;
  orderNo: string;
  course: { productType: string };
}) {
  const siteUrl = await getPublicSiteUrl();
  if (order.course.productType === "MATHCODE") {
    return `${siteUrl}${paymentReturnPath({
      orderId: order.id,
      orderNo: order.orderNo,
      productType: order.course.productType,
    })}`;
  }
  return `${siteUrl}/checkout/return?out_trade_no=${order.orderNo}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { course: true, user: true },
  });

  if (!order || order.userId !== session.id) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }
  if (order.status === "PAID") {
    return NextResponse.json({
      mode: "paid",
      slug: order.course.slug,
      productType: order.course.productType,
      status: "PAID",
    });
  }

  const orderForm = await getOrderFormConfig();
  if (!answersComplete(orderForm, order.formAnswersJson)) {
    return NextResponse.json(
      { error: "请先填写完整的购买信息" },
      { status: 400 },
    );
  }

  const ua = uaFrom(req);
  let channel: "WECHAT" | "ALIPAY" | "MOCK" = "WECHAT";
  let tradeType: "native" | "jsapi" | "h5" = "native";
  let allowNativeFallback = !isMobileUa(ua) && !isWeChatUa(ua);
  try {
    const parsed = bodySchema.parse(await req.json().catch(() => ({})));
    channel = parsed?.channel || "WECHAT";
    tradeType = parsed?.tradeType || "native";
    if (typeof parsed?.allowNativeFallback === "boolean") {
      allowNativeFallback = parsed.allowNativeFallback;
    }
  } catch {
    channel = "WECHAT";
    tradeType = "native";
  }

  // 服务端按 UA 校正：防止客户端误传 native，导致手机只能看到二维码
  if (channel === "WECHAT" && tradeType === "native") {
    if (isWeChatUa(ua)) tradeType = "jsapi";
    else if (isMobileUa(ua)) tradeType = "h5";
  }

  const channels = await getPaymentChannels();

  if (channel === "MOCK" || channels.mockOnly) {
    if (!channels.mockOnly && channel === "MOCK") {
      return NextResponse.json(
        { error: "线上已启用真实支付，请使用微信或支付宝" },
        { status: 400 },
      );
    }
    const paid = await fulfillPaidOrder({
      orderId: order.id,
      payChannel: "MOCK",
    });
    return NextResponse.json({
      mode: "mock",
      status: "PAID",
      slug: paid.course.slug,
      productType: paid.course.productType,
    });
  }

  try {
    if (channel === "WECHAT") {
      if (!channels.wechat) {
        return NextResponse.json({ error: "未启用微信支付" }, { status: 400 });
      }

      if (tradeType === "jsapi") {
        const openid = order.user.wechatOpenId?.trim() || "";
        if (!openid) {
          const oauthReady = await isWechatOAuthConfigured();
          if (oauthReady) {
            return NextResponse.json({
              mode: "wechat_need_oauth",
              oauthUrl: `/api/auth/wechat?returnUrl=${encodeURIComponent(wechatOauthReturnPath(order))}`,
              status: "PENDING",
              orderNo: order.orderNo,
              amount: order.amount,
              slug: order.course.slug,
      productType: order.course.productType,
            });
          }
          // 无 AppSecret：微信内无法 JSAPI，改走 H5（若商户已开通）；再不行走明确错误
          tradeType = "h5";
        } else {
          if (
            order.codeUrl &&
            order.payChannel &&
            order.payChannel !== "WECHAT_JSAPI"
          ) {
            return NextResponse.json({
              mode: "wechat_trade_conflict",
              error:
                "本订单已用其他支付方式发起过，请返回课程重新下单后再支付",
              codeUrl:
                allowNativeFallback &&
                (order.payChannel === "WECHAT" ||
                  order.payChannel === "WECHAT_NATIVE")
                  ? order.codeUrl
                  : "",
              status: order.status,
              orderNo: order.orderNo,
              amount: order.amount,
              slug: order.course.slug,
      productType: order.course.productType,
            });
          }
          const { payParams, prepayId } = await createJsapiPayment({
            orderNo: order.orderNo,
            description: order.course.title,
            amountCents: order.amount,
            openid,
          });
          await prisma.order.update({
            where: { id: order.id },
            data: {
              payChannel: "WECHAT_JSAPI",
              codeUrl: `prepay:${prepayId}`,
            },
          });
          return NextResponse.json({
            mode: "wechat_jsapi",
            status: "PENDING",
            orderNo: order.orderNo,
            payParams,
            amount: order.amount,
            slug: order.course.slug,
      productType: order.course.productType,
          });
        }
      }

      if (tradeType === "h5") {
        if (
          order.codeUrl &&
          order.payChannel &&
          order.payChannel !== "WECHAT_H5"
        ) {
          if (
            order.payChannel === "WECHAT" ||
            order.payChannel === "WECHAT_NATIVE"
          ) {
            if (allowNativeFallback) {
              return NextResponse.json({
                mode: "wechat",
                status: order.status,
                orderNo: order.orderNo,
                codeUrl: order.codeUrl,
                amount: order.amount,
                slug: order.course.slug,
      productType: order.course.productType,
                hint: "请长按识别二维码，或使用微信扫一扫完成支付",
              });
            }
            return NextResponse.json(
              {
                error:
                  "本订单已生成扫码单。请返回课程重新下单，即可在手机上直接调起微信支付",
              },
              { status: 400 },
            );
          }
          if (order.payChannel === "WECHAT_JSAPI") {
            return NextResponse.json(
              {
                error:
                  "本订单已在微信内发起过支付。请打开微信完成支付，或返回课程重新下单",
              },
              { status: 400 },
            );
          }
        }
        if (order.codeUrl && order.payChannel === "WECHAT_H5") {
          const redirectUrl = encodeURIComponent(
            await wechatH5RedirectUrl(order),
          );
          const payUrl = order.codeUrl.includes("redirect_url=")
            ? order.codeUrl
            : `${order.codeUrl}${order.codeUrl.includes("?") ? "&" : "?"}redirect_url=${redirectUrl}`;
          return NextResponse.json({
            mode: "wechat_h5",
            status: order.status,
            orderNo: order.orderNo,
            mwebUrl: payUrl,
            amount: order.amount,
            slug: order.course.slug,
      productType: order.course.productType,
          });
        }
        try {
          const { mwebUrl } = await createH5Payment({
            orderNo: order.orderNo,
            description: order.course.title,
            amountCents: order.amount,
            clientIp: clientIpFrom(req),
            appName: order.course.title,
          });
          await prisma.order.update({
            where: { id: order.id },
            data: { payChannel: "WECHAT_H5", codeUrl: mwebUrl },
          });
          const redirectUrl = encodeURIComponent(
            await wechatH5RedirectUrl(order),
          );
          const payUrl = `${mwebUrl}${mwebUrl.includes("?") ? "&" : "?"}redirect_url=${redirectUrl}`;
          return NextResponse.json({
            mode: "wechat_h5",
            status: "PENDING",
            orderNo: order.orderNo,
            mwebUrl: payUrl,
            amount: order.amount,
            slug: order.course.slug,
      productType: order.course.productType,
          });
        } catch (h5Error) {
          const message =
            h5Error instanceof Error ? h5Error.message : "H5 支付不可用";
          if (allowNativeFallback) {
            tradeType = "native";
          } else {
            const oauthReady = await isWechatOAuthConfigured();
            return NextResponse.json(
              {
                error: oauthReady
                  ? `无法调起手机支付：${message}。请在微信内打开本站完成支付，或返回课程重新下单。`
                  : `无法调起手机直接支付：${message}。请在系统设置填写公众号 AppSecret，并在微信商户平台开通 H5 支付；微信内打开时可直接调起支付。`,
                needAppSecret: !oauthReady,
              },
              { status: 400 },
            );
          }
        }
      }

      // Native 扫码（桌面，或 JSAPI/H5 降级）
      if (
        order.codeUrl &&
        (order.payChannel === "WECHAT" ||
          order.payChannel === "WECHAT_NATIVE")
      ) {
        return NextResponse.json({
          mode: "wechat",
          status: order.status,
          orderNo: order.orderNo,
          codeUrl: order.codeUrl,
          amount: order.amount,
          slug: order.course.slug,
      productType: order.course.productType,
        });
      }
      if (
        order.codeUrl &&
        order.payChannel &&
        order.payChannel !== "WECHAT" &&
        order.payChannel !== "WECHAT_NATIVE"
      ) {
        return NextResponse.json(
          {
            error:
              "本订单已用手机支付方式发起过。若未完成支付，请返回课程重新下单；或在微信内完成先前的支付。",
          },
          { status: 400 },
        );
      }

      const { codeUrl } = await createNativePayment({
        orderNo: order.orderNo,
        description: order.course.title,
        amountCents: order.amount,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { payChannel: "WECHAT_NATIVE", codeUrl },
      });
      return NextResponse.json({
        mode: "wechat",
        status: "PENDING",
        orderNo: order.orderNo,
        codeUrl,
        amount: order.amount,
        slug: order.course.slug,
      productType: order.course.productType,
      });
    }

    if (channel === "ALIPAY") {
      if (!channels.alipay) {
        return NextResponse.json({ error: "未启用支付宝支付" }, { status: 400 });
      }
      const useWap = isMobileUa(ua) || isWeChatUa(ua);
      const payInput = {
        orderNo: order.orderNo,
        subject: order.course.title,
        amountCents: order.amount,
      };
      let payUrl = "";
      let payChannel = "ALIPAY";
      try {
        if (useWap) {
          const wap = await createAlipayWapPay(payInput);
          payUrl = wap.payUrl;
          payChannel = "ALIPAY_WAP";
        } else {
          const page = await createAlipayPagePay(payInput);
          payUrl = page.payUrl;
          payChannel = "ALIPAY_PAGE";
        }
      } catch (alipayError) {
        // 手机网站支付未开通时，回退电脑网站支付
        if (useWap) {
          const page = await createAlipayPagePay(payInput);
          payUrl = page.payUrl;
          payChannel = "ALIPAY_PAGE";
        } else {
          throw alipayError;
        }
      }
      await prisma.order.update({
        where: { id: order.id },
        data: { payChannel, codeUrl: payUrl },
      });
      return NextResponse.json({
        mode: "alipay",
        status: "PENDING",
        orderNo: order.orderNo,
        payUrl,
        amount: order.amount,
        slug: order.course.slug,
      productType: order.course.productType,
      });
    }

    return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "发起支付失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
