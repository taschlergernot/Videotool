import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { SupabaseClient } from "@supabase/supabase-js";

const VIDEOTOOL_ROOT = "C:\\Videotool";
const R2_BUCKET = "videotool";
const VIDEO_STORAGE_BUCKET = "videos"; // Supabase Storage, siehe web/lib/constants.ts

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "bmp", "tif", "tiff"]);
function isImageFilename(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

function createR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY fehlen in worker/.env");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

type Asset = {
  filename: string;
  storage_backend: "supabase" | "r2";
  storage_path: string | null;
  r2_key: string | null;
};

// Der Agent selbst darf laut Allowlist (claudeAgent.ts) nicht auf R2/Supabase
// Storage zugreifen -- der Orchestrator laedt die primaere Video-Datei daher
// VOR dem Agent-Lauf lokal herunter, exakt dahin wo CLAUDE.md/docs/
// video-editing-workflow.md sie erwartet: raw/<slug>/<filename>.
export async function downloadPrimaryVideo(
  supabase: SupabaseClient,
  projectId: string,
  slug: string
): Promise<{ filename: string; rawRelativePath: string } | null> {
  const { data: assets } = await supabase
    .from("project_assets")
    .select("filename, storage_backend, storage_path, r2_key")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: true });

  const primaryVideo = ((assets ?? []) as Asset[]).find((a) => !isImageFilename(a.filename));
  if (!primaryVideo) {
    return null;
  }

  let url: string;
  if (primaryVideo.storage_backend === "r2" && primaryVideo.r2_key) {
    const r2 = createR2Client();
    url = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: primaryVideo.r2_key }),
      { expiresIn: 60 * 30 }
    );
  } else if (primaryVideo.storage_backend === "supabase" && primaryVideo.storage_path) {
    const { data, error } = await supabase.storage
      .from(VIDEO_STORAGE_BUCKET)
      .createSignedUrl(primaryVideo.storage_path, 60 * 30);
    if (error || !data?.signedUrl) {
      throw new Error(`Supabase Signed URL fehlgeschlagen: ${error?.message ?? "kein Link"}`);
    }
    url = data.signedUrl;
  } else {
    throw new Error(`Asset ${primaryVideo.filename} hat weder r2_key noch storage_path.`);
  }

  const rawRelativePath = `raw/${slug}/${primaryVideo.filename}`;
  const localPath = join(VIDEOTOOL_ROOT, "raw", slug, primaryVideo.filename);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download fehlgeschlagen: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  await mkdir(dirname(localPath), { recursive: true });
  await writeFile(localPath, buffer);

  return { filename: primaryVideo.filename, rawRelativePath };
}
