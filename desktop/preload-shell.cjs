/**
 * 壳层预加载：仅暴露窗口控制与导航 IPC，不泄露 Node。
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("yydsShell", {
  windowAction: (action) => ipcRenderer.invoke("shell:window", action),
  navigate: (target) => ipcRenderer.invoke("shell:navigate", target),
  search: (query) => ipcRenderer.invoke("shell:search", query),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  logout: () => ipcRenderer.invoke("shell:logout"),
  onNavState: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("shell:nav-state", handler);
    return () => ipcRenderer.removeListener("shell:nav-state", handler);
  },
  onLoading: (cb) => {
    const handler = (_e, loading) => cb(loading);
    ipcRenderer.on("shell:loading", handler);
    return () => ipcRenderer.removeListener("shell:loading", handler);
  },
  onWindowState: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("shell:window-state", handler);
    return () => ipcRenderer.removeListener("shell:window-state", handler);
  },
  onSession: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("shell:session", handler);
    return () => ipcRenderer.removeListener("shell:session", handler);
  },
});
