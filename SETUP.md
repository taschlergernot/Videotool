# Setup-Anleitung für Claude Code

Diese Datei ist die Anleitung, die Claude Code befolgt, wenn der Nutzer sagt **"Setup das Projekt"**. Sie soll am Ende dazu führen, dass der Nutzer nur seinen ElevenLabs-API-Key einträgt und sofort loslegen kann.

---

## Was wir hier bauen

Ein vollständiges KI Video Editing Studio, das zwei Workflows kann:

1. **Edit-Workflow:** Rohvideo rein → Transkription → Cuts → Motion Graphics → finaler Render.
2. **Pure-Animation-Workflow:** Animationsvideos für Website, Promos, Erklärvideos — auch ganz ohne Roh-Video.

Tools:
- **Video-Use** — Schnitt, Transkription (ElevenLabs Scribe), Subtitles, Self-Eval
- **Hyperframes** — HTML-basierte Motion-Graphics-Compositions mit GSAP, Render via FFmpeg

---

## Die einzige Voraussetzung für den Nutzer

Ein **ElevenLabs-API-Key**. Frei erhältlich unter https://elevenlabs.io/app/settings/api-keys (Free-Tier reicht für erste Tests).

Alles andere (Node, Python, FFmpeg, uv, Git) installierst du, Claude — falls etwas fehlt, listest du dem Nutzer das passende Install-Kommando für sein OS.

---

## Was Claude beim Setup macht — Phase für Phase

> **Wichtig:** Sei idempotent. Falls ein Schritt schon erledigt ist (Verzeichnis vorhanden, npm bereits installed, video-use bereits geklont), überspringe ihn statt zu überschreiben. Falls ein vorheriger Setup-Versuch teilweise hängen geblieben ist, fixe nur das, was fehlt.

### Phase 1 — Pre-flight (Tool-Check)

OS automatisch erkennen (`process.platform` / `uname` / `$IsWindows`). Keine Frage an den Nutzer, ob WSL oder Native.

Prüfe diese Tools mit Mindest-Versionen:

| Tool       | Min-Version | Pflicht? |
|------------|-------------|----------|
| `node`     | ≥ 22        | ✓        |
| `npm`      | ≥ 10        | ✓        |
| `python`   | ≥ 3.11      | ✓        |
| `uv`       | latest      | ✓        |
| `ffmpeg`   | ≥ 4.x       | ✓        |
| `ffprobe`  | ≥ 4.x       | ✓        |
| `git`      | ≥ 2.30      | ✓        |
| `git-lfs`  | latest      | optional (nur falls Brand-Assets via LFS verteilt werden) |
| `yt-dlp`   | latest      | optional (nur für YouTube-Downloads als Roh-Input) |

Falls etwas fehlt, liste dem Nutzer **das exakte Install-Kommando für sein OS** und warte auf Bestätigung, dass er installiert hat (oder dass er später installiert und du trotzdem weitermachen sollst, soweit möglich):

**Windows:**
```powershell
winget install OpenJS.NodeJS.LTS Python.Python.3.12 Gyan.FFmpeg astral-sh.uv Git.Git
```

**macOS:**
```bash
brew install node@22 python@3.12 ffmpeg uv git
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt update && sudo apt install -y nodejs npm python3.12 ffmpeg git
curl -LsSf https://astral.sh/uv/install.sh | sh
# Node 22+ via NodeSource falls Distro-Version zu alt:
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
```

### Phase 2 — Plan zur Freigabe

Bevor du irgendwas installierst: zeig dem Nutzer **kurz** (max. 7 Bullets) was du gleich tust und warte auf "OK / go". Beispiel:

```
Plan:
1. Pre-flight Tool-Check
2. Ordnerstruktur + Pflicht-Dateien anlegen (inkl. generische Brand-Platzhalter)
3. Hyperframes installieren (npm install) — Skills aus node_modules verlinken
4. Video-Use ins Projekt klonen + uv sync
5. ElevenLabs-Key — entweder selbst in .env eintragen (empfohlen) oder mir im Chat geben
6. Brand Guidelines — wenn du eine ZIP aus Claude Design hast, entpack ich sie nach brand-guidelines/default/
7. Verifikation (hyperframes doctor) + Summary
```

### Phase 3 — Scaffold

Lege folgende Struktur an (siehe Ziel-Ordnerstruktur unten) und schreibe alle Pflicht-Dateien (siehe weiter unten).

### Phase 4 — Hyperframes installieren + Skills verlinken

```bash
npm install
```

Das installiert `hyperframes`, `@hyperframes/core`, `@hyperframes/shader-transitions`, `puppeteer-core` aus dem dafür angelegten `package.json`.

Anschließend **die in `node_modules/hyperframes/dist/skills/` mitgelieferten Skills (`hyperframes`, `gsap`, `hyperframes-cli`) als Junction (Windows) bzw. Symlink (macOS/Linux) in `.claude/skills/<name>` verlinken.** So sind sie projekt-lokal verfügbar und updaten automatisch mit `npm update`.

**Wichtig:** Nicht `npx skills add heygen-com/hyperframes` o.ä. nutzen — das pullt unautorisierten Code von GitHub und wird vom Claude-Code-Auto-Mode-Classifier blockiert. Die mitgelieferten Skills aus dem npm-Paket sind funktional gleichwertig.

**Cross-Platform-Verlinkung:**

