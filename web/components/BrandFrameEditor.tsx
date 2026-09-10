"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBrandFrame } from "@/app/brand/actions";

export function BrandFrameEditor({ name, initialContent }: { name: string; initialContent: string }) {
  const [content, setContent] = useState(initialContent);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function handleSave() {
    setError("");
    startTransition(async () => {
      try {
        await saveBrandFrame(name, content);
        setSavedAt(new Date());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
      }
    });
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <label className="label !mb-0">frame.md</label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary text-xs"
        >
          Datei hochladen
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# frame.md&#10;&#10;Hier Farben, Schriften und Design-Regeln als Markdown einfuegen -- Farb-Tokens als --name: #hex; in einem ```css-Block, Font-Tokens als --font-name: &quot;Font&quot;, fallback;"
        rows={16}
        className="input w-full font-mono text-xs"
      />

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={isPending} className="btn">
          {isPending ? "Speichert…" : "Speichern"}
        </button>
        {savedAt && !error && (
          <span className="text-xs text-emerald-400">
            Gespeichert um {savedAt.toLocaleTimeString("de-DE")}
          </span>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
