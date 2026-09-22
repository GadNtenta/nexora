export function nextVersion(current: string): string {
  const match = current.match(/^v(\d+)\.(\d+)$/);
  if (!match) return "v1.1";
  return `v${match[1]}.${Number(match[2]) + 1}`;
}
