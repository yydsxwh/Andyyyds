"use client";

import { useEffect, useRef } from "react";

type ChatEvent = {
  type?: string;
  conversationId?: string;
};

/**
 * 优先 WebSocket；断线时由页面自己的短轮询兜底。
 */
export function useChatRealtime(opts: {
  onEvent: (event: ChatEvent) => void;
  enabled?: boolean;
}) {
  const onEventRef = useRef(opts.onEvent);
  onEventRef.current = opts.onEvent;
  const enabled = opts.enabled !== false;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let ws: WebSocket | null = null;
    let closed = false;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${window.location.host}/api/chat/ws`;
      try {
        ws = new WebSocket(url);
      } catch {
        return;
      }
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as ChatEvent;
          if (data.type === "ready" || data.type === "pong") return;
          onEventRef.current(data);
        } catch {
          /* ignore */
        }
      };
      ws.onopen = () => {
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };
      ws.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = null;
        if (!closed) {
          reconnectTimer = setTimeout(connect, 4000);
        }
      };
      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();
    return () => {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [enabled]);
}
