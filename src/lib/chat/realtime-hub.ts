/**
 * 进程内实时广播：自定义 Node 服与 Next API 同进程时可推到 WebSocket。
 * 以后拆独立 WS 集群时，把 publish 换成 Redis/MQ 即可，业务层不用改。
 */
import { EventEmitter } from "node:events";

export type ChatRealtimeEvent =
  | {
      type: "message";
      conversationId: string;
      message: {
        id: string;
        conversationId: string;
        senderId: string;
        type: string;
        body: string;
        mediaUrl: string;
        createdAt: string;
      };
    }
  | {
      type: "conversation";
      conversationId: string;
      status: string;
    };

type HubEvents = {
  user: (userId: string, event: ChatRealtimeEvent) => void;
};

class ChatRealtimeHub extends EventEmitter {
  publishToUsers(userIds: string[], event: ChatRealtimeEvent) {
    const unique = [...new Set(userIds.filter(Boolean))];
    for (const userId of unique) {
      this.emit("user", userId, event);
    }
  }
}

const globalKey = "__yyds_chat_realtime_hub__";

export function getChatRealtimeHub(): ChatRealtimeHub {
  const g = globalThis as typeof globalThis & {
    [globalKey]?: ChatRealtimeHub;
  };
  if (!g[globalKey]) {
    g[globalKey] = new ChatRealtimeHub();
  }
  return g[globalKey];
}
