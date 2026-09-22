"use server";

import { searchDocuments } from "@/lib/search/fts";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { loadFolderGraph, getDocumentForAuth } from "@/lib/data";

export async function instantSearchAction(query: string) {
  const session = await requireSession();
  const hits = await searchDocuments({ tenantId: session.tenantId, query, limit: 8 });
  const folders = await loadFolderGraph(session.tenantId);
  const visible = [];
  for (const hit of hits) {
    const document = await getDocumentForAuth(hit.id, session.tenantId);
    if (document && can({ session, action: "VIEW", document, folders })) {
      visible.push(hit);
    }
  }
  return visible;
}
