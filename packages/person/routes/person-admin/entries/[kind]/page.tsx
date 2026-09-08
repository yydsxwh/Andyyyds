import { notFound } from "next/navigation";
import { PersonAdminEntriesPanel } from "@andyyyds/person/components/person-admin-entries-panel";
import { isPersonEntryKind } from "@andyyyds/person/lib/person-site";

export default async function PersonAdminEntriesPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  const normalized = kind.toUpperCase();
  if (!isPersonEntryKind(normalized)) notFound();
  return <PersonAdminEntriesPanel kind={normalized} />;
}
