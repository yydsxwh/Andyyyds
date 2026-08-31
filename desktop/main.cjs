/**
 * Windows 桌面壳（网易云风格）：无边框深色侧栏 + 顶栏 + BrowserView 加载官网。
 * 功能仍走 https://www.yydsxwh.com，壳只负责桌面体验与导航。
 */
const {
  app,
  BrowserWindow,
  BrowserView,
  shell,
  Menu,
  Tray,
  ipcMain,
  session,
  nativeImage,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const SITE_ORIGIN = "https://www.yydsxwh.com";
const START_URL = `${SITE_ORIGIN}/`;
const PARTITION = "persist:yyds";

/** 侧栏 / 顶栏 / 底栏尺寸（与 shell CSS 同步） */
const SIDEBAR_W = 208;
const TITLE_H = 56;
const FOOTER_H = 52;

const IN_APP_HOST_SUFFIXES = [
  "yydsxwh.com",
  "aliyuncs.com",
  "aliyun.com",
  "alipay.com",
  "alipayobjects.com",
  "tenpay.com",
  "qq.com",
  "weixin.qq.com",
  "wx.qq.com",
];

const EXTERNAL_PROTOCOLS = new Set([
  "weixin:",
  "wechat:",
  "alipay:",
  "alipays:",
  "mailto:",
  "tel:",
]);

let mainWindow = null;
/** @type {Electron.BrowserView | null} */
let contentView = null;
/** @type {Electron.Tray | null} */
let tray = null;
let sessionTimer = null;
let lastSessionJson = "";

/** 与 electron-builder appId 一致，任务栏才把窗口和快捷方式归到同一图标 */
const APP_USER_MODEL_ID = "com.yydsxwh.app";
if (process.platform === "win32") {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

/**
 * Windows 任务栏/托盘读的是磁盘上的 .ico，asar 里的 PNG 路径经常显示成空白。
 * 打包后优先用 extraResources 解出来的 icon.ico。
 */
function resolveIconFile() {
  const candidates = [
    path.join(process.resourcesPath || "", "icon.ico"),
    path.join(__dirname, "icon.ico"),
    path.join(__dirname, "icon.png"),
  ];
  return candidates.find((file) => file && fs.existsSync(file)) || candidates[1];
}

function loadAppIcon() {
  const iconFile = resolveIconFile();
  try {
    const image = nativeImage.createFromBuffer(fs.readFileSync(iconFile));
    if (!image.isEmpty()) return { image, iconFile };
  } catch (err) {
    console.error("loadAppIcon buffer failed:", iconFile, err);
  }
  const image = nativeImage.createFromPath(iconFile);
  return { image, iconFile };
}

function isUnpackedIconPath(iconFile) {
  return Boolean(
    iconFile &&
      fs.existsSync(iconFile) &&
      !iconFile.includes(`${path.sep}app.asar${path.sep}`) &&
      !iconFile.endsWith(`${path.sep}app.asar`)
  );
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray(appIcon) {
  if (tray && !tray.isDestroyed()) return;
  // 托盘优先喂真实 ico 路径，Windows 才能按 DPI 选 16/24/32
  tray = isUnpackedIconPath(appIcon.iconFile)
    ? new Tray(appIcon.iconFile)
    : new Tray(appIcon.image);
  tray.setToolTip("歪歪滴艾斯");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开主窗口", click: () => showMainWindow() },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          app.quit();
        },
      },
    ])
  );
  tray.on("click", () => showMainWindow());
}

function hostAllowed(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host) return false;
  return IN_APP_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

function shouldOpenExternally(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (EXTERNAL_PROTOCOLS.has(parsed.protocol)) return true;
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return true;
    }
    return !hostAllowed(parsed.hostname);
  } catch {
    return true;
  }
}

async function openExternalSafe(rawUrl) {
  try {
    await shell.openExternal(rawUrl);
  } catch (err) {
    console.error("openExternal failed:", rawUrl, err);
  }
}

function layoutContentView() {
  if (!mainWindow || !contentView) return;
  const [width, height] = mainWindow.getContentSize();
  const x = SIDEBAR_W;
  const y = TITLE_H;
  const w = Math.max(320, width - SIDEBAR_W);
  const h = Math.max(240, height - TITLE_H - FOOTER_H);
  contentView.setBounds({ x, y, width: w, height: h });
}

