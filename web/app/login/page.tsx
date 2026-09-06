"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(login, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={formAction} className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Videotool</h1>
          <p className="mt-1 text-sm text-white/50">Anmelden, um fortzufahren.</p>
        </div>

        <div>
          <label htmlFor="email" className="label">
            E-Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="input"
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="input"
            autoComplete="current-password"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" className="btn w-full" disabled={isPending}>
          {isPending ? "Anmelden..." : "Anmelden"}
        </button>
      </form>
    </main>
  );
}
