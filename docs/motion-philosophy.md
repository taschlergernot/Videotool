# Motion-Philosophie

Leitbild: **modern, hochwertig, clean, dynamisch.** Bewegung soll wie eine Entscheidung
aussehen, nicht wie ein Effekt.

---

## Easings

| Zweck | Easing |
|---|---|
| Reveals, Entrances, alles was "ankommt" | `power3.out` |
| Loops, Ambient-Bewegung, Atmung | `sine.inOut` |
| Exits, Abgänge | `power2.in` |
| Overshoot / Akzent (sparsam) | `back.out(1.4)` |

**`linear` ist verboten.** Ausnahmslos — auch bei Progress-Bars und Countern.
Nichts in der physischen Welt bewegt sich linear, und das Auge merkt es sofort.

**Mindestens 3 verschiedene Easings pro Szene.** Eine Szene, in der alles mit derselben
Kurve läuft, wirkt maschinell.

---

## Anchor-Word-Sync

Animationen landen **mit** dem Wort, nicht danach. Toleranz: **±100ms**.

- Wort-Timestamps kommen aus `projects/<name>/transcripts/master.json` (ElevenLabs Scribe,
  `timestamps_granularity=word`).
- Der Peak der Animation (der Moment, in dem das Element sitzt) fällt auf `word.start`,
  nicht der Start der Animation. Bei einer 400ms-Reveal heißt das: Trigger bei
  `word.start - 0.25s`.
- Bei Claude-Design-Bundles: die Trigger im Bundle liegen oft 0.3–1s daneben. Immer gegen
  `master.json` verifizieren, bevor gerendert wird.

---

## Timing-Grundwerte

| Element | Dauer |
|---|---|
| Text-Reveal (Zeile) | 400–600ms |
| Lower-Third rein | 500ms, raus 350ms |
| Full-Screen-Statement | 700ms rein, 2.5–4s Standzeit |
| Data-Chart-Aufbau | 800–1200ms, gestaffelt |
| Szenen-Transition | 400–700ms |

**Stagger** bei Listen und Multi-Element-Reveals: 60–90ms zwischen den Items.
Alles darunter wirkt gleichzeitig, alles darüber zerfällt.

---

## Typografie in Bewegung

- Text bewegt sich **entlang einer Achse**, nicht diagonal. Y-Achse für Reveals,
  X-Achse für Wechsel.
- Kein Buchstaben-für-Buchstaben-Tippen bei mehr als 5 Wörtern — wirkt billig und
  hält den Betrachter auf.
- Clip-Path-Reveals (Maske fährt auf) schlagen Opacity-Fades bei Headlines.
- Opacity-Fades bleiben richtig für sekundären Text und Untertitel.

---

## Banned Fonts

Diese Schriften sind in diesem Projekt **nicht** zu verwenden — weder in Compositions noch
in Brand-Guidelines:

Inter · Roboto · Open Sans · Lato · Poppins · Outfit · Sora · Fraunces ·
Playfair Display · Cormorant Garamond · Syne · Cinzel · Nunito · Source Sans ·
PT Sans · Arimo

Grund: sie sind die Default-Griffe jedes Templates und tragen keine eigene Haltung.
Empfehlungen für Ersatz stehen in `brand-guidelines/default/typography.md`.

---

## Was nicht passiert

- Kein `linear`.
- Keine Elemente, die ohne Grund wackeln, pulsieren oder rotieren.
- Keine Drop-Shadows als Ersatz für Kontrast.
- Keine Animation, die länger dauert als die Information, die sie transportiert.
- Keine gleichzeitigen Bewegungen in mehr als zwei Bildbereichen.
