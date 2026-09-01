"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StudioForumSpaceEditor } from "@andyyyds/forum/components/studio-forum-space-editor";
import type {
  StudioForumUniversity,
  StudioForumZone,
} from "@andyyyds/forum/components/studio-forum-panel";

export function StudioForumSpaceEditClient({
  university,
}: {
  university: StudioForumUniversity;
}) {
  const router = useRouter();
  const [uni, setUni] = useState(university);
  const [busy, setBusy] = useState(false);

  async function patchUniversity(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/forum/universities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data.error || "保存失败");
        return false;
      }
      setUni(data.university);
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudioForumSpaceEditor
      uni={uni}
      busy={busy}
      onPatch={patchUniversity}
      onZonesChange={(zones: StudioForumZone[]) =>
        setUni((current) => ({ ...current, zones }))
      }
    />
  );
}
