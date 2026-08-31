/* 壳层交互：侧栏路由、登录态、窗口按钮、搜索、导航态同步 */
const api = window.yydsShell;

const navItems = Array.from(document.querySelectorAll(".nav-item[data-path]"));
const pathButtons = Array.from(document.querySelectorAll("[data-path]"));
const authEls = Array.from(document.querySelectorAll("[data-auth]"));
const btnBack = document.getElementById("btn-back");
const btnForward = document.getElementById("btn-forward");
const btnReload = document.getElementById("btn-reload");
const btnMin = document.getElementById("btn-min");
const btnMax = document.getElementById("btn-max");
const btnClose = document.getElementById("btn-close");
const btnBrowser = document.getElementById("btn-browser");
const btnLogout = document.getElementById("btn-logout");
const userCard = document.getElementById("user-card");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const pageTitle = document.getElementById("page-title");
const pageUrl = document.getElementById("page-url");
const loadingBar = document.getElementById("loading-bar");
const icoMax = document.getElementById("ico-max");
const icoRestore = document.getElementById("ico-restore");
const titleAvatar = document.getElementById("title-avatar");
const titleName = document.getElementById("title-name");
const footAvatar = document.getElementById("foot-avatar");
const footName = document.getElementById("foot-name");
const footHint = document.getElementById("foot-hint");

let currentUrl = "https://www.yydsxwh.com/";
let sessionUser = null;

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
    if (item.classList.contains("is-hidden")) continue;
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

function paintAvatar(el, name, url) {
  if (!el) return;
  el.replaceChildren();
  const src = String(url || "").trim();
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    el.appendChild(img);
    return;
  }
  el.textContent = (name || "?").trim().slice(0, 1) || "?";
}

function applySession(payload) {
  sessionUser = payload && payload.user ? payload.user : null;
  const loggedIn = Boolean(sessionUser && sessionUser.name);
  document.body.classList.toggle("is-logged-in", loggedIn);

  for (const el of authEls) {
    const need = el.getAttribute("data-auth");
    const show =
      (need === "user" && loggedIn) || (need === "guest" && !loggedIn);
    el.classList.toggle("is-hidden", !show);
  }

  const name = loggedIn ? sessionUser.name : "未登录";
  paintAvatar(titleAvatar, name, loggedIn ? sessionUser.avatarUrl : "");
  paintAvatar(footAvatar, loggedIn ? name : "登", loggedIn ? sessionUser.avatarUrl : "");
  if (titleName) titleName.textContent = name;
  if (footName) footName.textContent = name;
  if (footHint) {
    footHint.textContent = loggedIn ? "个人中心" : "点击登录 · 个人中心";
  }
  setActiveNav(currentUrl);
}

pathButtons.forEach((item) => {
  item.addEventListener("click", () => {
    const path = item.getAttribute("data-path");
    if (!path) return;
    void api.navigate(path);
  });
});

userCard?.addEventListener("click", () => {
  void api.navigate(sessionUser ? "/account" : "/login");
});

btnLogout?.addEventListener("click", () => {
  void api.logout();
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

api.onSession((payload) => {
  applySession(payload);
});

applySession({ user: null });
void api.windowAction("isMaximized").then((max) => setMaximizedUi(Boolean(max)));
