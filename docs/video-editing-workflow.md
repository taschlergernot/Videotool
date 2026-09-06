# Video-Editing-Workflow — Schritt für Schritt

Referenz für Claude im Lauf einer Session. Die verbindlichen Regeln stehen in
[`CLAUDE.md`](../CLAUDE.md); hier steht die Reihenfolge mit den konkreten Kommandos.

Platzhalter in allen Kommandos: `<projekt>` = Projektname, `<file>` = Roh-Dateiname.
Auf Windows vor jedem `uv run python`: `$env:PYTHONUTF8 = "1"`.

---

## Schritt 0 — Projekt anlegen

```
raw/<projekt>/<file>.mp4          ← Rohvideo (vom Nutzer abgelegt)
projects/<projekt>/
  assets/ clips/ transcripts/ compositions/ previews/ renders/
```

## Schritt 1 — Transkribieren (ElevenLabs Scribe)

Video-Use transkribiert mit Wort-Timestamps nach `projects/<projekt>/transcripts/master.json`
plus `master.srt`. Key kommt aus `video-use/.env`.

Prüfen, dass `timestamps_granularity=word` gesetzt war — ohne Wort-Ebene ist weder
Cut-Detection noch Anchor-Word-Sync möglich.

## Schritt 2 — Transkript packen

```bash
uv run --project ./video-use python ./video-use/helpers/pack_transcripts.py \
  --edit-dir "projects/<projekt>" --silence-threshold 0.4
```

```powershell
$env:PYTHONUTF8 = "1"; uv run --project ./video-use python `
  ./video-use/helpers/pack_transcripts.py --edit-dir "projects/<projekt>" `
  --silence-threshold 0.4
```

## Schritt 3 — Silence-Map auf der Source

```bash
ffmpeg -hide_banner -nostats -i raw/<projekt>/<file>.mp4 \
  -af "silencedetect=noise=-30dB:duration=0.25" -f null - 2>&1 | grep "silence_"
```

```powershell
ffmpeg -hide_banner -nostats -i raw\<projekt>\<file>.mp4 `
  -af "silencedetect=noise=-30dB:duration=0.25" -f null - 2>&1 |
  Select-String "silence_"
```

## Schritt 4 — Versprecher-Detection

Packed Transcript gegen Silence-Map halten. Verdächtig:

- einsilbiges Wort mit Dauer > 1.5s
- Gap zwischen zwei Wörtern, den die Silence-Map **nicht vollständig** als still markiert →
  im Rest steckt ein Stammer, ein Atmer oder ein Fehlstart

Jede verdächtige Stelle isoliert nachprüfen (Schritt 5).

## Schritt 5 — Sub-Slice an Scribe

Audio extrahieren:

```bash
ffmpeg -y -hide_banner -nostats -i raw/<projekt>/<file>.mp4 \
  -ss <start_sec> -to <end_sec> -vn -ac 1 -ar 16000 -c:a pcm_s16le \
  /tmp/_slice.wav
```

An Scribe schicken:

```bash
KEY=$(grep '^ELEVENLABS_API_KEY=' .env | cut -d= -f2)
curl -sS -X POST "https://api.elevenlabs.io/v1/speech-to-text" \
  -H "xi-api-key: $KEY" \
  -F "file=@/tmp/_slice.wav;type=audio/wav" \
  -F "model_id=scribe_v1" \
  -F "language_code=de" \
  -F "timestamps_granularity=word" \
  -F "diarize=false"
