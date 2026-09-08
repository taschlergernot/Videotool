# Arbeitsregeln für Claude in diesem Projekt

KI Video Editing Studio. Zwei Workflows: **Edit** (Rohvideo → Cut → Motion Graphics → Render)
und **Pure Animation** (ohne Rohvideo). Setup-Details stehen in [SETUP.md](SETUP.md) —
diese Datei ist die Arbeitsanleitung für den laufenden Betrieb.

---

## Grundregeln

- **Video-Use first** für Schnitt und Transkription, **danach** Hyperframes für Motion Graphics.
  Nicht in umgekehrter Reihenfolge, nicht parallel raten.
- **Plan-Bestätigung auf Deutsch, Plain Language** vor jedem Cut und vor jeder Composition.
  Kein Markup-Slang, keine Fachjargon-Wand. Erst nach User-OK rendern.
- Outputs landen unter `projects/<name>/renders/` — **niemals** in Repo-Root oder `raw/`.
- **Neue Projekte rendern standardmäßig 9:16 (1080×1920)**, nicht mehr 16:9 — nutzerseitig am
  2026-09-08 festgelegt. 16:9 (1920×1080) nur noch, wenn der Nutzer explizit danach fragt
  (z.B. "im Querformat" / "16:9" / "Desktop"). Gilt für video-use-Cuts genauso wie für
  Hyperframes-Compositions und Ad-hoc-ffmpeg-Renders (z.B. Teaser, Zusammenschnitte).
- `.env` niemals committen. Key niemals im Chat-Output zeigen.
- **`.env`-Sync:** wenn `./.env` und `./video-use/.env` divergieren → syncen.
  **Projekt-Root ist die Wahrheit.** Auch dann den Wert nicht loggen.
- Bei Multi-Scene-Compositions: parallele Sub-Agents (eine Szene pro Agent), wenn die Szenen
  unabhängig sind.
- Nach jedem Render **Self-Eval per `timeline_view`-Pattern**, bevor der Preview gezeigt wird.
- **Skill-Imports (Windows):** falls eine Junction in `.claude/skills/` nicht angelegt werden
  konnte, per absolutem Pfad importieren statt den Schritt zu überspringen.

## Brand-Guidelines-Konvention

- Sagt der Nutzer *"nutze die Brand aus `brand-guidelines/<name>/`"* → **alle** Files in dem
  Ordner lesen (Hex-Codes, Typefaces, Logo-SVGs, Tone-of-Voice, optionale
  `motion-philosophy.md`-Overrides) und Schnitt-Stil, Farben, Typografie, Overlays,
  Subtitles und Layouts daran ausrichten.
- Ohne Nennung → Fallback auf `brand-guidelines/default/`.
- **Wichtig:** `brand-guidelines/` gilt **nur** für den Direkt-Hyperframes-Pfad.
  Claude Design (claude.ai) hat sein eigenes Brand-System — dort kommt die Brand aus dem
  hochgeladenen Skill, nicht aus diesem Repo.

---

## Cut-Standards (nicht verhandelbar)

Bei jedem Schnitt anzuwenden — sonst klingt der Cut gehetzt oder träge.

### Versprecher-Detection (Pflicht vor jedem Cut)

1. `pack_transcripts.py --silence-threshold 0.4` laufen lassen.
2. `ffmpeg -af silencedetect=noise=-30dB:duration=0.25` auf die Source.
3. Vergleichen. Verdächtig sind:
   - Wort-Marker mit unnatürlich langer Dauer (einsilbiges Wort > 1.5s)
   - Gaps zwischen Wörtern, in denen die Silence-Map **nicht** den ganzen Gap als still
     markiert → der Rest ist Stammer / Atmer / Versprecher
4. Verdächtige Sub-Slices **isoliert nochmal an Scribe schicken** (`-ss/-to`-Extract).
   Das deckt versteckte Doppelversuche auf.

### Cut-Padding nach Typ

| Cut-Typ | Tail (nach Wort) | Lead (vor Wort) |
|---|---|---|
| Mid-sentence (Komma) | 100ms | 80ms |
| Sentence-boundary (Punkt) | 200ms | 130–150ms |
| Video-Anfang | — | 130–150ms |
| **Video-Ende** | **600–700ms** (nach **echtem** Word-End via Re-Scribe) | — |