Windows (PowerShell, kein Admin nötig dank Junction):
```powershell
foreach ($name in @("hyperframes","gsap","hyperframes-cli")) {
  $target = ".claude\skills\$name"
  if (Test-Path $target) { Remove-Item $target -Recurse -Force }
  New-Item -ItemType Junction -Path $target -Target "node_modules\hyperframes\dist\skills\$name" | Out-Null
}
```

macOS/Linux (bash):
```bash
for name in hyperframes gsap hyperframes-cli; do
  ln -sfn "$(pwd)/node_modules/hyperframes/dist/skills/$name" ".claude/skills/$name"
done
```

### Phase 5 — Video-Use ins Projekt klonen

Video-Use lebt **innerhalb** des Projekts unter `./video-use/`. Das macht das Projekt self-contained.

```bash
git clone https://github.com/browser-use/video-use ./video-use
cd ./video-use
uv sync
cd ..
```

Anschließend `./video-use/` als Skill verlinken (gleiches Pattern wie oben):

Windows:
```powershell
$target = ".claude\skills\video-use"
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Junction -Path $target -Target "video-use" | Out-Null
```

macOS/Linux:
```bash
ln -sfn "$(pwd)/video-use" ".claude/skills/video-use"
```

### Phase 6 — ElevenLabs-Key abfragen und propagieren

Frag den Nutzer per `AskUserQuestion` einmal nach seinem ElevenLabs-Key. **Drei Optionen** — die "selbst eintragen"-Option ist die sicherheitsbewusste Variante (Key landet nie im Chat-Verlauf):

- **"Ich trage den Key selbst in die `.env` ein" (empfohlen aus Security-Sicht)** — Claude legt beide `.env`-Files leer an, oeffnet `./.env` automatisch im Editor (oder zeigt den Pfad), wartet auf Bestaetigung dass der Key drin ist, syncts dann nach `./video-use/.env` ohne den Key selbst zu loggen.
- "Ich gebe Claude den Key direkt im Chat" — Claude schreibt ihn in beide `.env`-Files (Komfort-Variante; Key liegt damit auch in der Chat-History).
- "Spaeter — ich habe noch keinen" — beide `.env`-Files leer anlegen, Setup geht weiter, Hinweis am Ende.

#### Option A — "selbst eintragen" (PFLICHT-Empfehlung in der Frage)

1. Beide `.env`-Files **leer** anlegen (`ELEVENLABS_API_KEY=` ohne Wert):
   ```powershell
   "ELEVENLABS_API_KEY=" | Set-Content -Encoding utf8 ".env"
   "ELEVENLABS_API_KEY=" | Set-Content -Encoding utf8 "video-use\.env"
   ```
   ```bash
   echo "ELEVENLABS_API_KEY=" > .env
   echo "ELEVENLABS_API_KEY=" > video-use/.env
   chmod 600 .env video-use/.env
   ```
