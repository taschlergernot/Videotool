# Farben — MOO Immobilien

Extrahiert aus der Live-Website (www.moo-immobilien.at, Divi-Theme + immomakler-Plugin,
Stand 06.09.2026). Jeder Wert unten steht so im ausgelieferten CSS — nichts geraten.

## Tokens

| Token | Hex | Rolle | Herkunft im Site-CSS |
|---|---|---|---|
| `--bg` | `#eae9e4` | Bildhintergrund, Flächen | `.et_pb_section{background-color:#eae9e4!important}` — jede Section |
| `--ink` | `#575756` | Primärtext, Wortmarke | Headline-Color + Button-Color im Divi-Header |
| `--accent` | `#9c9c8c` | Links, Primary-Buttons, Highlights | `a:link/:visited/:hover`, `.btn-primary`, Focus-Border (35 Fundstellen) |
| `--line` | `#cbcac6` | Trennlinien, Rahmen, Panels | Form- und Panel-Borders im immomakler-Skin |
| `--border-soft` | `#a9aaaa` | Outline-Buttons | `.et_pb_button_one{border-color:#a9aaaa}` |

Zwei Werte, die es für Video zusätzlich braucht — abgeleitet, nicht von der Site:

| Token | Hex | Rolle | Warum |
|---|---|---|---|
| `--accent-deep` | `#6B6B58` | Accent **als Text** auf `--bg` | `--accent` selbst hat nur 2.6:1 → als Text unlesbar. Gleicher Farbton, abgedunkelt auf 5.0:1 |
| `--ground` | `#2B2B27` | Untertitel-Plates, dunkle Szenen | Warmes Fast-Schwarz im Greige-Ton. Kein `#000` — das clippt in H.264 |

## CSS

```css
:root {
  --bg:           #eae9e4;  /* warmes Greige — die Grundfläche der Marke */
  --ink:          #575756;  /* warmes Dunkelgrau */
  --accent:       #9c9c8c;  /* Salbei-Oliv — Flächen, Formen, Akzentbalken */
  --accent-deep:  #6B6B58;  /* derselbe Ton als Textfarbe */
  --line:         #cbcac6;
  --border-soft:  #a9aaaa;
  --ground:       #2B2B27;  /* dunkler Grund für Plates und Nachtszenen */
}
```

## Kontraste (gerechnet, WCAG 2.1)

| Kombination | Ratio | Verwendbar für |
|---|---|---|
| `--ink` auf `--bg` | **6.7 : 1** | Alles. Fließtext, Untertitel, Labels |
| `--accent-deep` auf `--bg` | **5.0 : 1** | Text, auch klein |
| `--accent` auf `--bg` | **2.6 : 1** | ⚠️ **nur Flächen und Formen — niemals Text** |
| `--bg` auf `--ground` | **13.2 : 1** | Untertitel auf Plate, Text in dunklen Szenen |
| `--accent` auf `--ground` | **5.1 : 1** | Text auf dunklem Grund — hier funktioniert der Accent |

**Die wichtigste Regel dieser Palette:** `--accent` (`#9c9c8c`) ist auf hellem Grund
**keine Textfarbe**. Auf `--bg` wird daraus `--accent-deep`; auf `--ground` darf `--accent`
selbst als Text stehen.

## Anwendungsregeln

- **Ein Akzent pro Bild.** Die Marke ist zurückhaltend — die Site ist zu 90% `--bg` mit
  grauer Schrift. Video darf nicht lauter sein als die Marke.
- **Hell ist der Default.** MOO ist eine helle Marke: `--bg` als Bildgrund, `--ink` als
  Schrift. Dunkle Szenen (`--ground`) sind die Ausnahme, nicht die Regel.
- **Untertitel:** über Videomaterial `--ground` bei 72% Deckkraft als Plate, Text in `--bg`.
  Auf Vollflächen `--ink` auf `--bg`, ohne Plate.
- **Lower-Thirds:** Fläche `--bg`, Name in `--ink`, Rolle in `--accent-deep`,
  Trennlinie `--line` bei 1px.
- **Charts / Zahlen:** Primärserie `--accent`, Sekundärserie `--accent` bei 45% Deckkraft,
  Achsen und Grid `--line`, Werte-Labels `--ink`.
- **Kein reines `#000` und kein reines `#FFF`.** Beides clippt bei der H.264-Kompression
  und bricht den warmen Grundton der Marke.
- **Das Logo ist monochrom** (Wortmarke `#626262`, transparenter Hintergrund).
  Nicht einfärben — es steht auf `--bg` von sich aus richtig.
