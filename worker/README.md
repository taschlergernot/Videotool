# Videotool Worker

Lokaler Hintergrund-Prozess, der Auftraege aus der Web-App (`web/`) automatisch abholt und
den video-use-Teil des CLAUDE.md-Workflows ausfuehrt: transkribieren, Versprecher erkennen,
schneiden, rendern -- mit den Pflicht-Checkpoints (Cut-Plan-Bestaetigung, Self-Eval) als
Freigabe-UI in der Web-App statt im Chat.

**Phase 1 -- Umfang:** nur video-use (transkribieren -> schneiden -> rendern). Hyperframes-
Motion-Graphics sind bewusst **nicht** Teil dieses Laufs, siehe
`C:\Users\tasch\.claude\plans\prancy-marinating-popcorn.md` fuer den vollen Plan inkl. Phase 2/3.

## Sicherheit: Allowlist statt bypassPermissions

Der Agent laeuft unbeaufsichtigt, bekommt aber **keinen** unbeschraenkten Shell-Zugriff.
`src/claudeAgent.ts`s `canUseTool` erlaubt nur die in CLAUDE.md dokumentierten Befehle
(ffmpeg/ffprobe, `uv run --project ./video-use ... --system-certs`, ElevenLabs-`curl`) --
alles andere wird automatisch abgelehnt.

## Einmalige Einrichtung

1. Eigenen **Anthropic-API-Key** besorgen (platform.claude.com, Pay-as-you-go --
   **nicht** dasselbe wie ein Claude-Code-Abo-Login).
2. `web/supabase/schema.sql` (falls noch nicht geschehen) im Supabase SQL-Editor ausfuehren --
   enthaelt jetzt auch `jobs`, `job_checkpoints`, `claim_next_job`.
3. Supabase **service_role**-Key holen (Project Settings -> API).
4. `worker/.env` anlegen (siehe `.env.example`):
   ```
   ANTHROPIC_API_KEY=...
   SUPABASE_URL=https://xgmuzuxtezefhblezque.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   POLL_INTERVAL_MS=5000
   ```
5. `npm install`

## Vor dem ersten echten Auftrag: Smoke-Test (billig)

```powershell
npm run smoke
```

Bestaetigt, dass `CLAUDE.md` automatisch geladen wird und die Grundkonfiguration stimmt --
ein einziger kurzer Turn, keine Tools, < $0.01.

## Laufen lassen

**Manuell (zum Testen):**
```powershell
npm run dev      # tsx watch, fuer Entwicklung
# oder
npm run build && npm start   # kompiliert + node dist/index.js
```

**Dauerhaft (Windows Scheduled Task, empfohlen fuer den Alltag):**
```powershell
npm run build
.\scripts\register-task.ps1
```

Registriert einen Task, der bei jeder Anmeldung startet und bei Fehlern automatisch neu
startet. Log liegt unter `worker\logs\worker.log`. Manuell sofort starten:
`Start-ScheduledTask -TaskName VideotoolWorker`.

## Bekannte Einschraenkung (aus der Implementierung, nicht nur Planung)

Ein offener GitHub-Issue (anthropics/claude-agent-sdk-python#993) beschreibt, dass beim
Fortsetzen einer per `defer` pausierten Session der `PreToolUse`-Hook manchmal nicht erneut
feuert (Python-SDK, In-Process-Hooks). Nicht bestaetigt fuers Node-SDK, das dieser Worker
nutzt -- aber dagegen abgesichert: **eine Ablehnung wird nie resumed**, der Job endet direkt
als `failed`. Nur Freigaben werden fortgesetzt (fuer die ist es egal, ob der Hook erneut
feuert -- der Agent soll ja ohnehin weitermachen). Deshalb gibt es in Phase 1 auch keine
"Bearbeiten"-Option, nur Freigeben/Ablehnen -- ein editierter Vorschlag waere von genau
diesem Risiko betroffen.

**Der Phase-1-Realvideo-Test muss das bestaetigen**, bevor mehr darauf aufgebaut wird:
Auftrag starten, Checkpoint freigeben, waehrend des Wartens den Worker-Prozess per
`taskkill` beenden und neu starten, pruefen dass er nach dem Neustart korrekt fortsetzt statt
haengen zu bleiben oder von vorn anzufangen.
