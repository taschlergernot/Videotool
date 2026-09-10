import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { getAssetPreviewUrl } from "@/lib/videoUrl";
import { isImageFilename } from "@/lib/constants";

export default async function MediaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: assets, error } = await supabase
    .from("project_assets")
    .select("*, projects(name, slug)")
    .order("uploaded_at", { ascending: false });

  const assetsWithUrls = await Promise.all(
    (assets ?? []).map(async (asset) => ({
      ...asset,
      previewUrl: await getAssetPreviewUrl(supabase, asset),
      isImage: isImageFilename(asset.filename),
    }))
  );

  return (
    <main className="mx-auto max-w-4xl p-6">
      <Nav />

      <h1 className="mb-6 text-xl font-semibold">Fertige Videos</h1>

      {error && <p className="text-sm text-red-400">Konnte nicht geladen werden.</p>}

      {assetsWithUrls.length === 0 && (
        <p className="text-sm text-white/40">Noch keine hochgeladenen Dateien.</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {assetsWithUrls.map((asset) => {
          const project = asset.projects as { name: string; slug: string } | null;
          const date = new Date(asset.uploaded_at).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });

          return (
            <div key={asset.id} className="card">
              {asset.previewUrl ? (
                <VideoThumbnail
                  url={asset.previewUrl}
                  isImage={asset.isImage}
                  label={asset.filename}
                  size={undefined}
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg bg-black/20 text-xs text-red-400">
                  Link fehlt
                </div>
              )}
              <p className="mt-2 truncate text-sm font-medium" title={asset.filename}>
                {asset.filename}
              </p>
              {project && (
                <Link
                  href={`/projects/${project.slug}`}
                  className="text-xs text-white/50 hover:text-white/80 hover:underline"
                >
                  {project.name}
                </Link>
              )}
              <p className="text-xs text-white/30">{date}</p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
