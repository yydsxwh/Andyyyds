import { prisma } from "@andyyyds/shared/db";
import {
  clampDocsTitle,
  DOCS_MAX_PER_USER,
  emptyDocsContent,
  parseStoredDocument,
  serializeDocsContent,
  type DocsDocumentPayload,
  type DocsJsonNode,
} from "@andyyyds/docs/lib/docs-content";
import {
  DEFAULT_DOCS_LIST_SCHEME,
  normalizeListScheme,
  type DocsListScheme,
} from "@andyyyds/docs/lib/docs-scheme";

export class DocsLimitError extends Error {
  constructor() {
    super(`最多保存 ${DOCS_MAX_PER_USER} 篇文档，请先删除不用的`);
    this.name = "DocsLimitError";
  }
}

export class DocsNotFoundError extends Error {
  constructor() {
    super("文档不存在或已删除");
    this.name = "DocsNotFoundError";
  }
}

export async function listDocsDocuments(userId: string): Promise<DocsDocumentPayload[]> {
  const rows = await prisma.docsDocument.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: DOCS_MAX_PER_USER,
  });
  return rows.map(parseStoredDocument);
}

export async function getDocsDocument(
  userId: string,
  id: string,
): Promise<DocsDocumentPayload> {
  const row = await prisma.docsDocument.findFirst({
    where: { id, userId },
  });
  if (!row) throw new DocsNotFoundError();
  return parseStoredDocument(row);
}

export async function createDocsDocument(
  userId: string,
  input?: {
    title?: string;
    content?: DocsJsonNode;
    listScheme?: DocsListScheme;
  },
): Promise<DocsDocumentPayload> {
  const count = await prisma.docsDocument.count({ where: { userId } });
  if (count >= DOCS_MAX_PER_USER) throw new DocsLimitError();

  const content = input?.content ? input.content : emptyDocsContent();
  const row = await prisma.docsDocument.create({
    data: {
      userId,
      title: clampDocsTitle(input?.title),
      content: serializeDocsContent(content),
      listScheme: JSON.stringify(
        normalizeListScheme(input?.listScheme || DEFAULT_DOCS_LIST_SCHEME),
      ),
    },
  });
  return parseStoredDocument(row);
}

export async function updateDocsDocument(
  userId: string,
  id: string,
  input: {
    title?: string;
    content?: DocsJsonNode;
    listScheme?: DocsListScheme;
  },
): Promise<DocsDocumentPayload> {
  const existing = await prisma.docsDocument.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) throw new DocsNotFoundError();

  const data: { title?: string; content?: string; listScheme?: string } = {};
  if (input.title !== undefined) data.title = clampDocsTitle(input.title);
  if (input.content !== undefined) data.content = serializeDocsContent(input.content);
  if (input.listScheme !== undefined) {
    data.listScheme = JSON.stringify(normalizeListScheme(input.listScheme));
  }

  const row = await prisma.docsDocument.update({
    where: { id },
    data,
  });
  return parseStoredDocument(row);
}

export async function deleteDocsDocument(userId: string, id: string): Promise<void> {
  const result = await prisma.docsDocument.deleteMany({
    where: { id, userId },
  });
  if (result.count === 0) throw new DocsNotFoundError();
}