Cut-Typ erkennen: letztes Wort endet auf `,` und Konstruktion geht weiter → Mid.
Auf `.` `?` `!` → Boundary. Letzte Range im EDL → Video-Ende-Tail.

### Two-Step-Verifikation des letzten Wortes (Pflicht vor Final-Render)

Full-Context-Scribe markiert das letzte Wort eines Satzes oft 1–2s zu spät (rechnet den
Atemzug-Decay als Word-Tail).

1. Letztes Wort isoliert per Sub-Slice re-transkribieren:
   `ffmpeg -ss <word.start - 1> -to <word.end + 1>` → Scribe.
2. Den **echten** Word-End aus der Slice-Transkription nehmen, **nicht** den aus Full-Context.
3. `range_end = echter_word_end + 600–700ms`.

Beispiel: Full-Context `'schneiden.' 65.06–66.92` (1.86s, falsch).
Re-Scribe Slice 64–68: `'schneiden.' 65.04–65.42` (0.38s, korrekt).
Range-End = 65.42 + 0.63 = **66.05**.

### EDL-Konvention

Jede `edl.json` trägt einen `_padding_params`-Block. Keine Magic-Numbers:

```json
{
  "sources": { "name": "..." },
  "grade": null,
  "_padding_params": {
    "mid_sentence_tail_ms": 100,
    "mid_sentence_lead_ms": 80,
    "sentence_boundary_tail_ms": 200,
    "sentence_boundary_lead_ms": 140,
    "video_end_tail_ms": 630
  },
  "ranges": []
}
```

---

## Workflow-Branch nach dem Cut (Pflicht-Checkpoint)

**Die zwei Pfade haben unterschiedliche Render-Engines — sie konvergieren NICHT bei Hyperframes.**

| | Direkt-Hyperframes | Claude-Design-Bundle |
|---|---|---|
| HTML-Quelle | Claude baut Compositions lokal | claude.ai exportiert ein Bundle |
| Contract | `@hyperframes/core` (`data-composition-id`, `window.__timelines`) | eigener React+Babel+Stage-Stack |
| Preview | `npx hyperframes preview` (`localhost:3002`) | eigener tiny dev-server (`localhost:3030`) |
| Render | `npx hyperframes render` | eigene Puppeteer + ffmpeg-Pipeline |
| Brand | `brand-guidelines/<name>/` aus dem Repo | Skill, hochgeladen in claude.ai/design |

Geteilt wird **nur** die `chrome-headless-shell`-Binary unter `~/.cache/hyperframes/chrome/...`,
die `npx hyperframes doctor` ablegt. Die Bundle-Pipeline ruft die Binary direkt auf — nicht die
`hyperframes`-CLI.

**Vor jedem HTML-Bau per `AskUserQuestion` fragen:**

**Frage 1 (immer) — HTML-Quelle:**
- *Claude Design (claude.ai)* — Claude exportiert nur das Output-Timeline-Transkript.
- *Direkt Hyperframes* — Claude baut Storyboard und Compositions selbst.

**Frage 2 (NUR bei Direkt Hyperframes) — Brand:** `default/` · eigene Sub-Brand · keine (Test).
Bei Claude Design die Brand-Frage **weglassen**.

**Bei "Claude Design" zusätzlich:**
1. **Nur das Transkript ausgeben, sonst NICHTS in den Chat.**
   Files: `projects/<name>/output_transcript.md` (Sentence + Word Level, Output-Timestamps)
   und dieselben Daten als `output_transcript.json`.
   Keine "Nächste Schritte", keine claude.ai-Settings-Hinweise, keine Brand-Notes,
   keine Empfehlungen. Das Transkript wird direkt hochgeladen — alles andere ist Noise.
2. **Aktiv auf das Bundle warten.** In folgenden Turns proaktiv nachhaken, wenn der Nutzer
   etwas anderes anspricht ohne das Bundle zu liefern. **Niemals stillschweigend warten.**
3. Bundle da → Bundle-Pipeline (unten) → frame-by-frame Render.

---

## Claude-Design-Bundle: Render-Pipeline

### 1. Entpacken
Single HTML enthält `<script type="__bundler/manifest">`. Per-Entry `compressed: true` (gzip)
oder `false` (raw base64) — **beide** handhaben. Entpacken nach
`projects/<name>/_bundle_assets/<uuid>.<ext>`.
**Filename nicht hardcoden** — autodetecte das einzige `*.html` im Root mit `__bundler/manifest`
(Filenames können Leerzeichen haben).

