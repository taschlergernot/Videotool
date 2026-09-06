import "dotenv/config";
import { createServiceClient } from "./supabase.js";
import { tick } from "./jobLoop.js";

const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? 5000);
const workerPid = `${process.pid}@${new Date().toISOString()}`;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("[worker] ANTHROPIC_API_KEY fehlt in worker/.env -- Abbruch.");
  process.exit(1);
}

const supabase = createServiceClient();

console.log(`[worker] gestartet, PID-Tag ${workerPid}, Poll-Intervall ${pollIntervalMs}ms`);

let stopping = false;

async function loop(): Promise<void> {
  while (!stopping) {
    try {
      await tick(supabase, workerPid);
    } catch (err) {
      console.error("[worker] Fehler im Tick:", err instanceof Error ? err.stack : err);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

process.on("SIGINT", () => {
  console.log("[worker] SIGINT -- beende nach aktuellem Tick.");
  stopping = true;
});
process.on("SIGTERM", () => {
  console.log("[worker] SIGTERM -- beende nach aktuellem Tick.");
  stopping = true;
});

loop();
