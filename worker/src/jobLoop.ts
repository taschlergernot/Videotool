import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAgentLeg } from "./claudeAgent.js";
import { downloadPrimaryVideo, downloadSelectedMusic } from "./downloadAsset.js";

const RENDER_PATH_PATTERN = /RENDER_PATH:\s*(.+)/;

function buildInitialPrompt(rawVideoRelativePath: string, musicRelativePath: string | null): string {
  // Nutzer hat am 2026-09-10 explizit fuer dieses Projekt 16:9 statt des
  // CLAUDE.md-9:16-Defaults verlangt ("es ist alles im querformat brauche
  // aber 16:9"). Kein globaler Default-Wechsel -- nur dieser eine Auftrag.
  const formatOverride = rawVideoRelativePath.includes("wohnung-schwarzau")
    ? " WICHTIG: Fuer dieses Projekt rendere in 16:9 (1920x1080), NICHT im 9:16-Standard aus " +
      "CLAUDE.md -- der Nutzer hat das fuer dieses Projekt am 2026-09-10 explizit verlangt."
    : "";

  const musicStep = musicRelativePath
    ? ` Unter ${musicRelativePath} liegt die vom Nutzer in der Web-App ausgewaehlte Hintergrundmusik ` +
      `fuer dieses Projekt -- lege sie beim finalen Render leise unter das Video (deutlich leiser als ` +
      `jede Sprache/Stimme im Video, sauber ein-/ausgeblendet, nicht laenger als das Video selbst).`
    : "";

  return (
    `Fuehre fuer ${rawVideoRelativePath} den video-use-Teil des CLAUDE.md-Workflows aus: ` +
    `transkribiere (ElevenLabs Scribe), erkenne Fuellwoerter und Versprecher, baue die EDL ` +
    `mit _padding_params, hole die Cut-Plan-Bestaetigung ueber den in deinem System-Prompt ` +
    `beschriebenen Checkpoint-Mechanismus (Write nach .worker_checkpoints/<jobId>/cut_plan.json) ` +
    `ein, render dann, und hole danach die Self-Eval-Bestaetigung genauso ein (self_eval.json). ` +
    `Beende den Auftrag nach dem Self-Eval-Checkpoint -- keine Hyperframes-Compositions in ` +
    `diesem Lauf.${formatOverride}${musicStep} Schreib als letzte Zeile deiner Abschluss-Nachricht ` +
    `exakt "RENDER_PATH: <Pfad>" mit dem Pfad der fertig geschnittenen Datei relativ zum Projekt-Root.`
  );
}

async function handleOutcome(
  supabase: SupabaseClient,
  jobId: string,
  outcome: Awaited<ReturnType<typeof runAgentLeg>>
): Promise<void> {
  if (outcome.kind === "deferred") {
    // job_checkpoints-Insert + jobs.status='awaiting_approval' ist schon im
    // Hook passiert (checkpointHook.ts) -- hier nur noch die Session-ID sichern.
    await supabase.from("jobs").update({ claude_session_id: outcome.sessionId }).eq("id", jobId);
    return;
  }

  if (outcome.kind === "completed") {
    const match = outcome.summary.match(RENDER_PATH_PATTERN);
    await supabase
      .from("jobs")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        result_summary_de: outcome.summary,
        result_video_path: match ? match[1].trim() : null,
        cost_usd_estimate: outcome.costUsd,
      })
      .eq("id", jobId);
    return;
  }

  await supabase
    .from("jobs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: outcome.message,
    })
    .eq("id", jobId);
}