function notifyShell(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

const SESSION_POLL_MS = 4000;

function siteSession() {
  return session.fromPartition(PARTITION);
}

async function fetchSessionFromApi() {
  const ses = siteSession();
  if (typeof ses.fetch !== "function") return null;
  const res = await ses.fetch(`${SITE_ORIGIN}/api/auth/session`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || typeof data !== "object") return null;
  return data;
}

/** 会话接口未上线时，从被隐藏的官网顶栏读登录态 */
const SCRAPE_SESSION_JS = `(() => {
  const header = document.querySelector("header.glass-bar");
  if (!header) return { user: null };
  const account = header.querySelector('a[href="/account"]');
  if (!account) return { user: null };
  const img = account.querySelector("img");
  const nameEl = account.querySelector("span");
  const name = ((nameEl && nameEl.textContent) || "").trim();
  if (!name && !img) return { user: null };
  return {
    user: {
      name: name || "已登录",
      avatarUrl: img ? img.getAttribute("src") || "" : "",
    },
  };
})()`;

async function scrapeSessionFromPage() {
  if (!contentView || contentView.webContents.isDestroyed()) {
    return { user: null };
  }
  const url = contentView.webContents.getURL() || "";
  if (!url.includes("yydsxwh.com")) return { user: null };
  try {
    const data = await contentView.webContents.executeJavaScript(
      SCRAPE_SESSION_JS,
      true,
    );
    if (data && typeof data === "object") return data;
  } catch {
    /* 页面未就绪时忽略 */
  }
  return { user: null };
}

async function refreshSession() {
  let payload = { user: null };
  try {
    const fromApi = await fetchSessionFromApi();
    if (fromApi && fromApi.user) {
      payload = fromApi;
    } else {
      const scraped = await scrapeSessionFromPage();
      payload =
        scraped && scraped.user ? scraped : fromApi || scraped || { user: null };
    }
  } catch (err) {
    console.error("refreshSession failed", err);
    try {
      payload = await scrapeSessionFromPage();
    } catch {
      payload = { user: null };
    }
  }
  const json = JSON.stringify(payload);
  if (json === lastSessionJson) return;
  lastSessionJson = json;
  notifyShell("shell:session", payload);
}

function startSessionPolling() {
  if (sessionTimer) clearInterval(sessionTimer);
  void refreshSession();
  sessionTimer = setInterval(() => {
    void refreshSession();
  }, SESSION_POLL_MS);
}

function stopSessionPolling() {
  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
}

async function logoutDesktop() {
  try {
    const ses = siteSession();
    if (typeof ses.fetch === "function") {
      await ses.fetch(`${SITE_ORIGIN}/api/auth/logout`, {
        method: "POST",
        redirect: "manual",
      });
    }
  } catch (err) {
    console.error("logout failed", err);
  }
  lastSessionJson = "";
  notifyShell("shell:session", { user: null });
  if (contentView && !contentView.webContents.isDestroyed()) {
    void contentView.webContents.loadURL(START_URL);
  }
  return true;
}

/** 壳内：隐藏官网顶栏底栏，并把站点品牌色改成网易云红 */
const SHELL_CONTENT_CSS = `
  header.glass-bar { display: none !important; }
  footer.glass-bar, body > footer { display: none !important; }

  :root, html, body {
    --brand: #ec4141 !important;
    --brand-strong: #c20c0c !important;
    --brand-soft: rgba(236, 65, 65, 0.14) !important;
    --fire: #ec4141 !important;
    --fire-strong: #c20c0c !important;
    --fire-soft: rgba(236, 65, 65, 0.14) !important;
    --accent: #ec4141 !important;
    --accent-soft: rgba(236, 65, 65, 0.14) !important;
  }

  .btn-primary {
    background: linear-gradient(180deg, #f05555 0%, #ec4141 48%, #c20c0c 100%) !important;
    border-color: #c20c0c !important;
    color: #fff !important;
  }
  .btn-fire {
    background: #ec4141 !important;
    border-color: #c20c0c !important;
    color: #fff !important;
  }
`;

function canGoBack(wc) {
  try {
    if (wc.navigationHistory?.canGoBack) return wc.navigationHistory.canGoBack();
  } catch {
    /* ignore */
  }
  return typeof wc.canGoBack === "function" ? wc.canGoBack() : false;
}

function canGoForward(wc) {
  try {
    if (wc.navigationHistory?.canGoForward) {
      return wc.navigationHistory.canGoForward();
    }
  } catch {
    /* ignore */
  }
  return typeof wc.canGoForward === "function" ? wc.canGoForward() : false;
}

function attachContentHandlers(view) {
  const wc = view.webContents;

  wc.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternally(url)) {
      void openExternalSafe(url);
      return { action: "deny" };
    }
    // 站内新窗口改在当前 BrowserView 打开，保持单页壳体验
    void wc.loadURL(url);
    return { action: "deny" };
  });

  wc.on("will-navigate", (event, url) => {
    if (shouldOpenExternally(url)) {
      event.preventDefault();
      void openExternalSafe(url);
    }
  });

  const pushNavState = () => {
    notifyShell("shell:nav-state", {
      url: wc.getURL(),
      title: wc.getTitle(),
      canGoBack: canGoBack(wc),
      canGoForward: canGoForward(wc),
    });
  };

  wc.on("did-navigate", () => {
    pushNavState();
    void refreshSession();
  });
  wc.on("did-navigate-in-page", () => {
    pushNavState();
    void refreshSession();
  });
  wc.on("page-title-updated", pushNavState);
  wc.on("did-finish-load", () => {
    void wc.insertCSS(SHELL_CONTENT_CSS).catch(() => {});
    pushNavState();
    void refreshSession();
  });
  wc.on("did-start-loading", () => notifyShell("shell:loading", true));
  wc.on("did-stop-loading", () => {
    notifyShell("shell:loading", false);
    pushNavState();
    void refreshSession();
  });
}

