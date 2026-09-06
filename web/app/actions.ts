"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isReservedSlug, slugify } from "@/lib/slug";

export async function createProject(_prevState: string | undefined, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return "Bitte einen Projektnamen eingeben.";
  }

  const base = slugify(name);
  if (!base) {
    return "Der Projektname ergibt keinen gueltigen Ordnernamen (nur a-z, 0-9, Bindestrich).";
  }
  if (isReservedSlug(base)) {
    return `"${base}" ist ein reservierter Name -- bitte einen anderen waehlen.`;
  }

  const supabase = await createClient();
  let slug = base;

  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const { error } = await supabase.from("projects").insert({ slug, name });

    if (!error) {
      redirect(`/projects/${slug}`);
    }

    // 23505 = unique_violation (slug already taken) -> retry with a suffix.
    if (error.code !== "23505") {
      return `Projekt konnte nicht angelegt werden: ${error.message}`;
    }

    slug = `${base}-${attempt + 1}`;
  }

  return "Konnte keinen freien Projektnamen finden -- bitte einen anderen Namen waehlen.";
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
