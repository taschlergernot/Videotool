"use client";

import { useActionState } from "react";
import { createProject } from "@/app/actions";

export function NewProjectForm() {
  const [error, formAction, isPending] = useActionState(createProject, undefined);

  return (
    <form action={formAction} className="card mb-8 flex items-end gap-3">
      <div className="flex-1">
        <label htmlFor="name" className="label">
          Neues Projekt
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="z.B. Kundentermin Herbst"
          className="input"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
      <button type="submit" className="btn" disabled={isPending}>
        {isPending ? "Anlegen..." : "Anlegen"}
      </button>
    </form>
  );
}