### 2. Format-Check VOR jedem Patch-Versuch

| | **Format A — Hyperframes-runtime** | **Format B — React+Babel+Stage** |
|---|---|---|
| Größe | ~400 KB | ~1.5 MB |
| Mount | `#main` | `#root` |
| Player-API | `window.__player` mit `enableRenderMode()` / `renderSeek(t)` da | Stage `useTime()` — muss gepatcht werden |
| Patches | **NEIN** | **JA** (die 3 unten) |

Detection: `_bundle_assets/*.jsx` vorhanden → **Format B**.
Extracted JS enthält `var HyperShader = ...` → **Format A**.
Format-B-Patches auf Format-A-Code = nichts passiert, du debuggst im Kreis.

### 3. Render-Mode-Patches (nur Format B)
- **App:** `window.__renderMode` checken → Stage-UI / TweaksPanel ausblenden.
- **Stage:** in render mode kein rAF-Loop, `window.__setStageTime(t)` exponieren,
  minimal layout (full-frame canvas, keine Bar, kein Auto-Scale).
- **Video-Components:** in render mode **niemals** `video.play()` / `.pause()` —
  nur `video.currentTime = t` exakt setzen. Sonst Race mit dem Frame-Capture.

⚠️ **`?render=1` ist eine Falle.** claude.ai's Bootstrap reagiert auf JEDEN Query-String und
nimmt einen alternativen Mount-Pfad, bei dem `__player` nie verfügbar wird. Korrekt:

```js
await page.evaluateOnNewDocument(() => {
  window.__renderMode = true;
  window.__hfVideoUrl = "/assets/speaker.mp4";
});
await page.goto("http://localhost:3034/");  // KEIN ?render=1
```

### 4. Speaker-Video Keyframe-Conversion (Pflicht vor Render)

**Das ist DER "Video hängt"-Bug.** `video.currentTime = t` snappt bei H.264 mit B-Frames zum
nächsten Keyframe (~alle 4s) — Frame bei t=5s zeigt die Pose von t=4s.

```bash
ffmpeg -i clips/edited.mp4 -c:v libx264 -preset fast -crf 18 \
  -g 1 -keyint_min 1 -sc_threshold 0 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k assets/speaker.mp4
```

`-g 1` = jeder Frame ein Keyframe. ~5× größer, aber Seeks sind exakt.
**Konvention:** das Bundle erwartet `projects/<name>/assets/speaker.mp4` — nicht
`clips/edited.mp4`, nicht `renders/final-4k.mp4`.

### 5. Wort-Sync gegen `transcripts/master.json`
claude.ai trifft Anchor-Words oft 0.3–1s daneben — meist der einzige Grund, warum
Bundle-Assets überhaupt editiert werden müssen. Animations-Trigger im Bundle finden
(typisch: ein `transcript`-JSON-Asset oder eine Inline-Tabelle in der Main-App), gegen die
ElevenLabs-Wort-Timestamps abgleichen, korrigieren. **Dann erst rendern.**

### 6. Frame-by-frame Render
- **Default:** 4K @ 60fps via Viewport `1920×1080 @ deviceScaleFactor: 2`.
- **Override:** `RENDER_QUALITY=1080p` → `1920×1080 @ DPR 1`, ~4 statt 8–10 Min.
- **Duration:** via `ffprobe assets/speaker.mp4` lesen — **niemals hardcoden**.
- **Wait:** `waitUntil: "load"` (**nicht** `networkidle0` — das streamende Speaker-Video hält
  das Idle-Event endlos auf). Danach auf `window.__renderReady === true` pollen.
- **Audio:** aus `assets/speaker.mp4` muxen.
- **Output:** 4K → `renders/final-4k.mp4`, 1080p → `renders/final.mp4`.

### 7. Iteration
- Bundle 1:1 übernommen → direkt 1080p rendern → Feedback → bei OK 4K.
  Kein Preview-Server-Zwang.
- Asset-Edits nötig → eigener tiny dev-server auf `localhost:3030` mit Hot-Reload
  (mtime-Polling, injected Reload-Script, Range-Requests fürs Video). Erst nach User-OK final.

