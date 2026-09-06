# Videotool Web

Login + Projekt-Verwaltung + Video-Upload fuer das Videotool-Repo. Baut Projekte an,
speichert Roh-Videos in Supabase Storage, und bereitet den Wechsel in die lokale
Claude-Code-Bearbeitung vor (Download-Befehl + Edit-Prompt). Die eigentliche Bearbeitung
(Transkription, Cut-Plan, Motion Graphics) passiert weiterhin lokal per Chat -- siehe
[../CLAUDE.md](../CLAUDE.md).

## Stack

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v3, Supabase Auth (E-Mail+Passwort,
kein Sign-up) + Supabase Postgres (`projects`-Tabelle) + Supabase Storage (privater
`videos`-Bucket, Resumable-Upload via TUS).

## Einmalige Supabase-Einrichtung

1. SQL-Editor im Supabase-Dashboard oeffnen (Projekt `xgmuzuxtezefhblezque`) und
   [`supabase/schema.sql`](supabase/schema.sql) ausfuehren.
2. Authentication -> Users -> **Add User** (E-Mail + Passwort) -- der einzige App-Nutzer.
   Es gibt keinen Sign-up-Flow in der App.
3. Authentication-Settings: Public Sign-ups deaktivieren, E-Mail-Bestaetigung fuer den
   manuell angelegten Nutzer nicht erforderlich machen (sonst kein Login moeglich).
4. Project Settings -> API: Project URL + anon/public Key kopieren.

## Lokale Entwicklung

```powershell
cd web
"NEXT_PUBLIC_SUPABASE_URL=<Project URL>`nNEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>" |
  Set-Content -Encoding utf8 .env.local
npm install
npm run dev
```

## Deploy (Vercel)

Bestehendes Vercel-Projekt `videotool` (bereits an dieses GitHub-Repo angebunden):

1. Settings -> General -> **Root Directory** -> `web`.
2. Settings -> Environment Variables -> `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production + Preview + Development).
   Kein Service-Role-Key noetig -- wird nirgends verwendet.
3. Redeploy ausloesen.

Falls der TUS-Upload von der Vercel-Domain aus mit einem CORS-Fehler scheitert: die
Vercel-Domain in Supabase Storage's Allowed-Origins eintragen.

## Bekannte Grenzen

- Kein Multi-User, keine Rollen, kein Passwort-Reset -- bewusst minimal fuer ein
  Ein-Personen-Tool.
- Kein automatisches TypeScript-Schema aus der DB generiert (`supabase gen types`) --
  Supabase-Query-Ergebnisse sind lose typisiert. Sobald die MCP-Session authentifiziert ist,
  liesse sich das nachruesten.
- "Bearbeitung starten" loest **keine** Verarbeitung aus -- zeigt nur den lokalen
  Download-Befehl und den Claude-Code-Prompt. Transkription/Cut/Motion-Graphics bleiben
  manueller Chat-Workflow (CLAUDE.md).
