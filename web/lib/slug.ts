const UMLAUT_MAP: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUT_MAP[c] ?? c)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
}

// CON/NUL/COM1.. are unusable as Windows folder names -- raw/<slug>/ is a
// literal Windows folder, so these can't be allowed even though Postgres
// and the URL router wouldn't otherwise care.
const WINDOWS_RESERVED = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

const APP_RESERVED = new Set([
  "login",
  "api",
  "projects",
  "new",
  "dashboard",
  "_next",
  "favicon.ico",
  "static",
  "assets",
  "public",
  "admin",
  "settings",
  "auth",
  "callback",
  "robots.txt",
  "sitemap.xml",
]);

export function isReservedSlug(slug: string): boolean {
  return slug.length === 0 || WINDOWS_RESERVED.has(slug) || APP_RESERVED.has(slug);
}
