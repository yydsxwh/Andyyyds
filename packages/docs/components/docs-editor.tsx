"use client";

/**
 * 网页文档编辑器：标题、多级标题、加粗、项目符号/编号、插图、简单表格。
 * 编号样子由 listScheme 决定，改方案立刻换 CSS，不必改正文 JSON。
 */

import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DOCS_LOCAL_ID,
  DOCS_TITLE_MAX_CHARS,
  type DocsDocumentPayload,
  type DocsJsonNode,
} from "@andyyyds/docs/lib/docs-content";
import {
  buildListSchemeCss,
  normalizeListScheme,
  type DocsListScheme,
} from "@andyyyds/docs/lib/docs-scheme";
import {
  createDocsDocumentRequest,
  deleteDocsDocumentRequest,
  saveDocsDocumentRequest,
  uploadDocsImage,
} from "@andyyyds/docs/lib/docs-client";
import { loadLocalDocument, saveLocalDocument } from "@andyyyds/docs/lib/docs-local";
import { DocsSchemePanel } from "@andyyyds/docs/components/docs-scheme-panel";
import "./docs-editor.css";

const AUTOSAVE_MS = 1200;
const GUEST_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;

const TabListKeys = Extension.create({
  name: "docsTabList",
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.sinkListItem("listItem"),
      "Shift-Tab": () => this.editor.commands.liftListItem("listItem"),
    };
  },
});

type Props = {
  initial: DocsDocumentPayload;
  loggedIn: boolean;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function headingValue(editor: Editor | null): string {
  if (!editor) return "0";
  for (let level = 1; level <= 6; level += 1) {
    if (editor.isActive("heading", { level })) return String(level);
  }
  return "0";
}

function collectImageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter((file) => file.type.startsWith("image/"));
}

