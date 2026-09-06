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

  const downloadCommand = signedUrl
    ? `New-Item -ItemType Directory -Force raw\\${slug} | Out-Null\nInvoke-WebRequest -Uri "${signedUrl}" -OutFile "raw\\${slug}\\${project.video_filename}"`
    : "";

  const isImage = hasVideo && isImageFilename(project.video_filename ?? "");

  const editPrompt = isImage
    ? `Nutze @raw/${slug}/${project.video_filename} als Bildmaterial fuer eine Animation mit Brand default.`
    : `Edit @raw/${slug}/${project.video_filename} in eine Folge mit Brand default.`;

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

          <div className="card space-y-3">
            <p className="label !mb-0">1. Lokal herunterladen (PowerShell, im Projekt-Root)</p>
            <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-white/80">
              {downloadCommand}
            </pre>
            <CopyButton text={downloadCommand} />
          </div>

          <div className="card space-y-3">
            <p className="label !mb-0">2. In Claude Code einfuegen</p>
            <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-white/80">
              {editPrompt}
            </pre>
            <CopyButton text={editPrompt} />
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