2. `./.env` im Default-Editor des Nutzers oeffnen (best-effort, nicht crashen wenn's nicht geht):
   - Windows: `Start-Process notepad .env` (oder `code .env` wenn VSCode auf PATH)
   - macOS: `open -e .env` (oder `code .env`)
   - Linux: `xdg-open .env` (oder `code .env`)
3. Dem Nutzer klar sagen:
   > *"Ich hab `./.env` geoeffnet. Trag deinen ElevenLabs-Key hinter `ELEVENLABS_API_KEY=` ein, speichern, dann sag bescheid — ich sync ihn dann nach `./video-use/.env` ohne ihn zu loggen."*
4. **Aktiv warten** bis der Nutzer "fertig" sagt. Dann:
   - `./.env` lesen, `ELEVENLABS_API_KEY`-Wert extrahieren.
   - Pruefen ob nicht-leer und plausibel (Standard-Format ist ~32-40 Zeichen alphanumerisch + ggf. `sk_` Prefix). Bei leer/unplausibel: hoeflich nachfragen ohne den Wert zu zitieren.
   - Den Wert nach `./video-use/.env` schreiben (gleiches Encoding-Setup wie oben).
   - **Den Key niemals im Chat-Output zeigen.** Bestaetigung nur als *"Key ist eingetragen und in beiden `.env`-Files synchron."*
5. Falls der Nutzer den Editor nicht starten konnte: Pfad `./.env` zeigen + er macht's manuell.

#### Option B — "Direkt im Chat geben"

Wenn der Nutzer den Key liefert: schreib ihn in **beide** `.env`-Files:

1. `./.env` (Projekt-Root)
2. `./video-use/.env` (Video-Use liest hier mit `python-dotenv`)

**Auf Windows: `Set-Content -Encoding utf8`** verwenden, sonst schreibt PowerShell UTF-16 LE BOM und `python-dotenv` kommt nicht klar.

```powershell
$key = "<eingegebener-key>"
"ELEVENLABS_API_KEY=$key" | Set-Content -Encoding utf8 ".env"
"ELEVENLABS_API_KEY=$key" | Set-Content -Encoding utf8 "video-use\.env"
```

```bash
echo "ELEVENLABS_API_KEY=$KEY" > .env
echo "ELEVENLABS_API_KEY=$KEY" > video-use/.env
chmod 600 .env video-use/.env
```

#### Option C — "Spaeter"

Lege beide `.env`-Files mit leerem Wert an (`ELEVENLABS_API_KEY=`) und gib ihm am Ende den klaren Hinweis, wo er den Key reinträgt.

Wenn der Nutzer den Key später nachträgt, sagt CLAUDE.md (siehe unten), dass Claude bei nächster Gelegenheit beide Files synct.

### Phase 6b — Brand Guidelines abfragen + Default einrichten (PFLICHT)

**Warum hier:** `brand-guidelines/default/` ist nach dem Scaffold mit generischen Platzhalter-Files gefuellt (`colors.md`, `typography.md`, `tone.md`, `SKILL.md`, `logo/`). Das funktioniert technisch, sieht aber nicht nach **deiner** Brand aus. Wir fragen jetzt aktiv, ob der Nutzer eine echte Brand hat — typischerweise als ZIP aus Claude Design (claude.ai) generiert. Wenn ja, ersetzen wir die Platzhalter; wenn nein, bleibt der Platzhalter und die Frage wird beim ersten Direkt-Hyperframes-Cut erneut aufgeworfen.

**Schritt 1 — Frage per `AskUserQuestion`:**

> Hast du Brand Guidelines, die ich als Default einrichten soll?
> - **Ja, ich habe eine ZIP aus Claude Design** — ich lege sie gleich in den Projekt-Root, du entpackst nach `brand-guidelines/default/`.
> - **Ja, ich habe Brand-Files (kein ZIP)** — ich nenne dir den Pfad, du kopierst nach `brand-guidelines/default/`.
> - **Nein, Platzhalter behalten** — der generische Default bleibt, ich kann spaeter jederzeit nachreichen.

**Schritt 2 — Wenn "Ja, ZIP":**

1. **Aktiv warten und nachfragen** — niemals stillschweigend warten. Sag dem Nutzer:
   > *"Leg die ZIP in den Projekt-Root (`./brand.zip` oder beliebiger Name). Sag bescheid sobald sie da ist, oder paste mir den Pfad."*
2. ZIP-Detection: nach `*.zip` im Projekt-Root suchen. Bei mehreren Treffern explizit fragen welche.
3. **Backup-Check:** wenn `brand-guidelines/default/` nur die Standard-Platzhalter enthaelt (Files matchen die Setup-Vorlagen), darf direkt ueberschrieben werden. Wenn etwas anderes drin ist (zweiter Setup-Lauf, Nutzer hatte schon was angepasst), erst nach `brand-guidelines/_default-backup-<timestamp>/` archivieren.
4. **Entpacken:**
   - Leere Platzhalter-Files in `brand-guidelines/default/` loeschen.
   - ZIP nach `brand-guidelines/default/` entpacken.
   - Wenn die ZIP einen Top-Level-Folder hat (z.B. `MyBrand-Design/SKILL.md`, sehr typisch fuer Claude Design Skill-Exports), den Folder-Inhalt **ein Level hoch** ziehen — `brand-guidelines/default/SKILL.md` muss am Ende direkt erreichbar sein, nicht `brand-guidelines/default/MyBrand-Design/SKILL.md`.
5. **Verifikation:**
   - `brand-guidelines/default/SKILL.md` muss existieren — claude.ai/design braucht das fuer den Skill-Upload. Wenn die ZIP `skill.md` (lowercase) hat, umbenennen.
   - Falls Token-Files erkennbar (CSS-Files mit `--bg`/`--accent`-Variablen, `colors.md`, `typography.md`, `colors_and_type.css`), kurz dem Nutzer den erkannten Token-Block zeigen ("Brand erkannt: bg=#... accent=#... display-font=...").
6. **ZIP loeschen** nach erfolgreichem Entpacken (oder dem Nutzer anbieten — manche behalten die ZIP gern als Backup).

**Schritt 3 — Wenn "Ja, Files (kein ZIP)":**

1. Nutzer nach Source-Pfad fragen (z.B. `~/Downloads/my-brand/`).
2. Backup-Check wie oben.
3. Inhalt nach `brand-guidelines/default/` kopieren.
4. Verifikation wie oben.

**Schritt 4 — Wenn "Nein":**

`brand-guidelines/default/` bleibt mit Platzhalter. In der Setup-Summary (Phase 8) explizit erwaehnen:
> *"Brand-Guidelines: aktuell Platzhalter. Wenn du eine eigene Brand einrichten willst, leg eine Claude-Design-ZIP in den Projekt-Root und sag mir bescheid — ich entpack sie nach `brand-guidelines/default/`."*

**Hinweis fuer Sub-Brands:** Spaetere zusaetzliche Brands (pro Kunde / Kanal) kommen nicht nach `default/`, sondern als eigene Folder `brand-guidelines/<name>/`. Der Nutzer waehlt sie dann pro Projekt explizit.

### Phase 7 — Verifikation

```bash
node --version
ffmpeg -version
python --version
uv --version
npx hyperframes doctor
ls .claude/skills/
```

Erwartetes Ergebnis: alle ✓ bis auf "Docker" (Docker ist nur für sandboxed Renders, nicht für den Standard-Workflow nötig — nicht als Fehler werten).

### Phase 8 — Zusammenfassung

Schreib dem Nutzer eine kurze Summary:
- Was installiert wurde (Hyperframes, Video-Use, Skills)
- Wo der Key liegt (beide `.env`-Stellen)
- **Brand-Status:**
  - Wenn Phase 6b erfolgreich eine echte Brand eingerichtet hat: *"Brand `<erkannter-Name>` aktiv unter `brand-guidelines/default/`. claude.ai/design kann den Folder als Skill hochladen."*
  - Wenn der Nutzer "Nein" gesagt hat: *"Brand-Guidelines: aktuell Platzhalter. Sobald du eine Claude-Design-ZIP in den Projekt-Root legst und mir bescheid sagst, entpack ich sie nach `brand-guidelines/default/`."*
- Wie er das erste Video macht — z.B.:
  > *"Wirf eine Roh-MP4 in `raw/test/take_001.mp4` und sag: 'Edit @raw/test/take_001.mp4 in eine Folge mit Brand default.'"*

---

## Ziel-Ordnerstruktur

```
.
├── raw/                                    Rohvideos (gitignored)
├── projects/
│   └── example/                            Template für ein Video-Projekt
│       ├── assets/                         Speaker-Video (keyframe-converted)
│       ├── clips/                          Cut-Output von video-use
│       ├── transcripts/                    master.json, master.srt
│       ├── compositions/
│       ├── previews/
│       └── renders/                        final.mp4, final-4k.mp4
├── brand-guidelines/
│   ├── default/                            Fallback-Brand (Platzhalter — bitte ersetzen)
│   │   ├── colors.md
│   │   ├── typography.md
│   │   ├── tone.md
│   │   ├── SKILL.md                        Manifest fuer claude.ai/design Upload
│   │   └── logo/
│   └── <eigene-sub-brand>/                 Beispiel: weitere Brand pro Kunde / Kanal
├── docs/
│   ├── motion-philosophy.md
│   └── video-editing-workflow.md
├── video-use/                              <— wird beim Setup hierher geklont
├── node_modules/                           (gitignored)
├── .claude/
│   └── skills/                             Junctions/Symlinks zu hyperframes/, gsap/, hyperframes-cli/, video-use/
├── .env                                    (gitignored) — Single Source of Truth für Keys
├── .env.example                            Vorlage
├── .gitignore
├── CLAUDE.md                               Arbeitsregeln für Claude in diesem Projekt
├── README.md                               Workflow-Doku für Menschen
├── SETUP.md                                Diese Datei
└── package.json                            Hyperframes-Dependencies + puppeteer-core
```

---

## Pflicht-Dateien (von Claude beim Setup zu erstellen)

### `.env.example`
```env
# Pflicht — für Video-Use Transcription (ElevenLabs Scribe)
# Hol dir den Key unter: https://elevenlabs.io/app/settings/api-keys
ELEVENLABS_API_KEY=

# Optional — Whisper-Fallback bei ElevenLabs-Limit
OPENAI_API_KEY=

# Optional — eigene Claude-API-Aufrufe in Skills/Compositions
ANTHROPIC_API_KEY=
```

### `.gitignore`
Mindestens: `.env`, `node_modules/`, `__pycache__/`, `.venv/`, `video-use/.env`, `video-use/.venv/`, `raw/*.mp4`, `raw/*.mov`, `raw/*.mkv`, `projects/*/renders/*.mp4`, `projects/*/previews/*.mp4`, `projects/*/transcripts/*.json`, `projects/*/_bundle_assets/`, `projects/*/assets/speaker.mp4`, `.hyperframes-cache/`, `.DS_Store`, `Thumbs.db`.

### `package.json`
```json
{
  "name": "video-editor",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "preview": "hyperframes preview",
    "doctor": "hyperframes doctor",
    "render": "hyperframes render"
  },
  "dependencies": {
    "hyperframes": "^0.5.5",
    "@hyperframes/core": "^0.5.5",
    "@hyperframes/shader-transitions": "^0.5.5",
    "puppeteer-core": "^23.0.0"
  },
  "engines": { "node": ">=22" }
}
```

### `CLAUDE.md`
Klare Arbeitsregeln für Claude in diesem Projekt:
- Video-Use first für Schnitt/Transkription, dann Hyperframes für Motion Graphics
- **Plan-Bestätigung auf Deutsch** vor jedem Cut und vor jeder Composition
- Outputs landen unter `projects/<name>/renders/`, niemals in Repo-Root oder `raw/`
- `.env` nie committen
- Brand-Guidelines-Konvention beachten (siehe unten)
- Bei Multi-Scene-Compositions: parallele Sub-Agents (eine Szene pro Agent), wenn unabhängig
- Nach jedem Render Self-Eval per `timeline_view`-Pattern, bevor Preview gezeigt wird
- **`.env`-Sync:** Wenn Claude bemerkt, dass `./.env` und `./video-use/.env` divergieren, syncen (Projekt-Root ist Wahrheit)
- Skill-Imports (Windows-Hinweis): falls Junction nicht angelegt werden konnte, per absolutem Pfad importieren

### `README.md`
Workflow-Doku für Menschen. Quickstart, Beispielprompts, Troubleshooting (FFmpeg-PATH, ElevenLabs-Limit, Studio-Port belegt).

### `docs/motion-philosophy.md`
- Modern, hochwertig, clean, dynamisch
- Easings: `power3.out` für Reveals, `sine.inOut` für Loops, **niemals `linear`**
- Anchor-Word-Sync (Animation landet **mit** dem Wort, ±100ms)
- Mindestens 3 verschiedene Easings pro Szene
- **Banned Fonts:** Inter, Roboto, Open Sans, Lato, Poppins, Outfit, Sora, Fraunces, Playfair Display, Cormorant Garamond, Syne, Cinzel, Nunito, Source Sans, PT Sans, Arimo

### `docs/video-editing-workflow.md`
Schritt für Schritt vom Rohvideo bis zum finalen Render. Referenz für Claude im Lauf einer Session.

### `brand-guidelines/default/`
- `colors.md` — Hex-Codes für `--bg`, `--ink`, `--accent`, `--accent-dim`, `--muted`
- `typography.md` — Display- + Data-Font (Google-Fonts-Link), keine Banned Fonts
- `tone.md` — 3–5 Sätze Sprach-Stil
- `SKILL.md` — Skill-Manifest fuer claude.ai/design Upload (definiert Brand-Tokens damit claude.ai sie automatisch nutzt)
- `logo/logo-light.svg` und `logo/logo-dark.svg` (Platzhalter, vom Nutzer ersetzbar)

---

## Brand-Guidelines-Konvention

Wenn der Nutzer in einer späteren Session sagt:

> *"Nutze für dieses Projekt die Brand Guidelines aus `brand-guidelines/<deine-brand>/`."*

…liest Claude **alle** Files in diesem Ordner (Hex-Codes, Typeface-Namen, Logo-SVGs, Tone-of-Voice-Notes, optional `motion-philosophy.md`-Overrides) und richtet Schnitt-Stil, Farben, Typografie, Overlays, Subtitles und Layouts daran aus.

Wenn keine Brand genannt wird, fällt Claude auf `brand-guidelines/default/` zurück.

---

## Workflow nach dem Setup

Was nach erfolgreichem Setup möglich sein soll:

**Edit-Workflow** (mit Rohvideo):
1. Nutzer legt Roh-MP4 in `raw/<projektname>/`.
2. Nutzer sagt: *"Edit @raw/<projektname>/<datei>.mp4 in eine Folge."*
3. Claude transkribiert mit ElevenLabs Scribe.
4. Claude erkennt Füllwörter, Pausen, Fehlstarts, Versprecher, Retakes.
5. Claude legt Cut-Plan in **Deutsch** (Plain Language, keine Markup-Slang) vor → wartet auf Nutzer-OK.
6. Claude erstellt `projects/<name>/clips/edited.mp4` + `master.srt` + Wort-Zeitstempel-JSON.
7. Claude legt Storyboard für Motion Graphics vor (HTML mit Beats, Anchor-Wörtern, Animation-Typen) → wartet auf Nutzer-OK.
8. Claude baut Compositions mit Hyperframes (eine pro Szene, parallel via Sub-Agents wo sinnvoll).
9. `npx hyperframes preview` → Studio auf `localhost:3002`.
10. Iteration auf Feedback hin.
11. Final-Render unter `projects/<name>/renders/final.mp4` (1920×1080 / 30fps default, 1080×1920 für Shorts).
12. Self-Eval per `timeline_view`-Pattern.

**Pure-Animation-Workflow** (ohne Rohvideo):
- Identisch ab Schritt 7 — Nutzer beschreibt das Video, Claude erzeugt Storyboard und baut.

---

## Cut-Standards (Pflicht — gilt fuer alle Edit-Workflows)

Diese Regeln wurden iterativ erarbeitet. Sie sind **nicht verhandelbar** — Claude muss sie bei jedem Schnitt anwenden, sonst klingt der Cut entweder gehetzt oder traege.

### Versprecher-Detection (vor jedem Cut Pflicht)

1. `pack_transcripts.py --silence-threshold 0.4` ausfuehren.
2. `ffmpeg -af silencedetect=noise=-30dB:duration=0.25` auf die Source.
3. Vergleichen — verdaechtig sind:
   - Wort-Marker mit unnatuerlich langer Dauer (z.B. einsilbiges Wort > 1.5s)
   - Gaps zwischen Woertern, in denen die Silence-Map nicht den ganzen Gap als still markiert (Rest = Stammer/Atmer/Versprecher)
4. **Verdaechtige Sub-Slices isoliert nochmal an Scribe schicken** (`/v1/speech-to-text` mit `-ss/-to`-Extract). Das deckt versteckte Doppelversuche auf.

### Cut-Padding nach Typ

| Cut-Typ | Tail (nach Wort) | Lead (vor Wort) |
|---|---|---|
| Mid-sentence (Komma) | 100ms | 80ms |
| Sentence-boundary (Punkt) | 200ms | 130-150ms |
| Video-Anfang | — | 130-150ms |
| **Video-Ende** | **600-700ms** (nach **echtem** Word-End via Re-Scribe) | — |

**Cut-Typ erkennen:** letztes Wort endet mit `,` und Konstruktion geht weiter → Mid. Mit `.` `?` `!` → Boundary. Letztes Range im EDL → Video-Ende-Tail.

**Video-Ende kritisch:** Video soll mit dem letzten Wort enden + **600-700ms Atemraum** (gibt dem Wort einen Auslauf, ohne dass die Aufnahme weiterzulaufen scheint).

**Two-Step Pflicht-Verifikation des letzten Wortes:**
1. Full-Context Scribe markiert das letzte Wort eines Sentences oft 1-2 Sekunden zu spaet (rechnet Atemzug-Decay als Word-Tail). Daher: das letzte Wort vor dem Final-Render isoliert per Sub-Slice (z.B. `ffmpeg -ss <full_context_word.start - 1> -to <full_context_word.end + 1>` + Curl an Scribe) erneut transkribieren.
2. Den **echten** Word-End aus der Slice-Transkription nehmen, NICHT den aus der Full-Context.
3. Range-End = echter Word-End + **600-700ms**.

Beispiel: Full-Context `'schneiden.' 65.06-66.92` (1.86s, falsch). Re-Scribe Slice 64-68: `'schneiden.' 65.04-65.42` (0.38s, korrekt). Range-End = 65.42 + 0.63 = **66.05**.

### EDL-Konvention

Jede `edl.json` enthaelt einen `_padding_params`-Block. Keine willkuerlichen Magic-Numbers — Padding ist immer dokumentiert und nachjustierbar:

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
  "ranges": [...]
}
```

### Plan-Bestaetigung

Vor jedem Cut: Cut-Plan **auf Deutsch** (Plain Language) mit Versprecher-Findings und gewaehltem Padding pro Range. Erst nach User-OK rendern. Bei Korrekturen: gleiche Werkzeuge, gleicher Workflow — kein Raten.

### Workflow-Branch nach dem Cut (PFLICHT-Checkpoint)

**Die zwei Pfade haben unterschiedliche Render-Engines — sie konvergieren NICHT bei Hyperframes.**

| | Direkt-Hyperframes | Claude-Design-Bundle |
|---|---|---|
| HTML-Quelle | Claude baut Compositions lokal im Repo | claude.ai exportiert ein Bundle |
| Composition-Contract | `@hyperframes/core` (`data-composition-id`, `window.__timelines`) | eigener React+Babel+Stage-Stack |
| Preview | `npx hyperframes preview` (Studio auf `localhost:3002`) | eigener tiny dev-server (z.B. `localhost:3030`) |
| Render | `npx hyperframes render` | eigene Puppeteer + ffmpeg-Pipeline (siehe Abschnitt *"Claude-Design HTML auf Cut-Video legen + rendern"*) |
| Brand-System | `brand-guidelines/<name>/` aus dem Repo | Skill, der in claude.ai/design hochgeladen wurde |

**Was beide Pfade teilen:** nur die `chrome-headless-shell`-Binary, die Hyperframes' `puppeteer-core`-Dependency beim `npx hyperframes doctor`-Run unter `~/.cache/hyperframes/chrome/...` ablegt. Die Bundle-Pipeline ruft diese Binary direkt aus dem Cache auf — nicht `hyperframes`-CLI.

**Anti-Pattern:** der Reflex *"Hyperframes ist ja installiert, also nehme ich `npx hyperframes render`"* funktioniert beim Claude-Design-Bundle nicht — der StaticGuard rejected (`[StaticGuard] Invalid HyperFrame contract`). Siehe Warnungen in Abschnitt 7 unten.

**Wichtig zur Brand:** das `brand-guidelines/`-System in diesem Repo ist **nur** fuer den Direkt-Hyperframes-Pfad. Claude Design (claude.ai) hat sein eigenes Brand-System eingebaut — die `brand-guidelines/default/SKILL.md` definiert ein Design-Skill (Standard-Name: `default-design`, vom Nutzer auf seine Brand umzubenennen), das claude.ai direkt aus dem hochgeladenen Folder laedt. Beim Claude-Design-Pfad gibt Claude **nur** das Transkript raus — keine Brand-Files, keine Brand-Token-Summary.

Bevor irgendwelche HTMLs gebaut/integriert werden, fragt Claude per `AskUserQuestion`:

**Frage 1 (immer): HTML-Quelle**
- **Claude Design (claude.ai)** — Claude exportiert nur das Output-Timeline-Transkript. Der Nutzer baut die HTMLs in claude.ai (Brand wird dort vom Skill geladen) und liefert sie zurueck. Claude **wartet aktiv** und fragt nach.
- **Direkt Hyperframes** — Claude baut Storyboard und HTML-Compositions selbst, braucht dafuer eine Brand.

**Frage 2 (NUR bei Direkt Hyperframes): Brand-Guidelines**
- `brand-guidelines/default/` (Fallback)
- `brand-guidelines/<name>/` (z.B. eigene Sub-Brand pro Kunde / Kanal)
- keine Brand (Test-Modus)

Bei Claude Design die Brand-Frage **weglassen** — Brand kommt dort aus dem hochgeladenen Skill, nicht aus diesem Repo.

**Bei "Claude Design"** zusaetzliche Pflichten:
1. **Transkript exportieren — und sonst NICHTS in den Chat schreiben.** Files: `projects/<name>/output_transcript.md` (Sentence + Word Level mit Output-Timestamps) und gleiche Daten als `output_transcript.json`. Keine "Naechste Schritte"-Sektion. Keine Hinweise zu claude.ai-Settings. Keine Brand-Notes. Keine Empfehlungen. Begruendung: das Transkript wird vom User direkt in claude.ai hochgeladen — alles andere ist Noise.
2. **Aktiv auf das Bundle warten:** Message endet nach dem Transkript. In folgenden Turns proaktiv nachhaken wenn der Nutzer was anderes anspricht ohne das Bundle zu liefern. **Niemals stillschweigend warten** — der Workflow blockiert sonst.
3. Sobald das Bundle eintrifft: Bundle-Pipeline anwenden (siehe naechster Abschnitt), dann frame-by-frame Render.

---

## Claude-Design HTML auf Cut-Video legen + rendern

User wirft eine HTML aus claude.ai ins Projekt, sagt "leg auf das Video, sync Timings". Du baust dir die Render-Pipeline pro Projekt selbst. Folgende **Pflicht-Hinweise** sparen Stunden Iteration — ohne die rennt jeder neue Bundle-Render in dieselben Wände:

### 1. Bundle entpacken

Single HTML enthaelt `<script type="__bundler/manifest">` mit JSON-Manifest. Per-Entry kann `compressed: true` (gzip) oder `false` (raw base64) sein — beide Varianten handhaben.

Files entpacken nach `projects/<name>/_bundle_assets/<uuid>.<ext>` (JS, JSX, fonts, images). UUID-Rolle aus den HTML-Kommentaren des Bundle-Templates ablesbar (`<!-- Main app -->`, `<!-- Animation engine -->`, `<!-- Components -->`, `<!-- Transcript data -->`).

**Filename-Robustheit:** der HTML-Filename kann Leerzeichen haben ("Intro Animation.html"). Nicht hardcoden — autodetect das einzige `*.html` im Projekt-Root das `__bundler/manifest` enthält.

### 2. Format-Check VOR jedem Patch-Versuch — es gibt zwei Bundle-Varianten

| | **Format A — Hyperframes-runtime** | **Format B — React+Babel+Stage** |
|---|---|---|
| Groesse | ~400 KB | ~1.5 MB |
| Mount-Target | `#main` | `#root` |
| Player-API | `window.__player` mit `enableRenderMode()` / `renderSeek(t)` direkt verfuegbar | Stage hat `useTime()` — muss gepatcht werden |
| Patches noetig | **NEIN** — bringt eigenen Render-Mode mit, direkt verwenden | **JA** — die 3 Patches (siehe Punkt 3) |