⚠️ **NICHT** `npx hyperframes preview` für Bundles — Studio enforced den Composition-Contract,
refused mit `[StaticGuard] Invalid HyperFrame contract`.
⚠️ **NICHT** `npx hyperframes render` direkt aufs Bundle — gleicher Reject.
⚠️ **NICHT** `page.screencast()` — laggt, dropped frames, out-of-sync.
⚠️ **NICHT** ohne Keyframe-Conversion rendern — Speaker hängt.

---

## Windows-Hinweise

- **`PYTHONUTF8=1` setzen** vor jedem `uv run python ./video-use/helpers/...` —
  sonst `UnicodeEncodeError` beim `≥`-Zeichen.
- **`uv` braucht auf dieser Maschine `--system-certs`.** Ohne den Flag scheitert jeder
  Netzwerk-Zugriff mit `invalid peer certificate: UnknownIssuer` — hier läuft eine
  TLS-Interception (Proxy oder AV mit HTTPS-Scan), deren Root-Zert nur im Windows-Store
  liegt, nicht in uv's gebündelten Roots. Also immer:
  `uv run --project ./video-use --system-certs ...` bzw. `uv sync --system-certs`.
  (`--native-tls` tut dasselbe, ist aber deprecated.)
- **PATH nach Neuinstallationen:** frisch installierte Tools fehlen in schon laufenden
  Shells. Nachladen mit
  `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")`.
- **`grade: "auto"` in der EDL ist auf Windows broken** (ffmpeg-Filter-Parser kollidiert mit
  `C:\`-Pfaden im `metadata=print:file=...`-Argument). **Workaround: `grade: null`.**
- ffprobe / silencedetect schreiben auf stderr → in PowerShell mit
  `2>&1 | Select-String "silence_"` filtern.
- **`.env` muss BOM-frei sein.** `Set-Content -Encoding utf8` schreibt in PowerShell 5.1
  ein UTF-8-BOM, und `video-use/helpers/transcribe.py` parst die Datei von Hand
  (`k.strip() == "ELEVENLABS_API_KEY"`) — Python's `strip()` entfernt kein `\ufeff`,
  der Key wird also nicht gefunden. Immer so schreiben:
  ```powershell
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText("C:\Videotool\.env", "ELEVENLABS_API_KEY=$key`n", $utf8NoBom)
  ```
- **Key-Auflösung:** `transcribe.py::load_api_key()` liest **zuerst** `video-use/.env`,
  danach `./.env`, zuletzt die Umgebungsvariable. Deshalb müssen beide Files synchron sein.
- **`import video_use` gibt es nicht.** Das Repo setzt `py-modules = []` — es liefert nur
  `helpers/`-Skripte, kein importierbares Modul. Zum Prüfen der Installation stattdessen
  `python ./video-use/helpers/render.py --help` aufrufen.
- `Start-Process projects\...\clips\edited.mp4` öffnet das Video im Default-Player zur Review.
- **Multi-Line-Daten an native Prozesse pipen (`|`) ist in dieser Sandbox unzuverlässig.**
  Getestet an `git credential approve`: PowerShell hängt ein BOM vor die erste Zeile und
  bricht offenbar auch mehrzeiligen Input ab (`fatal: refusing to work with credential
  missing protocol field`, dann `unable to read credential from stdin`) — betrifft sowohl
  `Get-Content | cmd`, `"text" | cmd` als auch `.NET Process.StandardInput` (StreamWriter,
  BOM-behaftet) **und** git.exe's eigene Weiterleitung an seinen konfigurierten
  `credential.helper`-Subprozess (nochmal eine Ebene BOM/Truncation).
  **Fix:** den Ziel-Befehl **direkt** aufrufen statt über eine Zwischenschicht, und Bytes
  **roh** schreiben statt über einen StreamWriter:
  ```powershell
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "C:\Program Files\Git\mingw64\bin\git-credential-manager.exe"
  $psi.Arguments = "store"   # nicht "git credential approve" -- eine Ebene weniger
  $psi.RedirectStandardInput = $true; $psi.UseShellExecute = $false
  $proc = [System.Diagnostics.Process]::Start($psi)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes("protocol=https`nhost=github.com`nusername=...`npassword=...`n`n")
  $proc.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)  # BaseStream, kein StreamWriter -- kein BOM
  $proc.StandardInput.BaseStream.Flush(); $proc.StandardInput.Close()
  ```
  Danach greift der Credential Manager wie gewohnt — `git push`/`git pull` fragen nicht mehr
  nach einem Token.
