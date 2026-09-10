import { redirect } from "next/navigation";
import { marked } from "marked";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { BrandFrameEditor } from "@/components/BrandFrameEditor";
import { parseBrandColors, parseBrandFonts, parseGoogleFontsUrl } from "@/lib/brandFrame";

const FRAME_NAME = "default";

export default async function BrandPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: frame } = await supabase
    .from("brand_frames")
    .select("*")
    .eq("owner_id", user.id)
    .eq("name", FRAME_NAME)
    .maybeSingle();

  const content = frame?.content ?? "";
  const colors = parseBrandColors(content);
  const fonts = parseBrandFonts(content);
  const googleFontsUrl = parseGoogleFontsUrl(content);
  const html = content ? await marked.parse(content) : "";

  return (
    <main className="mx-auto max-w-3xl p-6">
      {googleFontsUrl && <link rel="stylesheet" href={googleFontsUrl} />}

      <Nav />

      <h1 className="mb-1 text-xl font-semibold">Brand</h1>
      <p className="mb-6 text-sm text-white/50">
        frame.md fuer Hyperframes -- Farben, Schriftarten und Design-Regeln fuer diese Brand.
        Der lokale Hyperframes-Prozess liest weiterhin aus{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 text-xs">brand-guidelines/</code> auf der
        Platte -- hier ist der Ablage- und Vorschau-Ort in der Web-App.
      </p>

      <div className="space-y-6">
        <BrandFrameEditor name={FRAME_NAME} initialContent={content} />

        {content.length === 0 && (
          <p className="text-sm text-white/40">
            Noch kein frame.md hinterlegt -- oben hochladen oder einfuegen und speichern.
          </p>
        )}

        {colors.length > 0 && (
          <div className="card">
            <p className="label !mb-3">Farben</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {colors.map((c) => (
                <div key={c.name} className="flex items-center gap-3 rounded-lg border border-white/10 p-2">
                  <div
                    className="h-10 w-10 shrink-0 rounded-md border border-white/15"
                    style={{ backgroundColor: c.hex }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white/90">--{c.name}</p>
                    <p className="font-mono text-xs text-white/50">{c.hex}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {fonts.length > 0 && (
          <div className="card">
            <p className="label !mb-3">Schriftarten</p>
            <div className="space-y-4">
              {fonts.map((f) => (
                <div key={f.name} className="rounded-lg border border-white/10 p-3">
                  <p className="mb-1 text-xs font-medium text-white/50">
                    --{f.name} <span className="text-white/30">— {f.stack}</span>
                  </p>
                  <p
                    className="text-2xl text-white"
                    style={{ fontFamily: f.family ? `"${f.family}", ${f.stack}` : f.stack }}
                  >
                    Aa Bb Cc — Wohnung in Schwarzau
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {html && (
          <div className="card">
            <p className="label !mb-3">Design-Definitionen (frame.md)</p>
            <div className="md-content" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        )}
      </div>
    </main>
  );
}
