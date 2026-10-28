"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the selection fallback
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/** A terminal command with a button that copies it. Several lines are copied together. */
export function CopyCommand({ commands, label }: { commands: string[]; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);
  const text = commands.join("\n");

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  async function copy() {
    const ok = await writeClipboard(text);
    setState(ok ? "copied" : "failed");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="site-command">
      <pre tabIndex={0} aria-label={label}>
        <code>
          {commands.map((line) => (
            <span key={line} className="site-command-line">
              {line}
            </span>
          ))}
        </code>
      </pre>
      <button type="button" className="site-copy" onClick={() => void copy()} aria-label={`Copy: ${label}`}>
        {state === "copied" ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        <span>{state === "copied" ? "Copied" : state === "failed" ? "Select and copy" : "Copy"}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Could not copy. Select the text and copy it." : ""}
      </span>
    </div>
  );
}
