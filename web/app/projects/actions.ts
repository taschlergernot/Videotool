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

export async function startAutomatedJob(slug: string) {
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .single();

  if (projectError || !project) {
    throw new Error("Projekt nicht gefunden.");
  }

  const { error } = await supabase.from("jobs").insert({
    project_id: project.id,
    status: "queued",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${slug}`);
}

export async function approveCheckpoint(checkpointId: string, slug: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("job_checkpoints")
    .update({ status: "approved", resolved_at: new Date().toISOString() })
    .eq("id", checkpointId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${slug}`);
}

export async function rejectCheckpoint(checkpointId: string, slug: string, note: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("job_checkpoints")
    .update({
      status: "rejected",
      decision_payload: { note },
      resolved_at: new Date().toISOString(),
    })
    .eq("id", checkpointId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${slug}`);
}