export function DocsEditor({ initial, loggedIn }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [scheme, setScheme] = useState(() => normalizeListScheme(initial.listScheme));
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [docId, setDocId] = useState(initial.id);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef(title);
  const schemeRef = useRef(scheme);
  const [, setToolbarTick] = useState(0);
  titleRef.current = title;
  schemeRef.current = scheme;

  const schemeCss = useMemo(() => buildListSchemeCss(scheme), [scheme]);

  const insertImageFile = useCallback(async (editor: Editor, file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (loggedIn) {
      const src = await uploadDocsImage(file);
      editor.chain().focus().setImage({ src, alt: file.name }).run();
      return;
    }
    if (file.size > GUEST_IMAGE_MAX_BYTES) {
      throw new Error("未登录插图请小于 1.5MB，或登录后上传");
    }
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("读图失败"));
      reader.readAsDataURL(file);
    });
    editor.chain().focus().setImage({ src, alt: file.name }).run();
  }, [loggedIn]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
        code: false,
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: "写正文，或用工具栏加标题、列表、图片和表格",
      }),
      TabListKeys,
    ],
    content: initial.content,
    editorProps: {
      attributes: {
        class: "docs-prose",
      },
      handlePaste: (_view, event) => {
        const current = editorRef.current;
        const files = collectImageFiles(event.clipboardData);
        if (!files.length || !current) return false;
        event.preventDefault();
        void insertImageFile(current, files[0]).catch((err: unknown) => {
          setSaveError(err instanceof Error ? err.message : "插图失败");
        });
        return true;
      },
      handleDrop: (_view, event) => {
        const current = editorRef.current;
        const files = collectImageFiles(event.dataTransfer);
        if (!files.length || !current) return false;
        event.preventDefault();
        void insertImageFile(current, files[0]).catch((err: unknown) => {
          setSaveError(err instanceof Error ? err.message : "插图失败");
        });
        return true;
      },
    },
    onUpdate: () => {
      setSaveState("dirty");
    },
    onSelectionUpdate: () => {
      setToolbarTick((tick) => tick + 1);
    },
  });
  editorRef.current = editor;

  useEffect(() => {
    if (!editor) return;
    const source =
      initial.id === DOCS_LOCAL_ID ? loadLocalDocument() : initial;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(source.content);
    if (current !== incoming) {
      editor.commands.setContent(source.content, false);
    }
    setTitle(source.title);
    setScheme(normalizeListScheme(source.listScheme));
    setDocId(source.id);
    setSaveState("idle");
  }, [editor, initial]);

  const persist = useCallback(async () => {
    if (!editor) return;
    const content = editor.getJSON() as DocsJsonNode;
    setSaveState("saving");
    setSaveError("");
    try {
      if (!loggedIn || docId === DOCS_LOCAL_ID) {
        saveLocalDocument({
          title: titleRef.current,
          content,
          listScheme: schemeRef.current,
        });
        setSaveState("saved");
        return;
      }
      await saveDocsDocumentRequest(docId, {
        title: titleRef.current,
        content,
        listScheme: schemeRef.current,
      });
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "保存失败");
    }
  }, [docId, editor, loggedIn]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      void persist();
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [persist, saveState, title, scheme]);

  const markDirtyScheme = (next: DocsListScheme) => {
    setScheme(normalizeListScheme(next));
    setSaveState("dirty");
  };

  const run = (fn: (current: Editor) => void) => {
    if (!editor) return;
    fn(editor);
    editor.chain().focus().run();
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file || !editor) return;
    try {
      await insertImageFile(editor, file);
      setSaveState("dirty");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "插图失败");
    }
  };

  const saveToCloud = async () => {
    if (!editor) return;
    setSaveState("saving");
    setSaveError("");
    try {
      const created = await createDocsDocumentRequest({
        title: titleRef.current,
        content: editor.getJSON() as DocsJsonNode,
        listScheme: schemeRef.current,
      });
      window.location.href = `/products/docs/${created.id}`;
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "保存到云端失败");
    }
  };

  const removeCloudDoc = async () => {
    if (docId === DOCS_LOCAL_ID) return;
    if (!window.confirm("删除后不能恢复，确定删这篇？")) return;
    try {
      await deleteDocsDocumentRequest(docId);
      window.location.href = "/products/docs";
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "删除失败");
    }
  };

  const inTable = Boolean(editor?.isActive("table"));
  const saveLabel =
    saveState === "saving"
      ? "保存中…"
      : saveState === "saved"
        ? loggedIn && docId !== DOCS_LOCAL_ID
          ? "已保存到云端"
          : "已写入浏览器"
        : saveState === "dirty"
          ? "有未保存改动"
          : saveState === "error"
            ? "保存失败"
            : "已就绪";

  return (
    <div className="surface overflow-hidden rounded-[28px]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-3 sm:px-5">
        <Link href="/products/docs" className="btn btn-secondary min-h-11 px-3 text-sm">
          全部文档
        </Link>
        <span className="text-xs text-[var(--muted)]">{saveLabel}</span>
        {docId === DOCS_LOCAL_ID && loggedIn ? (
          <button
            type="button"
            className="btn btn-primary min-h-11 px-3 text-sm"
            onClick={() => void saveToCloud()}
          >
            保存到云端
          </button>
        ) : null}
        {docId === DOCS_LOCAL_ID && !loggedIn ? (
          <Link
            href="/login?next=/products/docs/local"
            className="btn btn-primary min-h-11 px-3 text-sm"
          >
            登录后存到云端
          </Link>
        ) : null}
        {docId !== DOCS_LOCAL_ID ? (
          <button
            type="button"
            className="btn btn-secondary min-h-11 px-3 text-sm"
            onClick={() => void removeCloudDoc()}
          >
            删除
          </button>
        ) : null}
      </div>

      <label className="block border-b border-[var(--line)] px-3 py-3 sm:px-5">
        <span className="sr-only">文档标题</span>
        <input
          className="w-full bg-transparent text-xl font-semibold text-[var(--ink)] outline-none sm:text-2xl"
          value={title}
          maxLength={DOCS_TITLE_MAX_CHARS}
          onChange={(e) => {
            setTitle(e.target.value.slice(0, DOCS_TITLE_MAX_CHARS));
            setSaveState("dirty");
          }}
          placeholder="文档标题"
        />
      </label>

      <div className="docs-toolbar">
        <label className="sr-only" htmlFor="docs-heading">
          段落样式
        </label>
        <select
          id="docs-heading"
          className="field min-h-11 min-w-[7.5rem] rounded-xl px-3 text-sm"
          value={headingValue(editor)}
          onChange={(e) => {
            const level = Number(e.target.value);
            if (!editor) return;
            if (!level) editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
          }}
        >
          <option value="0">正文</option>
          <option value="1">标题 1</option>
          <option value="2">标题 2</option>
          <option value="3">标题 3</option>
          <option value="4">标题 4</option>
          <option value="5">标题 5</option>
          <option value="6">标题 6</option>
        </select>
        <button
          type="button"
          className={`btn min-h-11 px-3 text-sm ${
            editor?.isActive("bold") ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => run((current) => current.chain().toggleBold().run())}
        >
          加粗
        </button>
        <button
          type="button"
          className={`btn min-h-11 px-3 text-sm ${
            editor?.isActive("bulletList") ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => run((current) => current.chain().toggleBulletList().run())}
        >
          项目符号
        </button>
        <button
          type="button"
          className={`btn min-h-11 px-3 text-sm ${
            editor?.isActive("orderedList") ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => run((current) => current.chain().toggleOrderedList().run())}
        >
          项目编号
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => run((current) => current.chain().liftListItem("listItem").run())}
        >
          升级
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => run((current) => current.chain().sinkListItem("listItem").run())}
        >
          降级
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() => imageInputRef.current?.click()}
        >
          插图
        </button>
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-3 text-sm"
          onClick={() =>
            run((current) =>
              current.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
            )
          }
        >
          表格
        </button>
        <button
          type="button"
          className={`btn min-h-11 px-3 text-sm ${schemeOpen ? "btn-primary" : "btn-secondary"}`}
          aria-pressed={schemeOpen}
          onClick={() => setSchemeOpen((open) => !open)}
        >
          编号样式
        </button>
        {inTable ? (
          <>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => run((current) => current.chain().addRowAfter().run())}
            >
              加行
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => run((current) => current.chain().addColumnAfter().run())}
            >
              加列
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => run((current) => current.chain().deleteRow().run())}
            >
              删行
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => run((current) => current.chain().deleteColumn().run())}
            >
              删列
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => run((current) => current.chain().deleteTable().run())}
            >
              删表
            </button>
          </>
        ) : null}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onPickImage(file);
          }}
        />
      </div>

      {schemeOpen ? (
        <DocsSchemePanel scheme={scheme} onChange={markDirtyScheme} />
      ) : null}

      {saveError ? (
        <p className="px-4 py-2 text-sm text-[var(--fire)]">{saveError}</p>
      ) : null}

      <style>{schemeCss}</style>
      <EditorContent editor={editor} />
    </div>
  );
}
