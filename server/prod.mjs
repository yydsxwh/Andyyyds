/**
 * 生产入口：Next.js + 同端口 WebSocket（/api/chat/ws）。
 * 与 API 同进程通过 globalThis.__yyds_chat_realtime_hub__ 广播消息。
 */
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, parse as parseUrl } from "node:url";
import { config as loadEnv } from "dotenv";
import { jwtVerify } from "jose";
import next from "next";
import { WebSocketServer } from "ws";

const require = createRequire(import.meta.url);
const { EventEmitter } = require("node:events");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
loadEnv({ path: path.join(root, ".env") });

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const COOKIE = "yyds_session";
const HUB_KEY = "__yyds_chat_realtime_hub__";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing");
  return new TextEncoder().encode(secret);
}

function parseCookie(header, name) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

async function userIdFromReq(req) {
  const url = new URL(req.url || "", "http://localhost");
  const token =
    url.searchParams.get("token") ||
    parseCookie(req.headers.cookie, COOKIE) ||
    undefined;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const id = String(payload.id || "");
    return id || null;
  } catch {
    return null;
  }
}

function getOrCreateHub() {
  const g = globalThis;
  if (!g[HUB_KEY]) {
    const hub = new EventEmitter();
    hub.publishToUsers = function publishToUsers(userIds, event) {
      for (const uid of [...new Set((userIds || []).filter(Boolean))]) {
        hub.emit("user", uid, event);
      }
    };
    g[HUB_KEY] = hub;
  }
  return g[HUB_KEY];
}

const hub = getOrCreateHub();
/** @type {Map<string, Set<import('ws').WebSocket>>} */
const socketsByUser = new Map();

function addSocket(userId, ws) {
  let set = socketsByUser.get(userId);
  if (!set) {
    set = new Set();
    socketsByUser.set(userId, set);
  }
  set.add(ws);
}

function removeSocket(userId, ws) {
  const set = socketsByUser.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) socketsByUser.delete(userId);
}

const app = next({ dev, hostname, port, dir: root });
const handle = app.getRequestHandler();
await app.prepare();

const server = createServer((req, res) => {
  handle(req, res, parseUrl(req.url, true));
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", async (req, socket, head) => {
  const { pathname } = parseUrl(req.url || "", true);
  if (pathname !== "/api/chat/ws") {
    socket.destroy();
    return;
  }
  const userId = await userIdFromReq(req);
  if (!userId) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    addSocket(userId, ws);
    ws.send(JSON.stringify({ type: "ready", userId }));
    ws.on("close", () => removeSocket(userId, ws));
    ws.on("error", () => removeSocket(userId, ws));
    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(String(raw));
        if (data?.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        /* ignore */
      }
    });
  });
});

hub.on("user", (userId, event) => {
  const set = socketsByUser.get(userId);
  if (!set) return;
  const payload = JSON.stringify(event);
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(payload);
  }
});

server.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port} (Next + Chat WS)`);
});
