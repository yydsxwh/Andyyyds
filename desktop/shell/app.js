/* 壳层交互：侧栏路由、窗口按钮、搜索、导航态同步 */
const api = window.yydsShell;

const navItems = Array.from(document.querySelectorAll(".nav-item[data-path]"));
const btnBack = document.getElementById("btn-back");
const btnForward = document.getElementById("btn-forward");
const btnReload = document.getElementById("btn-reload");
const btnMin = document.getElementById("btn-min");
const btnMax = document.getElementById("btn-max");
const btnClose = document.getElementById("btn-close");
const btnBrowser = document.getElementById("btn-browser");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const pageTitle = document.getElementById("page-title");
const pageUrl = document.getElementById("page-url");
const loadingBar = document.getElementById("loading-bar");
const icoMax = document.getElementById("ico-max");
const icoRestore = document.getElementById("ico-restore");

let currentUrl = "https://www.yydsxwh.com/";

function setActiveNav(url) {
  let path = "/";
  try {
    path = new URL(url).pathname || "/";
  } catch {
    path = "/";
  }

  let best = null;
  let bestLen = -1;
  for (const item of navItems) {
    const p = item.getAttribute("data-path") || "/";
    if (p === "/" && (path === "/" || path === "")) {
      best = item;
      bestLen = 1;
      continue;
    }
    if (p !== "/" && (path === p || path.startsWith(`${p}/`))) {
      if (p.length > bestLen) {
        best = item;
        bestLen = p.length;
      }
    }
  }

  for (const item of navItems) {
    item.classList.toggle("is-active", item === best);
  }
}

function shortHostPath(url) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}${u.search}`.replace(/\/$/, "") || u.host;
  } catch {
    return url;
  }
}

function setMaximizedUi(maximized) {
  icoMax.classList.toggle("is-hidden", maximized);
  icoRestore.classList.toggle("is-hidden", !maximized);
}

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    const path = item.getAttribute("data-path");
    if (!path) return;
    void api.navigate(path);
  });
});

btnBack?.addEventListener("click", () => void api.navigate("back"));
btnForward?.addEventListener("click", () => void api.navigate("forward"));
btnReload?.addEventListener("click", () => void api.navigate("reload"));
btnMin?.addEventListener("click", () => void api.windowAction("minimize"));
btnMax?.addEventListener("click", () => void api.windowAction("maximize"));
btnClose?.addEventListener("click", () => void api.windowAction("close"));

btnBrowser?.addEventListener("click", () => {
  void api.openExternal(currentUrl || "https://www.yydsxwh.com/");
});

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  void api.search(searchInput?.value || "");
});

api.onNavState((state) => {
  currentUrl = state.url || currentUrl;
  if (pageTitle) pageTitle.textContent = state.title || "歪歪滴艾斯";
  if (pageUrl) pageUrl.textContent = shortHostPath(currentUrl);
  if (btnBack) btnBack.disabled = !state.canGoBack;
  if (btnForward) btnForward.disabled = !state.canGoForward;
  setActiveNav(currentUrl);
});

api.onLoading((loading) => {
  loadingBar?.classList.toggle("is-on", Boolean(loading));
});

api.onWindowState((state) => {
  setMaximizedUi(Boolean(state?.maximized));
});

void api.windowAction("isMaximized").then((max) => setMaximizedUi(Boolean(max)));
