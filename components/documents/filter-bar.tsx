"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOC_STATUS_LABEL, SENSITIVITY_LABEL } from "@/lib/utils";

type Option = { id: string; name: string };

export function FilterBar({
  authors,
  departments,
}: {
  authors: Option[];
  departments: Option[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`?${next.toString()}`);
  }

  return (
    <form className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-6" onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-1">
        <Label>Auteur</Label>
        <Select defaultValue={params.get("author") ?? "all"} onValueChange={(v) => update("author", v)}>
          <SelectTrigger aria-label="Filtrer par auteur">
            <SelectValue placeholder="Tous" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {authors.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Statut</Label>
        <Select defaultValue={params.get("status") ?? "all"} onValueChange={(v) => update("status", v)}>
          <SelectTrigger aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {Object.entries(DOC_STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Département</Label>
        <Select defaultValue={params.get("department") ?? "all"} onValueChange={(v) => update("department", v)}>
          <SelectTrigger aria-label="Filtrer par département">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Confidentialité</Label>
        <Select defaultValue={params.get("sensitivity") ?? "all"} onValueChange={(v) => update("sensitivity", v)}>
          <SelectTrigger aria-label="Filtrer par confidentialité">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {Object.entries(SENSITIVITY_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="from">Du</Label>
        <Input id="from" type="date" defaultValue={params.get("from") ?? ""} onChange={(e) => update("from", e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to">Au</Label>
        <Input id="to" type="date" defaultValue={params.get("to") ?? ""} onChange={(e) => update("to", e.target.value)} />
      </div>
    </form>
  );
}
