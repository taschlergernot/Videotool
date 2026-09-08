import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "@/components/UploadForm";
import { CopyButton } from "@/components/CopyButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CheckpointApproval } from "@/components/CheckpointApproval";
import { startAutomatedJob } from "@/app/projects/actions";
import { getProjectPreviewUrl } from "@/lib/videoUrl";
import { isImageFilename } from "@/lib/constants";

const JOB_STATUS_LABELS: Record<string, string> = {
  queued: "In der Warteschlange",
  claimed: "Wird abgeholt",
  running: "Läuft",
  awaiting_approval: "Wartet auf deine Freigabe",
  done: "Fertig",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
};

const ACTIVE_JOB_STATUSES = ["queued", "claimed", "running", "awaiting_approval"];

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!project) {
    notFound();
  }

  const hasVideo = Boolean(project.video_storage_path || project.video_r2_key);
  const isImage = hasVideo && isImageFilename(project.video_filename ?? "");

  const signedUrl = hasVideo ? await getProjectPreviewUrl(supabase, project, 60 * 60 * 24) : null;

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let pendingCheckpoint: {
    id: string;
    type: string;
    title_de: string;
    summary_de: string;
    payload: unknown;
  } | null = null;

  if (job?.status === "awaiting_approval") {
    const { data } = await supabase
      .from("job_checkpoints")
      .select("*")
      .eq("job_id", job.id)
      .eq("status", "pending")
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    pendingCheckpoint = data;
  }

  const jobIsActive = job ? ACTIVE_JOB_STATUSES.includes(job.status) : false;

  const downloadStep = signedUrl
    ? `Lade zuerst die Datei von ${signedUrl} nach raw/${slug}/${project.video_filename} herunter ` +
      `(PowerShell: New-Item -ItemType Directory -Force raw\\${slug} | Out-Null; ` +
      `Invoke-WebRequest -Uri "${signedUrl}" -OutFile "raw\\${slug}\\${project.video_filename}").`
    : "";

  const startPrompt = isImage
    ? `${downloadStep} Nutze die Datei anschliessend als Bildmaterial fuer eine Animation mit Brand default.`
    : `${downloadStep} Starte danach die automatische Bearbeitung: transkribiere automatisch ` +
      `(ElevenLabs Scribe), erkenne Fuellwoerter und Versprecher, schneide automatisch, brenne ` +
      `die erkannte Sprache als Untertitel, und baue anschliessend Animationen mit Hyperframes ` +
      `-- mit Brand default. Halte dich dabei an die Pflicht-Checkpoints aus CLAUDE.md ` +
      `(Cut-Plan-Bestaetigung auf Deutsch vor dem Schnitt, Storyboard-Freigabe vor den ` +
      `Compositions, Self-Eval nach dem Render).`;

  return (
    <main className="mx-auto max-w-2xl p-6">
      {jobIsActive && <AutoRefresh />}

      <a href="/" className="text-sm text-white/50 hover:text-white/80">
        ← Projekte
      </a>
      <h1 className="mb-6 mt-2 text-xl font-semibold">{project.name}</h1>

      {!hasVideo && <UploadForm slug={slug} />}

      {hasVideo && signedUrl && (
        <div className="space-y-6">
          <div className="card">
            <p className="text-sm text-white/50">{isImage ? "Bild" : "Video"}</p>
            <p className="mt-1 font-medium">{project.video_filename}</p>
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrl}
                alt={project.name}
                className="mt-3 max-h-96 w-full rounded-lg bg-black/20 object-contain"
              />
            ) : (
              <video
                src={signedUrl}
                controls
                preload="metadata"
                className="mt-3 w-full rounded-lg bg-black/20"
              />
            )}
          </div>

          {!isImage && (
            <div className="card space-y-4">
              <div>
                <p className="text-base font-semibold">Automatischer Video-Bearbeitungs-Worker</p>
                <p className="mt-1 text-sm text-white/50">
                  Ein lokaler Prozess auf deinem Rechner transkribiert, erkennt Versprecher,
                  schneidet und rendert automatisch -- fuer die Pflicht-Checkpoints (Cut-Plan-
                  Bestaetigung, Self-Eval) bekommst du hier eine Freigabe-Anfrage. Nutzt echtes
                  Claude-API- und ElevenLabs-Kontingent, sobald ein Auftrag laeuft -- nicht im
                  Claude-Code-Abo enthalten.
                </p>
              </div>

              {!job || !jobIsActive ? (
                <form action={startAutomatedJob.bind(null, slug)}>
                  <button type="submit" className="btn w-full py-3 text-base">
                    ▶ Automatische Bearbeitung starten
                  </button>
                </form>
              ) : (
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <span className="badge bg-blue-500/15 text-blue-300">
                    {JOB_STATUS_LABELS[job.status] ?? job.status}
                  </span>
                  {job.phase && <p className="mt-2 text-sm text-white/50">{job.phase}</p>}
                </div>
              )}

              {job?.status === "failed" && (
                <p className="text-sm text-red-400">{job.error_message}</p>
              )}

              {job?.status === "done" && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-3">
                  <p className="text-sm font-medium text-emerald-300">Fertig</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">
                    {job.result_summary_de}
                  </p>
                  {job.result_video_path && (
                    <p className="mt-2 text-xs text-white/40">
                      Lokale Datei: {job.result_video_path}
                    </p>
                  )}
                </div>
              )}

              {pendingCheckpoint && (
                <CheckpointApproval
                  checkpointId={pendingCheckpoint.id}
                  slug={slug}
                  type={pendingCheckpoint.type}
                  titleDe={pendingCheckpoint.title_de}
                  summaryDe={pendingCheckpoint.summary_de}
                  payload={pendingCheckpoint.payload}
                />
              )}
            </div>
          )}

          <div className="card space-y-4">
            <div>
              <p className="text-base font-semibold">
                {isImage ? "Bild-Animation starten" : "Manueller Modus (Fallback)"}
              </p>
              <p className="mt-1 text-sm text-white/50">
                {isImage
                  ? "Kopiert den Befehl fuer Claude Code -- Download und Animation in einem Schritt."
                  : "Kopiert den kompletten Auftrag zum manuellen Einfuegen in eine lokale " +
                    "Claude-Code-Chat-Session, falls du nicht auf den automatischen Worker " +
                    "warten willst."}
              </p>
            </div>

            <CopyButton
              text={startPrompt}
              label={isImage ? "▶ Bild-Animation starten" : "Auftrag kopieren"}
              copiedLabel="✓ Kopiert -- jetzt in Claude Code einfuegen"
              className={isImage ? "btn w-full py-3 text-base" : "btn-secondary w-full"}
            />

            <details className="text-sm text-white/50">
              <summary className="cursor-pointer hover:text-white/70">Auftrag anzeigen</summary>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-white/80">
                {startPrompt}
              </pre>
            </details>
          </div>
        </div>
      )}

      {hasVideo && !signedUrl && (
        <p className="text-sm text-red-400">
          Download-Link konnte nicht erzeugt werden -- Seite neu laden oder spaeter erneut
          versuchen.
        </p>
      )}
    </main>
  );
}
