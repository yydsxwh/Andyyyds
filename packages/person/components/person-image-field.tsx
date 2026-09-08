"use client";

import { useRef, useState } from "react";
import { uploadPersonAdminImage } from "@andyyyds/person/lib/person-site-client";

export function PersonImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadPersonAdminImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="block text-xs text-[var(--muted)]">
      {label}
      <input
        className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="图片地址或点下方上传"
      />
      <button
        type="button"
        className="btn btn-secondary mt-2 min-h-11 px-3 text-sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "上传中…" : "上传图片"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void onPick(file);
        }}
      />
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mt-2 max-h-32 rounded-xl object-cover" />
      ) : null}
      {error ? <p className="mt-1 text-[var(--fire)]">{error}</p> : null}
    </label>
  );
}
