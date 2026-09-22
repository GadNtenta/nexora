"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bold,
  Eye,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Pencil,
  Redo2,
  Save,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WatermarkOverlay } from "@/components/documents/secure-viewer";
import { cn } from "@/lib/utils";

function isBlankHtml(html: string) {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;
}

function ToolButton({
  label,
  pressed,
  onClick,
  disabled,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "secondary" : "ghost"}
      size="icon"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className="h-11 w-11"
    >
      {children}
    </Button>
  );
}

function EditorToolbar({
  editor,
  saving,
  onSave,
  onCancel,
}: {
  editor: Editor;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-card px-2 py-2">
      <ToolButton
        label="Gras"
        pressed={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </ToolButton>
      <ToolButton
        label="Italique"
        pressed={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </ToolButton>
      <ToolButton
        label="Souligné"
        pressed={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon />
      </ToolButton>
      <ToolButton
        label="Titre 1"
        pressed={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 />
      </ToolButton>
      <ToolButton
        label="Titre 2"
        pressed={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 />
      </ToolButton>
      <ToolButton
        label="Liste à puces"
        pressed={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List />
      </ToolButton>
      <ToolButton
        label="Liste numérotée"
        pressed={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolButton>
      <ToolButton label="Annuler" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 />
      </ToolButton>
      <ToolButton label="Rétablir" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 />
      </ToolButton>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Annuler
        </Button>
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {saving ? "Enregistrement…" : "Enregistrer une version"}
        </Button>
      </div>
    </div>
  );
}

function WordEditor({
  initialHtml,
  saving,
  onSave,
  onCancel,
}: {
  initialHtml: string;
  saving: boolean;
  onSave: (html: string) => void;
  onCancel: () => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Placeholder.configure({ placeholder: "Saisissez votre document…" }),
    ],
    content: initialHtml || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "office-editor-content",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Contenu du document Word",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!saving && editor) onSave(editor.getHTML());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, onSave, saving]);

  if (!editor) {
    return <Skeleton className="min-h-[60vh] w-full rounded-none" />;
  }

  return (
    <div>
      <EditorToolbar
        editor={editor}
        saving={saving}
        onSave={() => onSave(editor.getHTML())}
        onCancel={onCancel}
      />
      <div className="document-workspace px-3 py-8 sm:px-8">
        <div className="mx-auto min-h-[60vh] max-w-3xl rounded-sm bg-white px-8 py-10 shadow-md">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

export function OfficeWorkspace({
  documentId,
  title,
  watermark,
  canEdit,
  locked,
}: {
  documentId: string;
  title: string;
  watermark: string;
  canEdit: boolean;
  locked: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [html, setHtml] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`/api/documents/${documentId}/office`);
      const data = (await res.json()) as { html?: string; legacy?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Lecture impossible");
      setHtml(data.html || "<p></p>");
      setLegacy(Boolean(data.legacy));
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lecture impossible");
      setStatus("error");
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  async function save(nextHtml: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/office`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: nextHtml }),
      });
      const data = (await res.json()) as { error?: string; version?: string };
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible");
      setHtml(nextHtml);
      setLegacy(false);
      setMode("view");
      toast.success(`Version ${data.version ?? ""} enregistrée`.trim());
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Enregistrement impossible";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <p className="text-sm font-medium">Document Word</p>
          <p className="text-xs text-muted-foreground">
            {legacy
              ? "Fichier .doc : l’enregistrement crée une version .docx."
              : "L’enregistrement crée une nouvelle version, sans écraser l’historique."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "edit" ? (
            <Button type="button" variant="outline" onClick={() => setMode("view")} disabled={saving}>
              <Eye />
              Aperçu
            </Button>
          ) : canEdit ? (
            <Button type="button" onClick={() => setMode("edit")} disabled={status !== "ready"}>
              <Pencil />
              Éditer
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              {locked ? "Édition bloquée pendant la revue." : "Lecture seule."}
            </p>
          )}
        </div>
      </div>

      {status === "loading" ? (
        <div className="space-y-3 p-6" aria-busy="true" aria-live="polite">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-[48vh] w-full" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="space-y-3 p-6" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setReloadKey((n) => n + 1)}>
              Réessayer
            </Button>
            <Button asChild variant="secondary">
              <a href={`/api/files/${documentId}?download=1`}>Télécharger {title}</a>
            </Button>
          </div>
        </div>
      ) : null}

      {status === "ready" && mode === "edit" && canEdit ? (
        <WordEditor
          initialHtml={html}
          saving={saving}
          onSave={(next) => void save(next)}
          onCancel={() => setMode("view")}
        />
      ) : null}

      {status === "ready" && mode === "view" ? (
        <div className="document-workspace relative px-3 py-8 sm:px-8">
          <div className="relative mx-auto min-h-[60vh] max-w-3xl overflow-hidden rounded-sm bg-white px-8 py-10 shadow-md">
            {isBlankHtml(html) ? (
              <p className="text-sm text-muted-foreground">Document vide. {canEdit ? "Cliquez sur Éditer pour rédiger." : ""}</p>
            ) : (
              <article
                className={cn("office-preview")}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )}
            <WatermarkOverlay text={watermark} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
