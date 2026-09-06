import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { NewProjectForm } from "@/components/NewProjectForm";

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
    .select("slug, name, video_storage_path, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-3xl p-6">
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

      {error && (
        <p className="text-sm text-red-400">Projekte konnten nicht geladen werden.</p>
      )}

      <div className="space-y-2">
        {projects?.length === 0 && (
          <p className="text-sm text-white/40">Noch keine Projekte -- leg oben eins an.</p>
        )}
        {projects?.map((p) => (
          <Link
            key={p.slug}
            href={`/projects/${p.slug}`}
            className="card flex items-center justify-between transition hover:border-white/20"
          >
            <span className="font-medium">{p.name}</span>
            <span
              className={`badge ${
                p.video_storage_path
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-white/10 text-white/50"
              }`}
            >
              {p.video_storage_path ? "hochgeladen" : "leer"}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
