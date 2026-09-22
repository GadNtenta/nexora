"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { instantSearchAction } from "@/app/actions/search";
import type { SearchHit } from "@/lib/search/fts";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("docushield:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("docushield:search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      start(async () => {
        try {
          setHits(await instantSearchAction(query));
        } catch {
          setHits([]);
        }
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Rechercher dans les titres et le contenu…"
        aria-label="Recherche universelle"
      />
      <CommandList>
        <CommandEmpty>
          {pending ? "Recherche…" : query.trim().length < 2 ? "Tapez au moins 2 caractères." : "Aucun résultat."}
        </CommandEmpty>
        <CommandGroup heading="Documents">
          {hits.map((hit) => (
            <CommandItem
              key={hit.id}
              value={hit.id}
              onSelect={() => {
                setOpen(false);
                router.push(`/documents/${hit.id}`);
              }}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{hit.title}</span>
                <span className="text-xs text-muted-foreground">Dossier : {hit.folderName}</span>
                <span
                  className="line-clamp-2 text-xs"
                  dangerouslySetInnerHTML={{ __html: hit.snippet }}
                />
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
