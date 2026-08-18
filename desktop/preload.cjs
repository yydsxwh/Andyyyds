/**
 * 预加载脚本：刻意不暴露 Node API。
 * 网站功能全部走线上域名，与浏览器版同一套前端即可完整复刻。
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("yydsDesktop", {
  platform: "windows",
  shell: true,
});
