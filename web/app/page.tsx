import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { NewProjectForm } from "@/components/NewProjectForm";
import { Nav } from "@/components/Nav";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { getAssetPreviewUrl } from "@/lib/videoUrl";
import { isImageFilename } from "@/lib/constants";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, slug, name, created_at")
    .order("created_at", { ascending: false });

  const { data: allAssets } = await supabase
    .from("project_assets")
    .select("*")
    .order("uploaded_at", { ascending: true });

  const assetsByProject = new Map<string, typeof allAssets>();
  (allAssets ?? []).forEach((asset) => {
    const list = assetsByProject.get(asset.project_id) ?? [];
    list.push(asset);
    assetsByProject.set(asset.project_id, list);
  });

  const rows = await Promise.all(
    (projects ?? []).map(async (p) => {
      const assets = assetsByProject.get(p.id) ?? [];
      const first = assets[0];
      const previewUrl = first ? await getAssetPreviewUrl(supabase, first) : null;
      return {
        ...p,
        assetCount: assets.length,
        previewUrl,
        isImage: first ? isImageFilename(first.filename) : false,
      };
    })
  );

  return (
    <main className="mx-auto max-w-4xl p-6">
      <Nav />

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Projekte</h1>
          <p className="text-sm text-white/50">{user.email}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="btn-secondary">
            Abmelden
          </button>
        </form>
      </div>

      <NewProjectForm />

      {error && <p className="text-sm text-red-400">Projekte konnten nicht geladen werden.</p>}

      {rows.length === 0 && (
        <p className="text-sm text-white/40">Noch keine Projekte -- leg oben eins an.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-white/50">
                <th className="p-3 font-medium">Vorschau</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Datum</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const date = new Date(p.created_at).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });

                return (
                  <tr key={p.slug} className="border-b border-white/5 last:border-0">
                    <td className="p-3">
                      {p.previewUrl ? (
                        <VideoThumbnail url={p.previewUrl} isImage={p.isImage} label={p.name} size={200} />
                      ) : (
                        <div className="flex h-[200px] w-[200px] items-center justify-center rounded-lg bg-black/20 text-xs text-white/30">
                          kein Upload
                        </div>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <Link href={`/projects/${p.slug}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="p-3 align-top text-white/60">{date}</td>
                    <td className="p-3 align-top">
                      <span
                        className={`badge ${
                          p.assetCount > 0
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/10 text-white/50"
                        }`}
                      >
                        {p.assetCount > 0 ? `${p.assetCount} Datei${p.assetCount > 1 ? "en" : ""}` : "leer"}
                      </span>
                    </td>
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
