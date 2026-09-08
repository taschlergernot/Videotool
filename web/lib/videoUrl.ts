import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createR2Client, R2_BUCKET } from "@/lib/r2";
import { VIDEO_BUCKET } from "@/lib/constants";

type ProjectStorageFields = {
  video_storage_path: string | null;
  video_r2_key: string | null;
};

// Neue Uploads landen in R2, Bestandsuploads bleiben in Supabase Storage --
// welches Feld gesetzt ist, entscheidet den Speicherort. Nie beide zugleich.
export async function getProjectPreviewUrl(
  supabase: SupabaseClient,
  project: ProjectStorageFields,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  if (project.video_r2_key) {
    const r2 = createR2Client();
    return getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: project.video_r2_key }),
      { expiresIn: expiresInSeconds }
    );
  }

  if (project.video_storage_path) {
    const { data } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(project.video_storage_path, expiresInSeconds);
    return data?.signedUrl ?? null;
  }

  return null;
}
