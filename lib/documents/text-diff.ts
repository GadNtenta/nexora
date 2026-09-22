import { diffWords } from "diff";

export type DiffSegment = {
  type: "equal" | "add" | "remove";
  value: string;
};

export type TextDiffResult = {
  segments: DiffSegment[];
  addedWords: number;
  removedWords: number;
  identical: boolean;
};

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

export function diffPlainText(fromText: string, toText: string): TextDiffResult {
  const from = fromText.replace(/\r\n/g, "\n");
  const to = toText.replace(/\r\n/g, "\n");
  if (from === to) {
    return { segments: from ? [{ type: "equal", value: from }] : [], addedWords: 0, removedWords: 0, identical: true };
  }

  const parts = diffWords(from, to);
  const segments: DiffSegment[] = parts.map((part) => ({
    type: part.added ? "add" : part.removed ? "remove" : "equal",
    value: part.value,
  }));

  return {
    segments,
    addedWords: segments.filter((s) => s.type === "add").reduce((sum, s) => sum + wordCount(s.value), 0),
    removedWords: segments.filter((s) => s.type === "remove").reduce((sum, s) => sum + wordCount(s.value), 0),
    identical: false,
  };
}
