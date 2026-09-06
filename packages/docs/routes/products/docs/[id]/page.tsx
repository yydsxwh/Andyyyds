import { notFound, redirect } from "next/navigation";
import { DocsEditor } from "@andyyyds/docs/components/docs-editor";
import { DOCS_LOCAL_ID } from "@andyyyds/docs/lib/docs-content";
import { emptyLocalDocument } from "@andyyyds/docs/lib/docs-local";
import { DocsNotFoundError, getDocsDocument } from "@andyyyds/docs/lib/docs-store";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@andyyyds/shared/auth";

export default async function DocsEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  if (id === DOCS_LOCAL_ID) {
    return (
      <NavPageTemplateShell type="products">
        <div className="container py-6 sm:py-10">
          <DocsEditor initial={emptyLocalDocument()} loggedIn={Boolean(session)} />
        </div>
      </NavPageTemplateShell>
    );
  }

  if (!session) {
    redirect(`/login?next=/products/docs/${encodeURIComponent(id)}`);
  }

  try {
    const doc = await getDocsDocument(session.id, id);
    return (
      <NavPageTemplateShell type="products">
        <div className="container py-6 sm:py-10">
          <DocsEditor initial={doc} loggedIn />
        </div>
      </NavPageTemplateShell>
    );
  } catch (error) {
    if (error instanceof DocsNotFoundError) notFound();
    throw error;
  }
}
