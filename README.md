# KI Video Editing Studio

Rohvideo rein, geschnittene Folge mit Motion Graphics raus — oder reine Animationsvideos
ganz ohne Rohmaterial.

**Stack**
- [Video-Use](https://github.com/browser-use/video-use) — Schnitt, Transkription
  (ElevenLabs Scribe), Subtitles, Self-Eval
- [Hyperframes](https://hyperframes.heygen.com/quickstart) — HTML-basierte
  Motion-Graphics-Compositions mit GSAP, Render via FFmpeg

---

## Quickstart

1. **Key eintragen.** In `.env` hinter `ELEVENLABS_API_KEY=` deinen Key aus
   [elevenlabs.io](https://elevenlabs.io/app/settings/api-keys) setzen.
   Claude synct ihn dann nach `video-use/.env`.
2. **Rohvideo ablegen** unter `raw/<projektname>/take_001.mp4`.
3. **Claude sagen:**
   > *"Edit @raw/<projektname>/take_001.mp4 in eine Folge mit Brand default."*

Das war's. Claude führt dich durch Transkript → Cut-Plan → Storyboard → Render,
jeweils mit Bestätigung auf Deutsch.

---

## Beispielprompts

| Ziel | Prompt |
|---|---|
| Ganze Folge schneiden | *"Edit @raw/podcast/take_001.mp4 in eine Folge mit Brand default."* |
| Nur schneiden, keine Grafik | *"Schneide @raw/podcast/take_001.mp4 sauber, ohne Motion Graphics."* |
| Shorts-Format | *"Bau daraus einen 1080×1920 Short für die letzten 40 Sekunden."* |
| Reine Animation | *"Bau ein 30s Erklärvideo über X, Brand `brand-guidelines/meinebrand/`."* |
| Eigene Brand nutzen | *"Nutze für dieses Projekt die Brand Guidelines aus `brand-guidelines/meinebrand/`."* |
| Claude-Design-HTML aufs Video | *"Leg die HTML aus claude.ai auf das Video und sync die Timings."* |

---

## Ordnerstruktur

```
raw/<projekt>/              Rohvideos (gitignored)
projects/<projekt>/
  ├── assets/               speaker.mp4 (keyframe-converted, Pflicht für Bundle-Render)
  ├── clips/                edited.mp4 — Cut-Output von video-use
  ├── transcripts/          master.json, master.srt
  ├── compositions/         Hyperframes-HTMLs
  ├── previews/
  └── renders/              final.mp4, final-4k.mp4
brand-guidelines/
  ├── default/              Fallback-Brand
  └── <deine-brand>/        pro Kunde / Kanal
docs/                       Motion-Philosophie + Workflow-Referenz
video-use/                  geklonter Python-Cutter
.claude/skills/             Junctions zu hyperframes, gsap, hyperframes-cli, video-use
```

---

## Zwei Wege für Motion Graphics

Nach dem Cut fragt Claude, woher die HTMLs kommen. **Die zwei Wege haben unterschiedliche
Render-Engines und konvergieren nicht.**

**Direkt Hyperframes** — Claude baut die Compositions lokal im Repo, Brand kommt aus
`brand-guidelines/`. Preview: `npx hyperframes preview` (`localhost:3002`).
Render: `npx hyperframes render`.

**Claude Design (claude.ai)** — du baust die HTMLs in claude.ai, Claude gibt dir dafür nur
das Output-Transkript raus. Brand kommt dort aus dem hochgeladenen Design-Skill
(`brand-guidelines/default/SKILL.md` als Ordner hochladen). Zurückgeliefertes Bundle rendert
Claude über eine eigene Puppeteer+ffmpeg-Pipeline. `npx hyperframes preview/render`
funktioniert hier **nicht**.

---

## Commands

```bash
npm run doctor      # npx hyperframes doctor — Umgebungs-Check
npm run preview     # Hyperframes Studio auf localhost:3002
npm run render      # Hyperframes Render
```

```bash
# Transkripte packen (Phrase-Gruppierung)
uv run --project ./video-use python ./video-use/helpers/pack_transcripts.py \
  --edit-dir "projects/<projekt>" --silence-threshold 0.4

# Cut rendern
uv run --project ./video-use python ./video-use/helpers/render.py \
  projects/<projekt>/edl.json -o projects/<projekt>/clips/edited.mp4
```

Auf Windows davor `$env:PYTHONUTF8 = "1"` setzen.

---

## Troubleshooting

**`ffmpeg` nicht gefunden**
PATH-Problem. Terminal neu starten. Prüfen mit `ffmpeg -version`.
Falls weiterhin leer: `winget install Gyan.FFmpeg`, dann neues Terminal.

**`UnicodeEncodeError` bei `pack_transcripts.py`**
`$env:PYTHONUTF8 = "1"` vor dem Aufruf setzen. Betrifft nur Windows.

**ElevenLabs-Limit erreicht (429)**
Free-Tier ist knapp. Entweder warten, upgraden, oder `OPENAI_API_KEY` in `.env` setzen
und Claude auf Whisper-Fallback umschalten lassen.

**Studio-Port 3002 belegt**
Anderen Prozess beenden (`netstat -ano | findstr :3002`) oder Hyperframes auf einem
anderen Port starten.

**`[StaticGuard] Invalid HyperFrame contract`**
Du hast `hyperframes preview`/`render` auf ein Claude-Design-Bundle losgelassen.
Das geht nicht — Bundles brauchen die eigene Pipeline. Siehe
[CLAUDE.md](CLAUDE.md#claude-design-bundle-render-pipeline).

**Speaker hängt / friert im Render ein**
`assets/speaker.mp4` wurde nicht mit `-g 1` all-intra konvertiert. Siehe CLAUDE.md Punkt 4.

**`grade: "auto"` crasht auf Windows**
Bekannter ffmpeg-Filter-Parser-Bug mit `C:\`-Pfaden. `grade: null` in der `edl.json` setzen.

**Docker-Warnung im `hyperframes doctor`**
Ignorieren. Docker ist nur für sandboxed Renders, nicht für den Standard-Workflow.