**Detection nach extract:** wenn `_bundle_assets/*.jsx` Files da sind → **Format B**. Wenn ein extracted JS `var HyperShader = ...` enthaelt → **Format A**.

**Warum kritisch:** Format-B-Patches an Format-A-Code applied = nichts passiert, du debuggst im Kreis.

### 3. Render-Mode-Patches (NUR Format B)

Drei Stellen patchen damit das Bundle deterministisch frame-by-frame steuerbar ist:

**App component** — `window.__renderMode = true` checken → Stage-UI/TweaksPanel ausblenden mit `{!renderMode && <TweaksPanel>...}`.

⚠️ **`?render=1` ist eine Falle.** Klingt naheliegend, funktioniert aber nicht: claude.ai's Bundle-Bootstrap reagiert auf JEDEN Query-String und nimmt einen alternativen React/Babel-Mount-Pfad bei dem `__player` nie verfuegbar wird.

**Korrekt:** Render-Mode-Globals **vor** dem Page-Load via Puppeteer's `evaluateOnNewDocument` setzen, **ohne** Query-String:
```js
await page.evaluateOnNewDocument(() => {
  window.__renderMode = true;
  window.__hfVideoUrl = "/assets/speaker.mp4";
});
await page.goto("http://localhost:3034/");  // KEIN ?render=1
```

