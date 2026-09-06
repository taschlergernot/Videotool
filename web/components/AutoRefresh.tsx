"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Der Worker aktualisiert Job-/Checkpoint-Status ausserhalb jeder Anfrage
// dieser Seite -- ohne aktives Polling saehe man neue Checkpoints/den
// fertigen Auftrag erst nach manuellem Neuladen.
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