```

**Die Slice-Word-Times sind relativ zum Slice-Start** — `<start_sec>` addieren, um auf die
Original-Timeline zu kommen.

## Schritt 6 — EDL bauen

`projects/<projekt>/edl.json` mit `_padding_params`-Block. Padding nach Cut-Typ
(Tabelle in [`CLAUDE.md`](../CLAUDE.md#cut-padding-nach-typ)).

Auf Windows: **`"grade": null`** — `"auto"` ist dort broken.

## Schritt 7 — Letztes Wort verifizieren (Pflicht)

Full-Context-Scribe setzt das letzte Wort eines Satzes oft 1–2s zu spät. Also:

1. Letztes Wort per Sub-Slice re-transkribieren
   (`-ss <word.start - 1> -to <word.end + 1>`).
2. Echten Word-End aus der Slice nehmen.
3. `range_end = echter_word_end + 630ms`.

## Schritt 8 — Cut-Plan vorlegen

**Auf Deutsch, Plain Language.** Enthält:
- was rausfliegt und warum (Füllwörter, Pausen, Fehlstarts, Versprecher, Retakes)
- die Versprecher-Findings aus Schritt 4/5
- das gewählte Padding pro Range

**Auf User-OK warten.** Erst dann rendern.

## Schritt 9 — Cut rendern

```bash
uv run --project ./video-use python ./video-use/helpers/render.py \
  projects/<projekt>/edl.json -o projects/<projekt>/clips/edited.mp4
```

Ergebnis: `clips/edited.mp4` + `transcripts/master.srt` + Wort-Timestamp-JSON.

## Schritt 10 — Checkpoint: HTML-Quelle wählen

Per `AskUserQuestion` fragen: **Claude Design (claude.ai)** oder **Direkt Hyperframes**?
Bei Direkt Hyperframes zusätzlich nach der Brand fragen; bei Claude Design **nicht**.

Ab hier trennen sich die Wege — siehe [`CLAUDE.md`](../CLAUDE.md#workflow-branch-nach-dem-cut-pflicht-checkpoint).

---

## Pfad A — Direkt Hyperframes

**11a. Storyboard vorlegen** — HTML-Skizze mit Beats, Anchor-Wörtern, Animation-Typen
pro Szene. Auf User-OK warten.

**12a. Compositions bauen** unter `projects/<projekt>/compositions/`.
Bei unabhängigen Szenen: parallele Sub-Agents, eine Szene pro Agent.
Brand-Tokens aus `brand-guidelines/<name>/`, Easings aus
[`motion-philosophy.md`](motion-philosophy.md).

**13a. Preview**

```bash
npx hyperframes preview     # Studio auf localhost:3002
```

**14a. Iterieren** auf Feedback hin.

**15a. Final-Render**

```bash
npx hyperframes render
```

Output nach `projects/<projekt>/renders/final.mp4` — 1920×1080 @ 30fps default,
1080×1920 für Shorts.

---

## Pfad B — Claude-Design-Bundle

**11b. Transkript exportieren — und sonst nichts in den Chat schreiben.**

Files: `projects/<projekt>/output_transcript.md` (Sentence- + Word-Level mit
Output-Timestamps) und dieselben Daten als `output_transcript.json`.
Keine "Nächste Schritte", keine Settings-Hinweise, keine Brand-Notes.

**12b. Aktiv auf das Bundle warten.** In folgenden Turns nachhaken, wenn der Nutzer etwas
anderes anspricht ohne das Bundle zu liefern.

**13b. Speaker-Video konvertieren (Pflicht — sonst hängt der Speaker im Render):**

```bash
ffmpeg -i projects/<projekt>/clips/edited.mp4 \
  -c:v libx264 -preset fast -crf 18 \
  -g 1 -keyint_min 1 -sc_threshold 0 \
  -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k \
  projects/<projekt>/assets/speaker.mp4
```

**14b. Bundle entpacken, Format bestimmen, ggf. patchen, Wort-Sync gegen `master.json`,
frame-by-frame rendern.** Vollständige Pipeline in
[`CLAUDE.md`](../CLAUDE.md#claude-design-bundle-render-pipeline).

Output: `renders/final.mp4` (1080p) bzw. `renders/final-4k.mp4`.

---

## Schritt 16 — Self-Eval

Nach **jedem** Render Self-Eval per `timeline_view`-Pattern — **bevor** der Preview gezeigt
wird. Geprüft wird:

- sitzt jede Animation innerhalb ±100ms auf ihrem Anchor-Word?
- hängt oder springt der Speaker irgendwo?
- endet das Video mit 600–700ms Atemraum nach dem letzten Wort?
- sind die Untertitel durchgehend lesbar (Kontrast, Plate, Timing)?
- laufen mindestens 3 verschiedene Easings, und nirgends `linear`?

Erst danach dem Nutzer den Preview zeigen.
