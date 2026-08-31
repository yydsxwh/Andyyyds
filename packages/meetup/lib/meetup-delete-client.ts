/**
 * 约搭硬删除（浏览器端确认流）
 *
 * 为何单独抽：广场卡片 / 详情 / 我的约搭 / 站长列表共用同一套
 * confirm → DELETE → 409 needForce 再确认，避免各入口误删已付订单。
 */

export type MeetupDeleteClientResult =
  | { ok: true; deletedOrders: number }
  | { ok: false; cancelled: true; message?: string }
  | { ok: false; cancelled?: false; error: string };

type DeleteVia = "public" | "studio";

function deleteUrl(meetupId: string, via: DeleteVia, force: boolean) {
  const base =
    via === "studio"
      ? `/api/studio/meetups/${meetupId}`
      : `/api/meetup/${meetupId}`;
  return force ? `${base}?force=1` : base;
}

/**
 * 弹出确认后请求删除；遇 needForce 再二次确认。
 * @param via public=发起人/前台站长；studio=站长约搭管理
 */
export async function confirmAndDeleteMeetup(options: {
  meetupId: string;
  title: string;
  via?: DeleteVia;
  /** 已知已付笔数时文案更准；未知则依赖服务端 409 */
  paidOrderCount?: number;
}): Promise<MeetupDeleteClientResult> {
  const {
    meetupId,
    title,
    via = "public",
    paidOrderCount = 0,
  } = options;

  const tip =
    paidOrderCount > 0
      ? `「${title}」有 ${paidOrderCount} 笔已付订单。建议先点「取消」。仍要硬删除将清除订单与报名，且不可恢复。确定继续？`
      : `确定删除「${title}」？报名记录与关联订单壳将一并清除，且不可恢复。`;
  if (!confirm(tip)) {
    return { ok: false, cancelled: true };
  }

  try {
    let res = await fetch(deleteUrl(meetupId, via, false), {
      method: "DELETE",
    });
    let data = (await res.json()) as {
      error?: string;
      needForce?: boolean;
      deletedOrders?: number;
    };

    if (res.status === 409 && data.needForce) {
      if (
        !confirm(`${data.error || "存在已付订单。"}\n\n确认强制硬删除？`)
      ) {
        return {
          ok: false,
          cancelled: true,
          message: "已取消删除；可先「取消」活动保留履约数据。",
        };
      }
      res = await fetch(deleteUrl(meetupId, via, true), { method: "DELETE" });
      data = (await res.json()) as typeof data;
    }

    if (!res.ok) {
      return { ok: false, error: data.error || "删除失败" };
    }
    return { ok: true, deletedOrders: Number(data.deletedOrders) || 0 };
  } catch {
    return { ok: false, error: "网络异常" };
  }
}
