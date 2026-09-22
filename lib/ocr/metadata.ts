const DATE_RE =
  /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+\d{4})\b/i;

const TITLE_STOP = new Set(["le", "la", "les", "un", "une", "des", "de", "du", "et", "ou"]);

export function suggestTitle(text: string, fallback: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 8 && l.length <= 120);

  const scored = lines.slice(0, 20).map((line) => {
    const words = line.split(/\s+/);
    const caps = words.filter((w) => /^[A-ZÉÈÀÙÂÊÎÔÛÄËÏÖÜ]/.test(w)).length;
    const stop = words.filter((w) => TITLE_STOP.has(w.toLowerCase())).length;
    return { line, score: caps * 2 - stop + (words.length >= 3 && words.length <= 12 ? 3 : 0) };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best && best.score > 0) return best.line.replace(/\s+/g, " ");
  return fallback.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
}

export function detectDocumentDate(text: string): Date | null {
  const match = text.match(DATE_RE);
  if (!match) return null;
  const raw = match[1];
  const months: Record<string, number> = {
    janvier: 0,
    février: 1,
    fevrier: 1,
    mars: 2,
    avril: 3,
    mai: 4,
    juin: 5,
    juillet: 6,
    août: 7,
    aout: 7,
    septembre: 8,
    octobre: 9,
    novembre: 10,
    décembre: 11,
    decembre: 11,
  };

  const named = raw.match(/^(\d{1,2})\s+([a-zéûô]+)\s+(\d{4})$/i);
  if (named) {
    const month = months[named[2].toLowerCase()];
    if (month === undefined) return null;
    const d = new Date(Date.UTC(Number(named[3]), month, Number(named[1])));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const parts = raw.split(/[/-]/).map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  let year: number;
  let month: number;
  let day: number;
  if (parts[0] > 31) {
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else {
    day = parts[0];
    month = parts[1];
    year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function suggestTags(text: string): string[] {
  const keywords = [
    "facture",
    "contrat",
    "rapport",
    "procès-verbal",
    "pv",
    "confidentiel",
    "devis",
    "attestation",
    "note",
  ];
  const lower = text.toLowerCase();
  return keywords.filter((k) => lower.includes(k)).slice(0, 4);
}
