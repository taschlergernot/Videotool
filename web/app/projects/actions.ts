"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markVideoUploaded(
  slug: string,
  storagePath: string,
  filename: string,
  sizeBytes: number
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update({
      video_storage_path: storagePath,
      video_filename: filename,
      video_size_bytes: sizeBytes,
      video_uploaded_at: new Date().toISOString(),
    })
    .eq("slug", slug);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${slug}`);
}
