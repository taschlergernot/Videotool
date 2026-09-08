import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createR2Client, R2_BUCKET } from "@/lib/r2";
import { VIDEO_BUCKET } from "@/lib/constants";

export type AssetStorageFields = {
  storage_backend: "supabase" | "r2";
  storage_path: string | null;
  r2_key: string | null;
};

export async function getAssetPreviewUrl(
  supabase: SupabaseClient,
  asset: AssetStorageFields,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  if (asset.storage_backend === "r2" && asset.r2_key) {
    const r2 = createR2Client();
    return getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: asset.r2_key }), {
      expiresIn: expiresInSeconds,
    });
  }

  if (asset.storage_backend === "supabase" && asset.storage_path) {
    const { data } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(asset.storage_path, expiresInSeconds);
    return data?.signedUrl ?? null;
  }

  return null;
}
