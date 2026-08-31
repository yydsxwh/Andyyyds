"use client";

/**
 * 约搭详情块编辑：文本 / 图片（可上传）/ 视频 URL。
 * 输出 contentBlocks 给创建接口拼 HTML。
 */

import { ImageUrlField } from "@/components/image-url-field";
import type { MeetupContentBlock } from "@andyyyds/meetup/lib/meetup-content";

type Props = {
  blocks: MeetupContentBlock[];
  onChange: (blocks: MeetupContentBlock[]) => void;
};

export function MeetupContentEditor({ blocks, onChange }: Props) {
  function update(index: number, next: MeetupContentBlock) {
    onChange(blocks.map((b, i) => (i === index ? next : b)));
  }

  function remove(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function add(type: MeetupContentBlock["type"]) {
    if (blocks.length >= 40) return;
    if (type === "text") {
      onChange([...blocks, { type: "text", text: "" }]);
    } else if (type === "image") {
      onChange([...blocks, { type: "image", url: "" }]);
    } else {
      onChange([...blocks, { type: "video", url: "" }]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => add("text")}
        >
          + 文本
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => add("image")}
        >
          + 图片
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => add("video")}
        >
          + 视频
        </button>
      </div>
      <p className="text-xs text-[var(--muted)]">
        图片可上传相册；视频填 http(s) 或可嵌入链接。手机微信内同样可点。
      </p>

      {blocks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          可选：用图文视频介绍活动亮点；不填则只用上方短简介。
        </p>
      ) : null}

      <ul className="space-y-3">
        {blocks.map((block, index) => (
          <li
            key={`${block.type}-${index}`}
            className="rounded-2xl border border-[var(--line)] bg-white/60 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--muted)]">
                {block.type === "text"
                  ? "文本"
                  : block.type === "image"
                    ? "图片"
                    : "视频"}
              </span>
              <button
                type="button"
                className="min-h-11 px-2 text-sm text-[var(--fire)]"
                onClick={() => remove(index)}
              >
                删除
              </button>
            </div>
            {block.type === "text" ? (
              <textarea
                className="field min-h-28"
                value={block.text}
                onChange={(e) =>
                  update(index, { type: "text", text: e.target.value })
                }
                placeholder="活动介绍、玩法、注意事项…"
                maxLength={8000}
              />
            ) : null}
            {block.type === "image" ? (
              <div className="space-y-2">
                <ImageUrlField
                  label="图片"
                  value={block.url}
                  onChange={(url) =>
                    update(index, {
                      type: "image",
                      url,
                      caption: block.caption,
                    })
                  }
                />
                <input
                  className="field min-h-11"
                  value={block.caption || ""}
                  onChange={(e) =>
                    update(index, {
                      type: "image",
                      url: block.url,
                      caption: e.target.value,
                    })
                  }
                  placeholder="图片说明（选填）"
                  maxLength={200}
                />
              </div>
            ) : null}
            {block.type === "video" ? (
              <input
                className="field min-h-11"
                value={block.url}
                onChange={(e) =>
                  update(index, { type: "video", url: e.target.value })
                }
                placeholder="视频 mp4 链接或可嵌入页链接"
                maxLength={500}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
