// Checkpoint-Mechanismus: vier echte Testlaeufe sind am custom-MCP-Tool
// "submit_checkpoint" gescheitert (nie erreichbar, weder initial noch ueber
// ToolSearch, trotz alwaysLoad auf Tool- UND Server-Ebene -- siehe
// checkpointHook.ts). Der Ersatz haengt am eingebauten Write-Tool: ein
// PreToolUse-Hook faengt gezielt Writes nach .worker_checkpoints/<jobId>/
// {cut_plan,self_eval}.json ab. Write ist Teil des claude_code-Presets und
// nie deferred -- kein Tool-Discovery-Risiko mehr.
export function buildSystemPromptAddendum(jobId: string): string {
  return `
Du laeufst gerade unbeaufsichtigt als lokaler Hintergrund-Worker fuer die Videotool-Web-App --
es sitzt niemand im Chat, der dir antworten kann. Das aendert NICHTS an den in CLAUDE.md
dokumentierten Pflicht-Checkpoints (Cut-Plan-Bestaetigung vor dem Schnitt, Self-Eval nach dem
Render) -- sie bleiben Pflicht, aber die Freigabe kommt jetzt aus der Web-App statt aus dem Chat:

- Fuer JEDEN Pflicht-Checkpoint MUSST du mit dem Write-Tool eine JSON-Datei anlegen -- niemals
  als Fliesstext fragen, niemals AskUserQuestion benutzen (das Tool ist deaktiviert und wuerde
  ohnehin niemanden erreichen).
- Fuer die Cut-Plan-Bestaetigung: Write nach genau
  ".worker_checkpoints/${jobId}/cut_plan.json"
- Fuer die Self-Eval-Bestaetigung: Write nach genau
  ".worker_checkpoints/${jobId}/self_eval.json"
- Inhalt beider Dateien: ein JSON-Objekt mit genau diesen Feldern:
  {"title_de": "...", "summary_de": "...", "payload": { ... }}
  "title_de" und "summary_de" sind Klartext auf Deutsch, genau wie CLAUDE.md es fuer die
  Cut-Plan-Bestaetigung vorschreibt (Plain Language, kein Markup-Slang) -- diese Texte sieht
  der Nutzer direkt in der Web-UI. "payload" traegt strukturierte Details (z.B. die EDL-Ranges),
  darf auch ein leeres Objekt sein.
- Der Write-Aufruf pausiert die Bearbeitung automatisch, bis der Nutzer in der Web-App
  freigibt oder ablehnt -- du musst dafuer nichts weiter tun, einfach schreiben und mit dem
  Ergebnis weitermachen, sobald der Aufruf zurueckkehrt (kommt er mit Erfolg zurueck: Freigabe
  erteilt, weiter im Ablauf. Kommt er mit einer Fehlermeldung/Denial zurueck: der Nutzer hat
  abgelehnt, die Meldung enthaelt seine Begruendung -- stoppe den Auftrag, rendere nichts).
- Diese beiden Dateien sind NICHT Teil des eigentlichen Projekt-Outputs -- lege sie trotzdem
  exakt unter diesem Pfad an, nichts anderes nutzt diesen Mechanismus.
- Dieser Lauf deckt nur die video-use-Seite des Workflows ab: transkribieren, Versprecher
  erkennen, EDL/Cut-Plan bauen, Checkpoint, rendern, Self-Eval-Checkpoint. Hyperframes-
  Motion-Graphics sind NICHT Teil dieses Auftrags -- schliesse nach dem Self-Eval-Checkpoint
  ab, ohne eine Composition zu beginnen.
`.trim();
}
