# Typografie — MOO Immobilien

Extrahiert aus der Live-Website (Stand 06.09.2026).

## Was die Website tatsächlich einsetzt

| Rolle | Schrift | Nachweis |
|---|---|---|
| Headlines (h1–h6 im Header) | **Qwitcher Grypen**, 89px, `#575756` | `font-family:'Qwitcher Grypen',Helvetica,Arial,Lucida,sans-serif` |
| Fließtext, Subheads | **Tahoma** (selbst gehostet als `Tahoma_R`) | `@font-face{font-family:"Tahoma_R";src:url(".../tahoma_M.ttf")}` |

Qwitcher Grypen ist eine kalligrafische Schreibschrift und liegt bei Google Fonts.
Tahoma ist ein Systemfont — auf der Site als TTF selbst ausgeliefert, damit auch Linux-Browser
ihn bekommen. Keine der beiden steht auf der Banned-Liste.

## Font-Stack fürs Video

```css
:root {
  /* Signatur — nur für Akzentmomente, siehe Regeln unten */
  --font-signature: "Qwitcher Grypen", cursive;

  /* Arbeitspferd — Tahoma zuerst (die echte Markenschrift),
     Archivo als Web-/Cross-Platform-Ersatz mit fast gleicher Anmutung */
  --font-body: "Tahoma", "Archivo", "Segoe UI", system-ui, sans-serif;

  /* Zahlen — Preise, Flächen, Renditen. Tabellarisch, damit nichts springt */
  --font-mono: "IBM Plex Mono", ui-monospace, "Cascadia Mono", monospace;
}
```

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Qwitcher+Grypen:wght@400;700&family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
```

> ⚠️ **Zwei Entscheidungen, die du überstimmen kannst:**
>
> 1. **Archivo als Body-Fallback.** Tahoma liegt nicht bei Google Fonts — in claude.ai/design
>    und auf fremden Rendermaschinen ist er nicht da. Archivo ist der nächste Verwandte
>    (humanistisch, weite Punzen, gleiche Laufweite) und trägt bei Videogrößen deutlich besser.
>    Wenn du strikt bei Tahoma bleiben willst: `--font-body: "Tahoma", sans-serif` und die
>    TTF von der Website mit ins Projekt legen.
> 2. **IBM Plex Mono für Zahlen.** Die Website hat keinen eigenen Zahlenfont. Bei Immobilien
>    laufen aber ständig Preise, m² und Renditen durchs Bild — proportionale Ziffern springen
>    beim Hochzählen in der Breite. Wenn du keine Mono willst: `font-variant-numeric: tabular-nums`
>    auf Archivo setzen, das löst das Springen auch.

## Skala (1920×1080 Basis)

| Element | Schrift | Größe | Line-Height | Tracking |
|---|---|---|---|---|
| Signatur-Statement | Qwitcher Grypen | 120px | 1.0 | 0 |
| Headline | Archivo 600 | 60px | 1.1 | -0.015em |
| Subhead | Archivo 400 | 36px | 1.3 | 0 |
| Lower-Third Name | Archivo 600 | 44px | 1.15 | -0.01em |
| Lower-Third Rolle | Archivo 400 | 26px | 1.3 | 0.01em |
| Untertitel | Archivo 500 | 42px | 1.25 | 0 |
| Objektdaten / Preis | IBM Plex Mono 600 | 52px | 1.1 | -0.01em |
| Label / Achse | Archivo 400 | 24px | 1.4 | 0.02em |

Für 1080×1920 (Shorts) alle Werte ×1.35.

## Regeln

- **Qwitcher Grypen ist keine Lesefont.** Sie ist die Signatur der Marke — genau ein Einsatz
  pro Video: der Titel, ein einzelnes Schlüsselwort oder der Abbinder. Nie für Untertitel,
  nie für Fließtext, nie für Objektdaten, nie zwei Mal im selben Bild.
- **Qwitcher Grypen erst ab 90px.** Darunter zerfallen die Haarstriche in der
  H.264-Kompression zu Matsch.
- **Untertitel immer Archivo**, niemals die Signaturschrift.
- **Maximal zwei Schriftgrößen pro Bild.** Signatur + Body zählt schon als zwei.
- **Zahlen immer Mono oder `tabular-nums`** — sonst wackelt die Preisanzeige beim Zählen.
- Tracking bei großen Sans-Größen leicht negativ, bei kleinen Labels leicht positiv.
  Qwitcher Grypen **nie** tracken — die Schrift ist auf ihre Ligaturen hin gezeichnet.

## Banned Fonts

Nicht verwenden — auch nicht als Fallback im Stack:

Inter · Roboto · Open Sans · Lato · Poppins · Outfit · Sora · Fraunces ·
Playfair Display · Cormorant Garamond · Syne · Cinzel · Nunito · Source Sans ·
PT Sans · Arimo

> Hinweis: Die Website lädt an einer Stelle Divi's Default **Open Sans** — das ist eine
> Theme-Voreinstellung, kein Markenentscheid, und wird hier bewusst nicht übernommen.
