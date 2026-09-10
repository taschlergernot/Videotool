"use server";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createR2Client, R2_BUCKET } from "@/lib/r2";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Nicht angemeldet.");
  }

  return user.id;
}

export async function createR2MultipartUpload(
  slug: string,
  filename: string,
  contentType: string
): Promise<{ key: string; uploadId: string }> {
  const userId = await requireUserId();
  // Zufaellige ID im Pfad -- mehrere Assets im selben Projekt koennen
  // denselben Dateinamen haben, ohne sich gegenseitig zu ueberschreiben.
  const key = `${userId}/${slug}/${crypto.randomUUID()}-${filename}`;

  const r2 = createR2Client();
  const result = await r2.send(
    new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    })
  );

  if (!result.UploadId) {
    throw new Error("R2 hat keine UploadId zurueckgegeben.");
  }

  return { key, uploadId: result.UploadId };
}

export async function getR2PartUploadUrl(
  key: string,
  uploadId: string,
  partNumber: number
): Promise<string> {
  await requireUserId();

  const r2 = createR2Client();
  return getSignedUrl(
    r2,
    new UploadPartCommand({ Bucket: R2_BUCKET, Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: 60 * 30 }
  );
}

export async function completeR2MultipartUpload(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[]
): Promise<void> {
  await requireUserId();

  const r2 = createR2Client();
  await r2.send(
    new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    })
  );
}

export async function abortR2MultipartUpload(key: string, uploadId: string): Promise<void> {
  await requireUserId();

  const r2 = createR2Client();
  await r2.send(new AbortMultipartUploadCommand({ Bucket: R2_BUCKET, Key: key, UploadId: uploadId }));
}

export async function addR2Asset(
  slug: string,
  r2Key: string,
  filename: string,
  sizeBytes: number,
  meta?: { durationSeconds?: number; width?: number; height?: number }
): Promise<void> {
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .single();

  if (projectError || !project) {
    throw new Error("Projekt nicht gefunden.");
  }

  const { error } = await supabase.from("project_assets").insert({
    project_id: project.id,
    filename,
    storage_backend: "r2",
    r2_key: r2Key,
    size_bytes: sizeBytes,
    duration_seconds: meta?.durationSeconds ?? null,
    width: meta?.width ?? null,
    height: meta?.height ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${slug}`);
}
