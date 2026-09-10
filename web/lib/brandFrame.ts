export type BrandColor = { name: string; hex: string };
export type BrandFont = { name: string; stack: string; family: string | null };

const CSS_PROP_RE = /--([a-zA-Z][\w-]*)\s*:\s*(#[0-9a-fA-F]{3,8})/g;
const TABLE_ROW_RE = /`--([a-zA-Z][\w-]*)`\s*\|\s*`?(#[0-9a-fA-F]{3,8})`?/g;
const FONT_PROP_RE = /--(font-[\w-]*)\s*:\s*([^;\n]+);/g;
const GOOGLE_FONTS_URL_RE = /https:\/\/fonts\.googleapis\.com\/css2?\?[^\s)"'`]+/;

// Nimmt das erste in Anfuehrungszeichen stehende Wort aus einem Font-Stack
// ("Qwitcher Grypen", cursive -> Qwitcher Grypen) fuer die Live-Vorschau.
function firstFamily(stack: string): string | null {
  const match = stack.match(/["']([^"']+)["']/);
  return match ? match[1] : null;
}

export function parseBrandColors(content: string): BrandColor[] {
  const byName = new Map<string, string>();

  for (const re of [CSS_PROP_RE, TABLE_ROW_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
      const [, name, hex] = m;
      if (!byName.has(name)) byName.set(name, hex);
    }
  }

  return Array.from(byName, ([name, hex]) => ({ name, hex }));
}

export function parseBrandFonts(content: string): BrandFont[] {
  const byName = new Map<string, string>();
  FONT_PROP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FONT_PROP_RE.exec(content))) {
    const [, name, stack] = m;
    if (!byName.has(name)) byName.set(name, stack.trim());
  }

  return Array.from(byName, ([name, stack]) => ({ name, stack, family: firstFamily(stack) }));
}

export function parseGoogleFontsUrl(content: string): string | null {
  return content.match(GOOGLE_FONTS_URL_RE)?.[0] ?? null;
}
