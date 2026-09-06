"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import { VIDEO_BUCKET } from "@/lib/constants";
import { markVideoUploaded } from "@/app/projects/actions";

export function UploadForm({ slug }: { slug: string }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  async function handleFile(file: File) {
    setStatus("uploading");
    setErrorMessage("");
    setProgress(0);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setStatus("error");
      setErrorMessage("Session abgelaufen -- bitte neu anmelden.");
      return;
    }

    // Supabase Storage's resumable-upload (TUS) endpoint lives on a
    // dedicated *.storage.supabase.co host, not the main project URL.
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseProjectRef = new URL(projectUrl).hostname.split(".")[0];
    const objectName = `${session.user.id}/${slug}/${file.name}`;

    const upload = new tus.Upload(file, {
      endpoint: `https://${supabaseProjectRef}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: VIDEO_BUCKET,
        objectName,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      // Supabase requires exactly 6MB chunks for resumable uploads (as of
      // their current docs) -- do not change this.
      chunkSize: 6 * 1024 * 1024,
      onError: (error) => {
        setStatus("error");
        setErrorMessage(error.message);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        setProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: async () => {
        try {
          await markVideoUploaded(slug, objectName, file.name, file.size);
          router.refresh();
        } catch (err) {
          setStatus("error");
          setErrorMessage(err instanceof Error ? err.message : "Unbekannter Fehler.");
        }
      },
    });

    const previousUploads = await upload.findPreviousUploads();
    if (previousUploads.length > 0) {
      upload.resumeFromPreviousUpload(previousUploads[0]);
    }

    upload.start();
  }

  return (
    <div className="card">
      <label className="label">Video hochladen</label>
      <input
        type="file"
        accept="video/*"
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