async function tryClaimAndStartJob(supabase: SupabaseClient, workerPid: string): Promise<boolean> {
  const { data: job, error } = await supabase
    .rpc("claim_next_job", { worker_pid_param: workerPid })
    .single();

  if (error) {
    console.error("[worker] claim_next_job fehlgeschlagen:", error.message);
    return false;
  }
  if (!job) {
    return false;
  }

  const jobRow = job as { id: string; project_id: string; owner_id: string };

  const { data: project } = await supabase
    .from("projects")
    .select("slug, music_track_id")
    .eq("id", jobRow.project_id)
    .single();

  if (!project) {
    await supabase
      .from("jobs")
      .update({ status: "failed", error_message: "Projekt nicht gefunden." })
      .eq("id", jobRow.id);
    return true;
  }

  let downloaded: Awaited<ReturnType<typeof downloadPrimaryVideo>>;
  try {
    downloaded = await downloadPrimaryVideo(supabase, jobRow.project_id, project.slug);
  } catch (err) {
    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error_message: `Download der Video-Datei fehlgeschlagen: ${
          err instanceof Error ? err.message : String(err)
        }`,
      })
      .eq("id", jobRow.id);
    return true;
  }

  if (!downloaded) {
    await supabase
      .from("jobs")
      .update({ status: "failed", error_message: "Projekt hat keine Video-Datei zum Bearbeiten." })
      .eq("id", jobRow.id);
    return true;
  }

  let musicPath: string | null = null;
  if (project.music_track_id) {
    try {
      const music = await downloadSelectedMusic(supabase, project.music_track_id);
      musicPath = music?.relativePath ?? null;
    } catch (err) {
      // Fehlende/kaputte Musik soll den Auftrag nicht blockieren -- Video-Schnitt
      // ist die Pflicht, Hintergrundmusik ist ein Extra.
      console.error(`[worker] Musik-Download fehlgeschlagen (wird ohne Musik fortgesetzt): ${
        err instanceof Error ? err.message : String(err)
      }`);
    }
  }

  const sessionId = randomUUID();
  const rawPath = downloaded.rawRelativePath;

  await supabase
    .from("jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      claude_session_id: sessionId,
    })
    .eq("id", jobRow.id);

  console.log(`[worker] Job ${jobRow.id} gestartet (${rawPath}, lokal heruntergeladen)`);

  const outcome = await runAgentLeg({
    supabase,
    jobId: jobRow.id,
    ownerId: jobRow.owner_id,
    prompt: buildInitialPrompt(rawPath, musicPath),
    sessionId,
    resume: false,
  });

  console.log(`[worker] Job ${jobRow.id} Etappe beendet: ${outcome.kind}`);
  await handleOutcome(supabase, jobRow.id, outcome);
  return true;
}

async function tryResumeAwaitingJob(supabase: SupabaseClient): Promise<boolean> {
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, claude_session_id, owner_id")
    .eq("status", "awaiting_approval")
    .order("updated_at", { ascending: true })
    .limit(5);

  if (!jobs || jobs.length === 0) {
    return false;
  }

  for (const job of jobs as { id: string; claude_session_id: string | null; owner_id: string }[]) {
    const { data: checkpoint } = await supabase
      .from("job_checkpoints")
      .select("*")
      .eq("job_id", job.id)
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!checkpoint || checkpoint.status === "pending") {
      continue; // noch keine Entscheidung -- naechster Job in der Liste
    }

    if (!job.claude_session_id) {
      await supabase
        .from("jobs")
        .update({ status: "failed", error_message: "Keine Session-ID zum Fortsetzen vorhanden." })
        .eq("id", job.id);
      return true;
    }

    if (checkpoint.status === "rejected") {
      // Bewusst NICHT resumen -- siehe claudeAgent.ts: ein bekannter SDK-Bug
      // (Python-In-Process-Hooks) laesst den PreToolUse-Hook beim Resume
      // manchmal nicht erneut feuern. Statt uns auf ein zuverlaessiges
      // "deny" beim Fortsetzen zu verlassen, resumen wir eine Ablehnung
      // gar nicht -- der Job endet direkt.
      const note = (checkpoint.decision_payload as { note?: string } | null)?.note;
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: `Checkpoint abgelehnt: ${note ?? "kein Grund angegeben"}`,
        })
        .eq("id", job.id);
      return true;
    }

    // approved / edited -- fortsetzen.
    await supabase.from("jobs").update({ status: "running" }).eq("id", job.id);
    console.log(`[worker] Job ${job.id} wird nach Freigabe fortgesetzt (Session ${job.claude_session_id})`);

    const outcome = await runAgentLeg({
      supabase,
      jobId: job.id,
      ownerId: job.owner_id,
      prompt: "",
      sessionId: job.claude_session_id,
      resume: true,
    });

    console.log(`[worker] Job ${job.id} Etappe beendet: ${outcome.kind}`);
    await handleOutcome(supabase, job.id, outcome);
    return true;
  }

  return false;
}

export async function tick(supabase: SupabaseClient, workerPid: string): Promise<void> {
  const resumed = await tryResumeAwaitingJob(supabase);
  if (resumed) return;

  await tryClaimAndStartJob(supabase, workerPid);
}
