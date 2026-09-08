"use client";

import { useRef, useState } from "react";
import {
  PERSON_FILE_KIND_LABEL,
  PERSON_MAX_FILES,
  formatPersonFileSize,
  type PersonEntryFile,
} from "@andyyyds/person/lib/person-files";
import { uploadPersonAdminFile } from "@andyyyds/person/lib/person-site-client";

export function PersonFilesField({
  hint,
  files,
  onChange,
}: {
  hint: string;
  files: PersonEntryFile[];
  onChange: (files: PersonEntryFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onPick = async (picked: File | undefined) => {
    if (!picked) return;
    if (files.length >= PERSON_MAX_FILES) {
      setError(`最多 ${PERSON_MAX_FILES} 个文件`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      onChange([...files, await uploadPersonAdminFile(picked)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-xs text-[var(--muted)]">附件</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>
      <button
        type="button"
        className="btn btn-secondary mt-2 min-h-11 px-3 text-sm"
        disabled={busy || files.length >= PERSON_MAX_FILES}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "上传中…" : "上传文件"}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void onPick(file);
        }}
      />
      <ul className="mt-3 grid gap-2">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-[var(--muted)]">
                {PERSON_FILE_KIND_LABEL[file.kind]}
                {file.size ? ` · ${formatPersonFileSize(file.size)}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3 text-sm"
              onClick={() => onChange(files.filter((item) => item.id !== file.id))}
            >
              移除
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-2 text-sm text-[var(--fire)]">{error}</p> : null}
    </div>
  );
}
