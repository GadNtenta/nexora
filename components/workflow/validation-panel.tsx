"use client";

import { useState } from "react";
import { decideValidationAction, submitValidationAction } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

type Validator = { id: string; fullName: string; email: string };
type Request = {
  id: string;
  status: string;
  comment: string | null;
  assignee: { fullName: string };
};

export function ValidationPanel({
  documentId,
  locked,
  canSubmit,
  canDecide,
  validators,
  pending,
}: {
  documentId: string;
  locked: boolean;
  canSubmit: boolean;
  canDecide: boolean;
  validators: Validator[];
  pending: Request | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState(validators[0]?.id ?? "");

  return (
    <div className="space-y-5">
      {locked ? (
        <Alert>
          <AlertDescription>
            Document verrouillé en lecture seule jusqu&apos;à la décision du validateur
            {pending ? ` (${pending.assignee.fullName})` : ""}.
          </AlertDescription>
        </Alert>
      ) : null}

      {canSubmit && !locked ? (
        <form
          className="space-y-3 rounded-xl bg-muted/40 p-4"
          action={async (formData) => {
            try {
              setError(null);
              await submitValidationAction(formData);
              toast.success("Document soumis au validateur.");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Soumission impossible");
            }
          }}
        >
          <div>
            <p className="text-sm font-medium">Soumettre pour validation</p>
            <p className="mt-1 text-sm text-muted-foreground">Le document sera verrouillé jusqu’à la décision.</p>
          </div>
          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="assigneeId" value={assigneeId} />
          <div className="space-y-1">
            <Label>Validateur assigné</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId} required>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un validateur" />
              </SelectTrigger>
              <SelectContent>
                {validators.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={!validators.length}>
            Soumettre pour validation
          </Button>
        </form>
      ) : null}

      {canDecide && pending ? (
        <form
          className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4"
          action={async (formData) => {
            try {
              setError(null);
              await decideValidationAction(formData);
              toast.success("Décision enregistrée.");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Décision impossible");
            }
          }}
        >
          <p className="text-sm font-medium">Décision à prendre</p>
          <input type="hidden" name="requestId" value={pending.id} />
          <div className="space-y-1">
            <Label htmlFor="comment">Commentaire (obligatoire si rejet)</Label>
            <Textarea id="comment" name="comment" placeholder="Motif du rejet ou note de validation" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="decision" value="APPROVED">
              Valider
            </Button>
            <Button type="submit" name="decision" value="REJECTED" variant="destructive">
              Rejeter
            </Button>
          </div>
        </form>
      ) : null}

      {!canSubmit && !canDecide && !locked ? (
        <p className="rounded-xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
          Aucune action de validation n’est disponible pour votre rôle.
        </p>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
