"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProjectMusic } from "@/app/projects/musicActions";

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export type MusicTrack = {
  id: string;
  filename: string;
  previewUrl: string | null;
  durationSeconds: number | null;
};

export function MusicPicker({
  slug,
  tracks,
  selectedTrackId,
}: {
  slug: string;
  tracks: MusicTrack[];
  selectedTrackId: string | null;
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selected, setSelected] = useState(selectedTrackId);
  const [isPending, startTransition] = useTransition();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  function togglePreview(track: MusicTrack) {
    if (!track.previewUrl) return;

    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingId(null);
    }
    audioRef.current.src = track.previewUrl;
    audioRef.current.play();
    setPlayingId(track.id);
  }

  function select(trackId: string | null) {
    setSelected(trackId);
    startTransition(async () => {
      await setProjectMusic(slug, trackId);
      router.refresh();
    });
  }

  if (tracks.length === 0) {
    return <p className="text-sm text-white/40">Keine Musik in der Bibliothek.</p>;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => select(null)}
        disabled={isPending}
        className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition ${
          selected === null
            ? "border-blue-500 bg-blue-500/10"
            : "border-white/10 bg-black/20 hover:bg-black/30"
        }`}
      >
        <span className="text-white/60">Keine Musik</span>
        {selected === null && <span className="text-xs text-blue-300">✓ Ausgewählt</span>}
      </button>

      {tracks.map((track) => (
        <div
          key={track.id}
          className={`flex items-center gap-3 rounded-lg border p-3 transition ${
            selected === track.id ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-black/20"
          }`}
        >
          <button
            type="button"
            onClick={() => togglePreview(track)}
            disabled={!track.previewUrl}
            className="btn-secondary h-9 w-9 shrink-0 !p-0 text-base disabled:opacity-30"
            aria-label={playingId === track.id ? "Pause" : "Abspielen"}
          >
            {playingId === track.id ? "⏸" : "▶"}
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white/90">{track.filename}</p>
            <p className="text-xs text-white/40">{formatDuration(track.durationSeconds)}</p>
          </div>

          <button
            type="button"
            onClick={() => select(track.id)}
            disabled={isPending}
            className={selected === track.id ? "btn text-xs" : "btn-secondary text-xs"}
          >
            {selected === track.id ? "✓ Ausgewählt" : "Auswählen"}
          </button>
        </div>
      ))}
    </div>
  );
}
