const FRENCH_STOPWORDS = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "et",
  "ou",
  "en",
  "au",
  "aux",
  "ce",
  "cet",
  "cette",
  "ces",
  "dans",
  "pour",
  "par",
  "sur",
  "avec",
]);

export function sanitizeLikeContains(raw: string): string {
  return `%${raw.trim().replace(/[%_]/g, " ")}%`;
}

/** Prefix FTS query: `contrat fact` → `contrat & fact:*` */
export function buildPrefixTsQuery(raw: string): string | null {
  const tokens = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !FRENCH_STOPWORDS.has(token));

  if (!tokens.length) return null;
  return tokens
    .map((token, index) => (index === tokens.length - 1 ? `${token}:*` : token))
    .join(" & ");
}
