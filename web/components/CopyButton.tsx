"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "Kopieren",
  copiedLabel = "Kopiert!",
  className = "btn-secondary",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  function copyViaFallback(value: string): boolean {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    // Keep it in the viewport (off-screen elements can be skipped by some
    // browsers' copy handling) but visually and interactively out of the way.
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  }

  async function handleCopy() {
    setError("");

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        // Fall through to the fallback below -- e.g. clipboard-write
        // permission denied by the browser/embedding context.
      }
    }

    if (copyViaFallback(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setError("Kopieren nicht moeglich -- Text unten manuell markieren und kopieren.");
    }
  }

  return (
    <div>
      <button type="button" onClick={handleCopy} className={className}>
        {copied ? copiedLabel : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