**Stage component (animation engine)** — in render mode: kein rAF-Loop, `window.__setStageTime(t)` exponieren (der Renderer ruft das per Frame), render minimal layout (full-frame canvas, keine Bar, kein Auto-Scale).

**Video components (SpeakerPlaceholder o.ae.)** — in render mode: NIEMALS `video.play()` / `video.pause()` aufrufen, nur `video.currentTime = t` exakt setzen. Sonst race-condition mit Frame-Capture.

### 4. Speaker-Video All-Intra-Keyframes-Conversion (PFLICHT vor Render)

**Das ist DER "Video haengt"-Bug.** Frame-by-frame `video.currentTime = t` snappt bei H.264 mit B-Frames zum naechsten Keyframe. Standard-Encoding hat Keyframes alle ~4s, also zeigt Frame bei t=5s die Pose von t=4s. Speaker sieht eingefroren aus.

**Pflicht-Konvertierung vor dem Render:**
```bash
ffmpeg -i clips/edited.mp4 \
  -c:v libx264 -preset fast -crf 18 \
  -g 1 -keyint_min 1 -sc_threshold 0 \
  -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k \
  assets/speaker.mp4
```
`-g 1` = jeder Frame ein Keyframe. File wird ~5× groesser (62 MB → 308 MB) aber Seeks sind exakt.

