import { useEffect, useRef } from "react";
import type { PdfTextItem } from "@/core/shared";
import { PdfPasswordError } from "./PdfPasswordError";
import { READER_HTML } from "./readerHtml.generated";

export { PdfPasswordError };

type Pending = { resolve: (pages: PdfTextItem[][]) => void; reject: (error: Error) => void };

// The page talks to a React Native WebView; in a browser this shim forwards
// its messages to the parent window instead. Same page, same pdf.js.
const SHIM = "<script>window.ReactNativeWebView={postMessage:function(m){parent.postMessage({ledgerlineReader:m},'*')}}</script>";

/** The web build's reader: the same page as the phone, in a hidden iframe. */
export function usePdfReader() {
  const frame = useRef<HTMLIFrameElement>(null);
  const pending = useRef(new Map<string, Pending>());
  const loaded = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  const whenLoaded = () => {
    if (!loaded.current) {
      let resolve = () => {};
      const promise = new Promise<void>((done) => (resolve = done));
      loaded.current = { promise, resolve };
    }
    return loaded.current;
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || typeof event.data?.ledgerlineReader !== "string") return;
      const message = JSON.parse(event.data.ledgerlineReader) as {
        type?: string;
        id?: string;
        ok?: boolean;
        pages?: PdfTextItem[][];
        code?: string;
        message?: string;
      };
      if (message.type === "ready") {
        whenLoaded().resolve();
        return;
      }
      const waiting = message.id ? pending.current.get(message.id) : undefined;
      if (!waiting || !message.id) return;
      pending.current.delete(message.id);
      if (message.ok && message.pages) waiting.resolve(message.pages);
      else if (message.code === "password-required") waiting.reject(new PdfPasswordError(false));
      else if (message.code === "password-wrong") waiting.reject(new PdfPasswordError(true));
      else waiting.reject(new Error(message.message ?? "Ledgerline couldn't read this PDF."));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const read = async (base64: string, password = ""): Promise<PdfTextItem[][]> => {
    await whenLoaded().promise;
    const id = Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      pending.current.set(id, { resolve, reject });
      frame.current?.contentWindow?.postMessage(JSON.stringify({ type: "read", id, base64, password }), "*");
    });
  };

  const reader = (
    <iframe
      ref={frame}
      srcDoc={READER_HTML.replace("<body>", `<body>${SHIM}`)}
      title="PDF reader"
      aria-hidden
      tabIndex={-1}
      style={{ position: "absolute", width: 1, height: 1, opacity: 0, border: 0, pointerEvents: "none" }}
    />
  );

  return { reader, read };
}
