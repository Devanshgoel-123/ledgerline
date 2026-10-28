import { useRef, type ComponentType, type Ref } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent, type WebViewProps } from "react-native-webview";
import type { PdfTextItem } from "@/core/shared";
import { READER_HTML } from "./readerHtml.generated";

import { PdfPasswordError } from "./PdfPasswordError";

export { PdfPasswordError };

type ReaderHandle = { postMessage(message: string): void };

// react-native-webview 14 types its props as `WebViewProps & undefined` (never) under this TypeScript.
const ReaderWebView = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<ReaderHandle> }>;

type Pending = { resolve: (pages: PdfTextItem[][]) => void; reject: (error: Error) => void };

// Gives the page a real origin for pdf.js's blob: modules. Nothing is fetched from it.
const BASE_URL = "https://ledgerline.invalid/";

/**
 * Reads a PDF's text on the phone, with pdf.js in a hidden WebView. Render
 * `reader` somewhere on the screen, then call `read`. The file is never uploaded.
 */
export function usePdfReader() {
  const webview = useRef<ReaderHandle>(null);
  const pending = useRef(new Map<string, Pending>());
  // Resolved when the page says it has loaded; created on first use, never during render.
  const loaded = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  const whenLoaded = () => {
    if (!loaded.current) {
      let resolve = () => {};
      const promise = new Promise<void>((done) => (resolve = done));
      loaded.current = { promise, resolve };
    }
    return loaded.current;
  };

  const onMessage = (event: WebViewMessageEvent) => {
    let message: { type?: string; id?: string; ok?: boolean; pages?: PdfTextItem[][]; code?: string; message?: string };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
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
    else waiting.reject(new Error(readableError(message.message)));
  };

  const read = async (base64: string, password = ""): Promise<PdfTextItem[][]> => {
    await whenLoaded().promise;
    const id = Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      pending.current.set(id, { resolve, reject });
      webview.current?.postMessage(JSON.stringify({ type: "read", id, base64, password }));
    });
  };

  const reader = (
    <View style={{ width: 1, height: 1, position: "absolute", opacity: 0 }} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <ReaderWebView
        ref={webview}
        source={{ html: READER_HTML, baseUrl: BASE_URL }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        javaScriptEnabled
        // The page only ever needs its own inline code.
        onShouldStartLoadWithRequest={(request) => /^(https:\/\/ledgerline\.invalid\/|about:|blob:|data:)/.test(request.url)}
        cacheEnabled={false}
      />
    </View>
  );

  return { reader, read };
}

function readableError(message: string | undefined): string {
  if (!message) return "Ledgerline couldn't read this PDF.";
  if (/Invalid PDF|not a PDF|bad XRef/i.test(message)) {
    return "This file isn't a PDF Ledgerline can read. Download the statement PDF from net banking and try again.";
  }
  return message;
}