**Konvention:** das Bundle erwartet das Speaker-Video unter `projects/<name>/assets/speaker.mp4`. Das ist der eine Pfad — nicht `clips/edited.mp4`, nicht `renders/final-4k.mp4`.

### 5. Wort-Sync gegen `transcripts/master.json` (Hauptiterations-Treiber)

claude.ai trifft Anchor-Words oft 0.3-1s daneben. Das ist meistens der einzige Grund warum Bundle-Assets ueberhaupt editiert werden muessen.

**Vorgehen:** Animations-Trigger im Bundle finden (typisch: ein `transcript`-JSON-Asset oder Inline-Tabelle in der Main-App), mit den ElevenLabs-Wort-Timestamps aus `master.json` abgleichen, in der HTML / den Assets korrigieren wo's klemmt. Dann erst rendern.

### 6. Frame-by-frame Render mit chrome-headless-shell + Puppeteer + ffmpeg

**Default:** 4K @ 60fps via Viewport `1920×1080 @ deviceScaleFactor: 2` → CSS/SVG/Text scharf bei 2× DPR, Speaker-Video wird bilinear hochskaliert.

**Override:** `RENDER_QUALITY=1080p` env-var → 1920×1080 @ DPR 1, ~4 Min statt 8-10.

**Duration:** via `ffprobe assets/speaker.mp4` lesen — niemals hartkodieren.

