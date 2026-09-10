"use client";

import { useTransition } from "react";
import { deleteProject } from "@/app/actions";

export function DeleteProjectButton({
  slug,
  projectName,
  className,
}: {
  slug: string;
  projectName: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      `"${projectName}" wirklich loeschen? Alle hochgeladenen Dateien, Auftraege und Checkpoints ` +
        `dieses Projekts werden unwiderruflich entfernt.`
    );
    if (!confirmed) return;

    startTransition(() => {
      deleteProject(slug);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={className ?? "text-sm text-red-400/80 hover:text-red-400"}
    >
      {isPending ? "Löscht…" : "Löschen"}
    </button>
  );
}
