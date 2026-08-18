import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android / iOS 壳：WebView 直接加载线上站点，SSR、API、登录、支付、上传、点播均走真实域名。
 * 本地 www/ 仅作离线兜底页；日常不依赖 Next 静态导出。
 */
const config: CapacitorConfig = {
  appId: "com.yydsxwh.app",
  appName: "歪歪滴艾斯",
  webDir: "www",
  server: {
    url: "https://www.yydsxwh.com",
    cleartext: false,
    // 允许跳转到支付 / OSS / VOD 等第三方域名而不被 Capacitor 拦回本地
    allowNavigation: [
      "yydsxwh.com",
      "*.yydsxwh.com",
      "*.aliyuncs.com",
      "*.aliyun.com",
      "*.alipay.com",
      "*.alipayobjects.com",
      "*.tenpay.com",
      "*.qq.com",
      "*.weixin.qq.com",
    ],
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#ffffff",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
  },
};

export default config;
