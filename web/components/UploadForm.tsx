"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createR2MultipartUpload,
  getR2PartUploadUrl,
  completeR2MultipartUpload,
  abortR2MultipartUpload,
  markR2VideoUploaded,
} from "@/app/projects/r2Actions";

// S3-Multipart-Minimum ist 5MB pro Part (ausser dem letzten) -- 10MB gibt
// Marge und haelt die Anzahl Presigned-URL-Requests bei Multi-GB-Dateien
// vernuenftig klein.
const PART_SIZE = 10 * 1024 * 1024;
const MAX_PART_RETRIES = 3;

async function uploadPart(url: string, blob: Blob, attempt = 1): Promise<string> {
  try {
    const res = await fetch(url, { method: "PUT", body: blob });
    if (!res.ok) {
      throw new Error(`Part-Upload fehlgeschlagen: HTTP ${res.status}`);
    }
    const etag = res.headers.get("ETag");
    if (!etag) {
      throw new Error("Keine ETag in der Antwort -- CORS ExposeHeaders pruefen.");
    }
    return etag;
  } catch (err) {
    if (attempt >= MAX_PART_RETRIES) throw err;
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    return uploadPart(url, blob, attempt + 1);
  }
}

export function UploadForm({ slug }: { slug: string }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  async function handleFile(file: File) {
    setStatus("uploading");
    setErrorMessage("");
    setProgress(0);

    let key: string | undefined;
    let uploadId: string | undefined;

    try {
      const created = await createR2MultipartUpload(slug, file.name, file.type);
      key = created.key;
      uploadId = created.uploadId;

      const totalParts = Math.ceil(file.size / PART_SIZE);
      const parts: { PartNumber: number; ETag: string }[] = [];

      for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
        const start = (partNumber - 1) * PART_SIZE;
        const blob = file.slice(start, Math.min(start + PART_SIZE, file.size));

        const url = await getR2PartUploadUrl(key, uploadId, partNumber);
        const etag = await uploadPart(url, blob);
        parts.push({ PartNumber: partNumber, ETag: etag });

        setProgress(Math.round((partNumber / totalParts) * 100));
      }

      await completeR2MultipartUpload(key, uploadId, parts);
      await markR2VideoUploaded(slug, key, file.name, file.size);
      router.refresh();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Unbekannter Fehler.");
      if (key && uploadId) {
        await abortR2MultipartUpload(key, uploadId).catch(() => {
          // Bestes Bemuehen -- ein verwaister Multipart-Upload raeumt sich
          // in R2 nach ein paar Tagen von selbst auf, kein Blocker.
        });
      }
    }
  }

  return (
    <div className="card">
      <label className="label">Video oder Bild hochladen</label>
      <input
        type="file"
        accept="video/*,image/*"
        disabled={status === "uploading"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="block w-full text-sm text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
      />

      {status === "uploading" && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-white/50">{progress}%</p>
        </div>
      )}

      {status === "error" && <p className="mt-3 text-sm text-red-400">{errorMessage}</p>}
    </div>
  );
}