**Wait-Strategy:** `waitUntil: "load"` (NICHT `networkidle0` — der streaming Speaker-Video haelt das Network-Idle-Event endlos auf, Renderer wartet bis Timeout). Nach Load auf `window.__renderReady === true` pollen bevor Frame-Capture startet.

**Audio:** aus `assets/speaker.mp4` muxen.

**chrome-headless-shell** liegt unter `~/.cache/hyperframes/chrome/...` nach `npx hyperframes doctor` — gleiche Binary die Hyperframes intern nutzt.

**Output:**
- 4K: `projects/<name>/renders/final-4k.mp4`
- 1080p: `projects/<name>/renders/final.mp4`

### 7. Iterations-Workflow

**Bundle 1:1 vom User uebernommen (kein Asset-Edit noetig)** → direkt 1080p rendern → Feedback einholen → bei OK 4K. **Kein Preview-Server-Pflichtzwang.**

**Asset-Edits noetig (Wort-Sync, Brand-Tweaks)** → eigenen tiny dev-server auf `localhost:3030` mit Hot-Reload (mtime-Polling, injected Reload-Script, Range-Requests fuers Video). Bundle hat eingebaute Stage UI mit Playback-Bar zum Scrubben. Edit → Repack → Browser refresht automatisch. Erst nach User-OK final rendern.

