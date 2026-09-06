---
name: moo-immobilien-design
description: Brand-System von MOO Immobilien (Wien, Luxusimmobilien) — warme Greige-Palette, Salbei-Akzent, Qwitcher-Grypen-Signatur, Sie-Ansprache. Nutze diesen Skill bei jedem Design, Mockup, Motion-Graphic, Video-Overlay, Exposé, Slide, Landing-Page oder Chart für MOO Immobilien, damit Farben, Schriften, Layout und Sprache konsistent zur Marke passen.
---

# MOO Immobilien — Design System

Wien. Vermittlung exklusiver Objekte und Luxusimmobilien. Claim:
*„Wir vermitteln hohe Ansprüche…"*

Alle Werte unten sind aus der Live-Website extrahiert (Stand 06.09.2026), nicht geschätzt.

## Farb-Tokens

```css
:root {
  --bg:           #eae9e4;  /* warmes Greige — die Grundfläche der Marke */
  --ink:          #575756;  /* warmes Dunkelgrau — Primärtext */
  --accent:       #9c9c8c;  /* Salbei-Oliv — Flächen, Formen, Akzentbalken */
  --accent-deep:  #6B6B58;  /* derselbe Ton als Textfarbe auf hellem Grund */
  --line:         #cbcac6;  /* Trennlinien, Rahmen */
  --border-soft:  #a9aaaa;  /* Outline-Buttons */
  --ground:       #2B2B27;  /* dunkler Grund für Plates und Nachtszenen */
}
```

**Hell ist der Default.** Die Marke ist zu ~90% `--bg` mit grauer Schrift. Zurückhaltend.

**Kritische Regel:** `--accent` (`#9c9c8c`) hat auf `--bg` nur **2.6:1** — das ist
**keine Textfarbe**. Für Text auf hellem Grund `--accent-deep` (5.0:1). Auf `--ground`
darf `--accent` selbst als Text stehen (5.1:1).

Weitere Kontraste: `--ink` auf `--bg` = 6.7:1 · `--bg` auf `--ground` = 13.2:1.

Ein Akzent pro Bild. Nie reines `#000` oder `#FFF` — beides clippt in der Video-Kompression
und bricht den warmen Grundton.

## Schriften

```css
--font-signature: "Qwitcher Grypen", cursive;                       /* 400, 700 */
--font-body:      "Tahoma", "Archivo", "Segoe UI", system-ui, sans-serif;  /* 400, 500, 600 */
--font-mono:      "IBM Plex Mono", ui-monospace, monospace;         /* 400, 600 */
```

```
https://fonts.googleapis.com/css2?family=Qwitcher+Grypen:wght@400;700&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap
```

**Qwitcher Grypen** ist die echte Headline-Schrift der Website (dort 89px). Kalligrafisch —
genau **ein** Einsatz pro Layout: Titel, ein Schlüsselwort oder der Abbinder. Nie für
Fließtext, nie für Untertitel, nie für Objektdaten, nie zwei Mal im selben Bild.
**Erst ab 90px** — darunter zerfallen die Haarstriche.

**Tahoma** ist die Body-Schrift der Website (dort selbst gehostet). Liegt nicht bei Google
Fonts, deshalb **Archivo** als Ersatz im Stack — humanistisch, weite Punzen, fast gleiche
Anmutung, trägt bei Videogrößen besser.

**Niemals verwenden:** Inter, Roboto, Open Sans, Lato, Poppins, Outfit, Sora, Fraunces,
Playfair Display, Cormorant Garamond, Syne, Cinzel, Nunito, Source Sans, PT Sans, Arimo.
(Die Website lädt an einer Stelle Divi's Default Open Sans — Theme-Voreinstellung,
kein Markenentscheid, wird nicht übernommen.)

## Typo-Skala (1920×1080)

Signatur-Statement 120/1.0 (Qwitcher) · Headline 60/1.1 (Archivo 600) · Subhead 36/1.3 ·
Lower-Third-Name 44/1.15 (600) · Rolle 26/1.3 · Untertitel 42/1.25 (500) ·
Objektdaten/Preis 52/1.1 (IBM Plex Mono 600) · Label 24/1.4.
Für 1080×1920 alles ×1.35. Maximal zwei Schriftgrößen pro Bild.
Zahlen immer Mono oder `tabular-nums` — sonst springt die Preisanzeige beim Zählen.

## Layout-Muster

- **Untertitel:** über Videomaterial `--ground` bei 72% als Plate, Text in `--bg`.
  Auf Vollflächen `--ink` auf `--bg`, ohne Plate.
- **Lower-Third:** Fläche `--bg`, Name in `--ink`, Rolle in `--accent-deep`,
  1px Trennlinie in `--line`. Rollenbezeichnung wie auf der Site: „Real Estate Agent".
  Akademischen Grad mitführen (`Alexander Ochs, MBA`).
- **Charts:** Primärserie `--accent`, Sekundärserie `--accent` bei 45%,
  Achsen und Grid `--line`, Werte-Labels `--ink`.
- **Logo:** monochrom, Wortmarke `#626262`, transparenter Hintergrund — nicht einfärben,
  nicht verzerren. Schutzraum ringsum eine Logo-Höhe. Auf unruhigem Videomaterial
  nur mit Plate.

## Motion

- Reveals `power3.out` · Loops `sine.inOut` · Exits `power2.in` · Akzent `back.out(1.4)`
- **`linear` ist verboten.** Mindestens 3 verschiedene Easings pro Szene.
- Text-Reveal 400–600ms · Stagger 60–90ms · Szenen-Transition 400–700ms
- Animationen landen **mit** dem Anchor-Word, Toleranz ±100ms.
- Clip-Path-Reveals für Headlines, Opacity-Fades für Sekundärtext.
- Die Marke ist zurückhaltend — Bewegung darf nicht lauter sein als die Marke.
  Keine Elemente, die ohne Grund wackeln, pulsieren oder rotieren.

## Sprache

**Wir siezen** — durchgängig, ohne Ausnahme. Österreichisches Deutsch.
Beziehung vor Transaktion: der Ton ist der eines Beraters, der zuhört, nicht eines
Verkäufers, der abschließt. Zurückhaltend, aber nicht bescheiden.
Gendern mit Doppelpunkt (`Kund:innen`), wie auf der Website.

Grundwerte: **Offenheit · Diskretion · Verlässlichkeit.** Diskretion heißt konkret:
keine Objektadressen, keine Kaufpreise realer Abschlüsse, keine Kundennamen ohne
ausdrückliche Freigabe.

Marken-Formulierungen: *„Wir vermitteln hohe Ansprüche…"* (Claim) ·
*„Relationships-Business"* · *„Full-Market-Zugang"* · *„I[MOO]bilie"* (Wortspiel, sparsam —
einmal pro Video, es trägt nicht zwei Mal).

**On-Screen:** Headlines max. 6 Wörter · keine Satzzeichen am Ende von Labels ·
Preise mit Tausenderpunkt (`1.450.000 €`), Flächen mit geschütztem Leerzeichen (`142 m²`) ·
keine Ausrufezeichen · keine Superlative · kein Verkaufsdruck · keine Renditeprognosen.
