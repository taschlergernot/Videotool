"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setProjectMusic(slug: string, trackId: string | null): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("projects").update({ music_track_id: trackId }).eq("slug", slug);

  if (error) {
    throw new Error(`Musikauswahl konnte nicht gespeichert werden: ${error.message}`);
  }

  revalidatePath(`/projects/${slug}`);
}
