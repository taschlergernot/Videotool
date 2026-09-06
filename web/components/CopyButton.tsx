"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) -- the text is
      // still visible in the <pre> block to select/copy manually.
    }
  }

  return (
    <button type="button" onClick={handleCopy} className="btn-secondary">
      {copied ? "Kopiert!" : "Kopieren"}
    </button>
  );
}
