import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "@/components/UploadForm";
import { CopyButton } from "@/components/CopyButton";
import { VIDEO_BUCKET, isImageFilename } from "@/lib/constants";

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

  const hasVideo = Boolean(project.video_storage_path);

  let signedUrl: string | null = null;
  if (hasVideo) {
    const { data } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(project.video_storage_path, 60 * 60 * 24);
    signedUrl = data?.signedUrl ?? null;
  }

  const isImage = hasVideo && isImageFilename(project.video_filename ?? "");

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
          </div>

          <div className="card space-y-4 border-blue-500/30 bg-blue-500/[0.04]">
            <div>
              <p className="text-base font-semibold">
                {isImage ? "Bild-Animation starten" : "Video-Bearbeitung starten"}
              </p>
              <p className="mt-1 text-sm text-white/50">
                {isImage
                  ? "Kopiert den Befehl fuer Claude Code -- Download und Animation in einem Schritt."
                  : "Kopiert den kompletten Auftrag fuer Claude Code: Download, Schnitt, " +
                    "Transkription, Untertitel und Hyperframes-Animationen. Die " +
                    "Pflicht-Checkpoints (Cut-Plan-Bestaetigung, Storyboard-Freigabe) bleiben " +
                    "interaktiv -- du bestaetigst sie dort auf Deutsch."}
              </p>
            </div>

            <CopyButton
              text={startPrompt}
              label={isImage ? "▶ Bild-Animation starten" : "▶ Video-Bearbeitung starten"}
              copiedLabel="✓ Kopiert -- jetzt in Claude Code einfuegen"
              className="btn w-full py-3 text-base"
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
