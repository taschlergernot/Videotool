import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { getAssetPreviewUrl } from "@/lib/videoUrl";
import { isImageFilename } from "@/lib/constants";
import { formatDuration, formatDimensions } from "@/lib/formatMedia";

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
    <main className="mx-auto max-w-5xl p-6">
      <Nav />

      <h1 className="mb-6 text-xl font-semibold">Fertige Videos</h1>

      {error && <p className="text-sm text-red-400">Konnte nicht geladen werden.</p>}

      {assetsWithUrls.length === 0 && (
        <p className="text-sm text-white/40">Noch keine hochgeladenen Dateien.</p>
      )}

      {assetsWithUrls.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-white/50">
                <th className="p-3 font-medium">Vorschau</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Projekt</th>
                <th className="p-3 font-medium">Dauer</th>
                <th className="p-3 font-medium">Format</th>
                <th className="p-3 font-medium">Datum</th>
              </tr>
            </thead>
            <tbody>
              {assetsWithUrls.map((asset) => {
                const project = asset.projects as { name: string; slug: string } | null;
                const date = new Date(asset.uploaded_at).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });

                return (
                  <tr key={asset.id} className="border-b border-white/5 last:border-0">
                    <td className="p-3">
                      {asset.previewUrl ? (
                        <VideoThumbnail
                          url={asset.previewUrl}
                          isImage={asset.isImage}
                          label={asset.filename}
                          size={96}
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-black/20 text-xs text-red-400">
                          Link fehlt
                        </div>
                      )}
                    </td>
                    <td className="p-3 align-top font-medium" title={asset.filename}>
                      {asset.filename}
                    </td>
                    <td className="p-3 align-top text-white/60">
                      {project ? (
                        <Link href={`/projects/${project.slug}`} className="hover:underline">
                          {project.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 align-top text-white/60">
                      {asset.isImage ? "—" : formatDuration(asset.duration_seconds)}
                    </td>
                    <td className="p-3 align-top text-white/60">
                      {formatDimensions(asset.width, asset.height)}
                    </td>
                    <td className="p-3 align-top text-white/60">{date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
