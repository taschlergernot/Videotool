export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// Rundet auf einen bekannten Standard-Aspect (9:16, 16:9, 1:1, 4:5, 4:3), sonst
// wird das rohe Verhaeltnis gezeigt -- reicht fuer die paar Formate, die hier
// tatsaechlich vorkommen (CLAUDE.md-Default 9:16, Quellmaterial oft 16:9).
const KNOWN_RATIOS: { label: string; value: number }[] = [
  { label: "9:16", value: 9 / 16 },
  { label: "16:9", value: 16 / 9 },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "4:3", value: 4 / 3 },
];

export function formatDimensions(width: number | null, height: number | null): string {
  if (!width || !height) return "—";
  const ratio = width / height;
  const known = KNOWN_RATIOS.find((r) => Math.abs(r.value - ratio) < 0.02);
  return known ? `${width}×${height} (${known.label})` : `${width}×${height}`;
}
