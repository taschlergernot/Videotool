"use client";

import { useState, useTransition } from "react";
import { approveCheckpoint, rejectCheckpoint } from "@/app/projects/actions";

const TYPE_LABELS: Record<string, string> = {
  cut_plan: "Cut-Plan-Bestätigung",
  self_eval: "Self-Eval",
};

export function CheckpointApproval({
  checkpointId,
  slug,
  type,
  titleDe,
  summaryDe,
  payload,
}: {
  checkpointId: string;
  slug: string;
  type: string;
  titleDe: string;
  summaryDe: string;
  payload: unknown;
}) {
  const [isPending, startTransition] = useTransition();
  const [showRejectNote, setShowRejectNote] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function handleApprove() {
    setError("");
    startTransition(async () => {
      try {
        await approveCheckpoint(checkpointId, slug);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Freigabe fehlgeschlagen.");
      }
    });
  }

  function handleReject() {
    setError("");
    startTransition(async () => {
      try {
        await rejectCheckpoint(checkpointId, slug, note);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ablehnung fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="card space-y-4 border-amber-500/30 bg-amber-500/[0.04]">
      <div>
        <p className="text-xs uppercase tracking-wide text-amber-400/80">
          Wartet auf Freigabe -- {TYPE_LABELS[type] ?? type}
        </p>
        <p className="mt-1 text-base font-semibold">{titleDe}</p>
      </div>

      <p className="whitespace-pre-wrap text-sm text-white/80">{summaryDe}</p>

      {payload != null && (
        <details className="text-sm text-white/50">
          <summary className="cursor-pointer hover:text-white/70">Details anzeigen</summary>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-white/80">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </details>
      )}

      {!showRejectNote ? (
        <div className="flex gap-3">
          <button type="button" className="btn" disabled={isPending} onClick={handleApprove}>
            {isPending ? "..." : "Freigeben"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={isPending}
            onClick={() => setShowRejectNote(true)}
          >
            Ablehnen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            className="input"
            rows={3}
            placeholder="Kurz begruenden, was geaendert werden soll..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-3">
            <button type="button" className="btn" disabled={isPending} onClick={handleReject}>
              {isPending ? "..." : "Ablehnung bestätigen"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={isPending}
              onClick={() => setShowRejectNote(false)}
            >
              Zurück
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