function createContentView() {
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "preload-view.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: PARTITION,
    },
  });
  attachContentHandlers(view);
  void view.webContents.loadURL(START_URL);
  return view;
}

function createWindow() {
  const appIcon = loadAppIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: "歪歪滴艾斯",
    backgroundColor: "#111111",
    frame: false,
    titleBarStyle: "hidden",
    show: false,
    autoHideMenuBar: true,
    skipTaskbar: false,
    icon: appIcon.image.isEmpty() ? undefined : appIcon.image,
    webPreferences: {
      preload: path.join(__dirname, "preload-shell.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);
  if (!appIcon.image.isEmpty()) {
    mainWindow.setIcon(appIcon.image);
  }

  contentView = createContentView();
  mainWindow.setBrowserView(contentView);
  layoutContentView();

  void mainWindow.loadFile(path.join(__dirname, "shell", "index.html"));

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !appIcon.image.isEmpty()) {
      mainWindow.setIcon(appIcon.image);
    }
    mainWindow?.show();
    createTray(appIcon);
    startSessionPolling();
  });

  mainWindow.on("resize", layoutContentView);
  mainWindow.on("maximize", () => {
    layoutContentView();
    notifyShell("shell:window-state", { maximized: true });
  });
  mainWindow.on("unmaximize", () => {
    layoutContentView();
    notifyShell("shell:window-state", { maximized: false });
  });

  mainWindow.on("closed", () => {
    stopSessionPolling();
    contentView = null;
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle("shell:window", (_event, action) => {
    if (!mainWindow) return false;
    switch (action) {
      case "minimize":
        mainWindow.minimize();
        return true;
      case "maximize":
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
        return true;
      case "close":
        mainWindow.close();
        return true;
      case "isMaximized":
        return mainWindow.isMaximized();
      default:
        return false;
    }
  });

  ipcMain.handle("shell:navigate", (_event, target) => {
    if (!contentView) return false;
    const wc = contentView.webContents;
    if (target === "back") {
      if (canGoBack(wc)) wc.goBack();
      return true;
    }
    if (target === "forward") {
      if (canGoForward(wc)) wc.goForward();
      return true;
    }
    if (target === "reload") {
      wc.reload();
      return true;
    }
    if (typeof target === "string" && target.startsWith("http")) {
      void wc.loadURL(target);
      return true;
    }
    if (typeof target === "string" && target.startsWith("/")) {
      void wc.loadURL(`${SITE_ORIGIN}${target}`);
      return true;
    }
    return false;
  });

  ipcMain.handle("shell:search", (_event, query) => {
    if (!contentView) return false;
    const q = String(query || "").trim();
    const url = q
      ? `${SITE_ORIGIN}/courses?q=${encodeURIComponent(q)}`
      : `${SITE_ORIGIN}/courses`;
    void contentView.webContents.loadURL(url);
    return true;
  });

  ipcMain.handle("shell:open-external", (_event, url) => {
    if (typeof url !== "string") return false;
    void openExternalSafe(url);
    return true;
  });

  ipcMain.handle("shell:logout", () => logoutDesktop());
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_USER_MODEL_ID);
    // will-download 必须在 app ready 之后挂到 session
    session.fromPartition(PARTITION).on("will-download", (_event, item) => {
      item.setSaveDialogOptions({ title: "保存文件" });
    });
    registerIpc();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("before-quit", () => {
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
      tray = null;
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
