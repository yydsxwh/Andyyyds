/**
 * 内容区预加载：标记桌面壳环境，供站点日后按需适配（可选）。
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("yydsDesktop", {
  platform: "windows",
  shell: "netease-style",
  version: 2,
});
