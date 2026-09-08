import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { NewProjectForm } from "@/components/NewProjectForm";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { VIDEO_BUCKET, isImageFilename } from "@/lib/constants";

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
    .select("slug, name, video_filename, video_storage_path, created_at")
    .order("created_at", { ascending: false });

  const storagePaths = (projects ?? [])
    .map((p) => p.video_storage_path)
    .filter((path): path is string => Boolean(path));

  const previewUrls = new Map<string, string>();
  if (storagePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrls(storagePaths, 60 * 60);
    signed?.forEach((entry) => {
      if (entry.signedUrl && !entry.error) {
        previewUrls.set(entry.path ?? "", entry.signedUrl);
      }
    });
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
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

      {projects?.length === 0 && (
        <p className="text-sm text-white/40">Noch keine Projekte -- leg oben eins an.</p>
      )}

      {projects && projects.length > 0 && (
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
              {projects.map((p) => {
                const previewUrl = p.video_storage_path
                  ? previewUrls.get(p.video_storage_path)
                  : undefined;
                const isImage = p.video_filename ? isImageFilename(p.video_filename) : false;
                const date = new Date(p.created_at).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });

                return (
                  <tr key={p.slug} className="border-b border-white/5 last:border-0">
                    <td className="p-3">
                      {previewUrl ? (
                        <VideoThumbnail url={previewUrl} isImage={isImage} label={p.name} size={200} />
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
                          p.video_storage_path
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/10 text-white/50"
                        }`}
                      >
                        {p.video_storage_path ? "hochgeladen" : "leer"}
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
