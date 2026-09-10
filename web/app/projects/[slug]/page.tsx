import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "@/components/UploadForm";
import { CopyButton } from "@/components/CopyButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CheckpointApproval } from "@/components/CheckpointApproval";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { startAutomatedJob } from "@/app/projects/actions";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { getAssetPreviewUrl } from "@/lib/videoUrl";
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

  const { data: assets } = await supabase
    .from("project_assets")
    .select("*")
    .eq("project_id", project.id)
    .order("uploaded_at", { ascending: true });

  const assetsWithUrls = await Promise.all(
    (assets ?? []).map(async (asset) => ({
      ...asset,
      previewUrl: await getAssetPreviewUrl(supabase, asset, 60 * 60 * 24),
      isImage: isImageFilename(asset.filename),
    }))
  );

  // Der automatische Worker (Phase 1) und der manuelle Fallback-Prompt
  // arbeiten mit genau einer Video-Datei -- das erste hochgeladene Video
  // (nicht Bild) im Projekt gilt als die primaere Datei dafuer.
  const primaryVideo = assetsWithUrls.find((a) => !a.isImage);

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

  const downloadStep = primaryVideo?.previewUrl
    ? `Lade zuerst die Datei von ${primaryVideo.previewUrl} nach raw/${slug}/${primaryVideo.filename} ` +
      `herunter (PowerShell: New-Item -ItemType Directory -Force raw\\${slug} | Out-Null; ` +
      `Invoke-WebRequest -Uri "${primaryVideo.previewUrl}" -OutFile "raw\\${slug}\\${primaryVideo.filename}").`
    : "";

  const startPrompt = primaryVideo
    ? `${downloadStep} Starte danach die automatische Bearbeitung: transkribiere automatisch ` +
      `(ElevenLabs Scribe), erkenne Fuellwoerter und Versprecher, schneide automatisch, brenne ` +
      `die erkannte Sprache als Untertitel, und baue anschliessend Animationen mit Hyperframes ` +
      `-- mit Brand default. Halte dich dabei an die Pflicht-Checkpoints aus CLAUDE.md ` +
      `(Cut-Plan-Bestaetigung auf Deutsch vor dem Schnitt, Storyboard-Freigabe vor den ` +
      `Compositions, Self-Eval nach dem Render).`
    : "";

  return (
    <main className="mx-auto max-w-2xl p-6">
      {jobIsActive && <AutoRefresh />}

      <a href="/" className="text-sm text-white/50 hover:text-white/80">
        ← Projekte
      </a>
      <div className="mb-6 mt-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <DeleteProjectButton slug={slug} projectName={project.name} className="btn-secondary" />
      </div>

      <div className="space-y-6">
        <UploadForm slug={slug} />

        {assetsWithUrls.length > 0 && (
          <div className="card">
            <p className="label !mb-3">Dateien ({assetsWithUrls.length})</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {assetsWithUrls.map((asset) =>
                asset.previewUrl ? (
                  <div key={asset.id}>
                    <VideoThumbnail
                      url={asset.previewUrl}
                      isImage={asset.isImage}
                      label={asset.filename}
                      size={140}
                    />
                    <p className="mt-1 truncate text-xs text-white/40" title={asset.filename}>
                      {asset.filename}
                    </p>
                  </div>
                ) : (
                  <div
                    key={asset.id}
                    className="flex h-[140px] w-[140px] items-center justify-center rounded-lg bg-black/20 text-xs text-red-400"
                  >
                    Link fehlt
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {primaryVideo && (
          <div className="card space-y-4">
            <div>
              <p className="text-base font-semibold">Automatischer Video-Bearbeitungs-Worker</p>
              <p className="mt-1 text-sm text-white/50">
                Arbeitet mit <span className="text-white/70">{primaryVideo.filename}</span> (erstes
                Video im Projekt). Ein lokaler Prozess auf deinem Rechner transkribiert, erkennt
                Versprecher, schneidet und rendert automatisch -- fuer die Pflicht-Checkpoints
                (Cut-Plan-Bestaetigung, Self-Eval) bekommst du hier eine Freigabe-Anfrage. Nutzt
                echtes Claude-API- und ElevenLabs-Kontingent, sobald ein Auftrag laeuft -- nicht
                im Claude-Code-Abo enthalten.
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

            {job?.status === "failed" && <p className="text-sm text-red-400">{job.error_message}</p>}

            {job?.status === "done" && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-3">
                <p className="text-sm font-medium text-emerald-300">Fertig</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">
                  {job.result_summary_de}
                </p>
                {job.result_video_path && (
                  <p className="mt-2 text-xs text-white/40">Lokale Datei: {job.result_video_path}</p>
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

        {primaryVideo && (
          <div className="card space-y-4">
            <div>
              <p className="text-base font-semibold">Manueller Modus (Fallback)</p>
              <p className="mt-1 text-sm text-white/50">
                Kopiert den kompletten Auftrag fuer <span className="text-white/70">{primaryVideo.filename}</span> zum
                manuellen Einfuegen in eine lokale Claude-Code-Chat-Session, falls du nicht auf
                den automatischen Worker warten willst.
              </p>
            </div>

            <CopyButton
              text={startPrompt}
              label="Auftrag kopieren"
              copiedLabel="✓ Kopiert -- jetzt in Claude Code einfuegen"
              className="btn-secondary w-full"
            />

            <details className="text-sm text-white/50">
              <summary className="cursor-pointer hover:text-white/70">Auftrag anzeigen</summary>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-white/80">
                {startPrompt}
              </pre>
            </details>
          </div>
        )}
      </div>
    </main>
  );
}