⚠️ **NICHT `npx hyperframes preview` fuer Claude-Design-Bundles** — das Studio enforced strikt den Hyperframes-Composition-Contract (`data-composition-id`, `window.__timelines`). Bundles haben das nicht, Studio refused mit `[StaticGuard] Invalid HyperFrame contract`.

⚠️ **NICHT `npx hyperframes render` direkt aufs Bundle** — gleicher Reject-Grund.

⚠️ **NICHT `page.screencast()`** real-time recording — laggt, dropped frames, out-of-sync.

⚠️ **Render ohne Keyframe-Conversion** = Speaker haengt. Siehe Punkt 4.

---

## Konkrete Commands (copy-pasteable)

**1. Pack transcripts (Phrase-Gruppierung):**

```bash
uv run --project ./video-use python ./video-use/helpers/pack_transcripts.py \
  --edit-dir "projects/<projektname>" --silence-threshold 0.4
```

Auf **Windows** muss vorher `PYTHONUTF8=1` gesetzt werden, sonst `UnicodeEncodeError` beim Schreiben des `≥`-Zeichens:

```powershell
$env:PYTHONUTF8 = "1"; uv run --project ./video-use python `
  ./video-use/helpers/pack_transcripts.py --edit-dir "projects/<projektname>" `
  --silence-threshold 0.4
```

**2. Silence-Map auf Source erzeugen:**

```bash
ffmpeg -hide_banner -nostats -i raw/<projekt>/<file>.mp4 \
  -af "silencedetect=noise=-30dB:duration=0.25" -f null - 2>&1 | grep "silence_"
```

**3. Sub-Slice fuer Versprecher-Verifikation oder letzten-Wort-Re-Scribe:**

Audio extrahieren:
```bash
ffmpeg -y -hide_banner -nostats -i raw/<projekt>/<file>.mp4 \
  -ss <start_sec> -to <end_sec> -vn -ac 1 -ar 16000 -c:a pcm_s16le \
  /tmp/_slice.wav
```

An Scribe schicken (curl):
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

Die zurueckgegebenen Slice-Word-Times sind relativ zum Slice-Start — addiere `<start_sec>` um Original-Timeline zu bekommen.

**4. Cut-Render (video-use):**

```bash
uv run --project ./video-use python ./video-use/helpers/render.py \
  projects/<projekt>/edl.json -o projects/<projekt>/clips/edited.mp4
```

**5. Speaker-Video Keyframe-Conversion (PFLICHT vor Bundle-Render):**

```bash
ffmpeg -i projects/<projekt>/clips/edited.mp4 \
  -c:v libx264 -preset fast -crf 18 \
  -g 1 -keyint_min 1 -sc_threshold 0 \
  -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k \
  projects/<projekt>/assets/speaker.mp4
```

### Windows-Hinweise

- `PYTHONUTF8=1` setzen vor jedem `uv run python ./video-use/helpers/...` — sonst Encoding-Crashes bei Unicode-Zeichen.
- `grade: "auto"` in der EDL ist auf Windows derzeit broken (ffmpeg-Filter-Parser kollidiert mit `C:\` Pfaden im `metadata=print:file=...`-Argument). **Workaround:** `grade: null` setzen — funktioniert, Source-Bild ist meist eh sauber genug.
- ffprobe / silencedetect Output kommt auf stderr; in PowerShell mit `2>&1 | Select-String "silence_"` filtern.
- `Start-Process projects\...\clips\edited.mp4` oeffnet das Video im Default-Player zur Review.

---

## Referenzen

- Hyperframes Docs: https://hyperframes.heygen.com/quickstart
- Hyperframes Catalog (50+ Blocks): https://hyperframes.heygen.com/catalog/blocks/data-chart
- Video-Use SKILL.md: https://github.com/browser-use/video-use/blob/main/SKILL.md
- Hyperframes Student-Kit (12 fertige Beispiele): https://github.com/nateherkai/hyperframes-student-kit

---

## Was am Ende stimmen muss

1. `npx hyperframes doctor` läuft grün (außer Docker — egal).
2. `.claude/skills/` enthält 4 Junctions/Symlinks: `hyperframes`, `gsap`, `hyperframes-cli`, `video-use`.
3. `./video-use/` ist geklont und hat eine funktionierende `.venv` (geprüft via `uv run --project ./video-use python -c "import video_use"`).
4. `./.env` und `./video-use/.env` enthalten beide den ElevenLabs-Key (oder beide leer mit klarem Hinweis).
5. `package.json` enthält `puppeteer-core` (sonst crasht der Bundle-Render).
6. Nutzer kann eine Roh-MP4 in `raw/` legen und der Workflow startet bei *"Edit @raw/..."*.
