/**
 * Capacitor 原生插件 WechatLogin 的前端桥接。
 * 仅在 Android 壳内调用；Web 端 registerPlugin 存在但方法会失败，调用方须先 isCapacitorAndroid。
 */

import { registerPlugin } from "@capacitor/core";

export type WechatLoginPlugin = {
  /** 调起微信授权；成功返回 OAuth code */
  login(options: { appId: string }): Promise<{ code: string }>;
  /** 本机是否安装微信 */
  isInstalled(): Promise<{ installed: boolean }>;
};

export const WechatLogin = registerPlugin<WechatLoginPlugin>("WechatLogin");
