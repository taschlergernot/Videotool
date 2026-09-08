"use client";

import { useEffect, useState } from "react";

export function VideoThumbnail({
  url,
  isImage,
  label,
}: {
  url: string;
  isImage: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative mt-3 block w-full overflow-hidden rounded-lg bg-black/20"
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-40 w-full object-cover" />
        ) : (
          // Kein `controls` -- das hier ist nur die Miniaturansicht (zeigt den
          // ersten Frame sobald die Metadaten geladen sind), kein Player.
          <video src={url} muted preload="metadata" className="h-40 w-full object-cover" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
          <span className="rounded-full bg-black/70 px-3 py-1 text-xs text-white">Ansehen</span>
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setOpen(false)}
        >
          <div className="relative max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute -top-10 right-0 text-sm text-white/70 hover:text-white"
            >
              ✕ Schließen
            </button>
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={label} className="max-h-[85vh] w-auto rounded-lg" />
            ) : (
              <video src={url} controls autoPlay className="max-h-[85vh] w-auto rounded-lg" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
