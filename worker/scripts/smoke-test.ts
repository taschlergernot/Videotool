// Billiger Vorab-Check, bevor teure Auftraege laufen: bestaetigt, dass
// CLAUDE.md tatsaechlich automatisch geladen wird (cwd + settingSources)
// und die Grund-Konfiguration funktioniert -- ohne Tools, ohne Checkpoints,
// nur ein einziger kurzer Turn.
import "dotenv/config";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY fehlt in worker/.env -- Abbruch.");
  process.exit(1);
}

async function main() {
  console.log("Smoke-Test: sende einen minimalen Prompt, prüfe CLAUDE.md-Autoload...");

  for await (const message of query({
    prompt:
      'Antworte NUR mit "OK" -- sag mir zusaetzlich in einem Halbsatz, ob du eine Projekt-CLAUDE.md ' +
      "im Kontext siehst und was die erste Grundregel darin ist.",
    options: {
      cwd: "C:\\Videotool",
      settingSources: ["project"],
      allowedTools: [],
      maxTurns: 1,
      maxBudgetUsd: 0.5,
    },
  }) as AsyncGenerator<SDKMessage>) {
    if (message.type === "system" && message.subtype === "init") {
      console.log("init-Message erhalten, cwd:", (message as unknown as { cwd?: string }).cwd);
    }
    if (message.type === "result") {
      console.log("--- Ergebnis ---");
      if (message.subtype === "success") {
        console.log(message.result);
        console.log(`Kosten: $${message.total_cost_usd.toFixed(4)}`);
      } else {
        console.log("Fehler:", message.errors.join("; "));
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
