"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createR2MultipartUpload,
  getR2PartUploadUrl,
  completeR2MultipartUpload,
  abortR2MultipartUpload,
  addR2Asset,
} from "@/app/projects/r2Actions";

// S3-Multipart-Minimum ist 5MB pro Part (ausser dem letzten) -- 10MB gibt
// Marge und haelt die Anzahl Presigned-URL-Requests bei Multi-GB-Dateien
// vernuenftig klein.
const PART_SIZE = 10 * 1024 * 1024;
const MAX_PART_RETRIES = 3;
// Wenn eine einzelne Part-Anfrage laenger als das braucht, ist etwas
// haengen geblieben (totes CORS-Preflight, Netzwerkabbruch ohne sauberen
// Fehler) -- ohne das wuerde die UI unbegrenzt bei "haengt" stehen bleiben,
// statt einen Fehler zu zeigen.
const PART_TIMEOUT_MS = 5 * 60 * 1000;

function uploadPartOnce(url: string, blob: Blob, onProgress: (loaded: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = PART_TIMEOUT_MS;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Part-Upload fehlgeschlagen: HTTP ${xhr.status}`));
        return;
      }
      const etag = xhr.getResponseHeader("ETag");
      if (!etag) {
        reject(new Error("Keine ETag in der Antwort -- CORS ExposeHeaders pruefen."));
        return;
      }
      resolve(etag);
    };

    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Part-Upload (CORS oder Verbindung pruefen)."));
    xhr.ontimeout = () => reject(new Error(`Part-Upload haengt -- kein Fortschritt nach ${PART_TIMEOUT_MS / 1000}s.`));

    xhr.send(blob);
  });
}

async function uploadPart(
  url: string,
  blob: Blob,
  onProgress: (loaded: number) => void,
  attempt = 1
): Promise<string> {
  try {
    return await uploadPartOnce(url, blob, onProgress);
  } catch (err) {
    if (attempt >= MAX_PART_RETRIES) throw err;
    onProgress(0);
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    return uploadPart(url, blob, onProgress, attempt + 1);
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
      let bytesDoneBeforeCurrentPart = 0;

      for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
        const start = (partNumber - 1) * PART_SIZE;
        const blob = file.slice(start, Math.min(start + PART_SIZE, file.size));

        const url = await getR2PartUploadUrl(key, uploadId, partNumber);
        const etag = await uploadPart(url, blob, (loaded) => {
          const total = bytesDoneBeforeCurrentPart + loaded;
          setProgress(Math.min(99, Math.round((total / file.size) * 100)));
        });
        parts.push({ PartNumber: partNumber, ETag: etag });
        bytesDoneBeforeCurrentPart += blob.size;
      }

      setProgress(100);
      await completeR2MultipartUpload(key, uploadId, parts);
      await addR2Asset(slug, key, file.name, file.size);
      setStatus("idle");
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
