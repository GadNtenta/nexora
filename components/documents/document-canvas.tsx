"use client";

import { isWordMime } from "@/lib/documents/mime";
import { OfficeWorkspace } from "@/components/documents/office-workspace";
import { SecureViewer } from "@/components/documents/secure-viewer";

export function DocumentCanvas({
  documentId,
  mimeType,
  title,
  watermark,
  canEdit,
  locked,
}: {
  documentId: string;
  mimeType: string;
  title: string;
  watermark: string;
  canEdit: boolean;
  locked: boolean;
}) {
  if (isWordMime(mimeType)) {
    return (
      <OfficeWorkspace
        documentId={documentId}
        title={title}
        watermark={watermark}
        canEdit={canEdit}
        locked={locked}
      />
    );
  }

  return (
    <SecureViewer documentId={documentId} mimeType={mimeType} title={title} watermark={watermark} />
  );
}
