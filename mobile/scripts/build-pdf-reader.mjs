// Builds src/pdf/readerHtml.generated.js: a page that reads statement PDFs
// inside a hidden WebView with pdf.js, the same library the backend uses.
// pdf.js is inlined, so reading a statement works offline and nothing is
// fetched. Runs on postinstall; the output is not committed (it is ~2 MB).
//
//   npm run pdf-reader
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const build = join(dirname(require.resolve("pdfjs-dist/package.json")), "legacy/build");
const out = join(here, "../src/pdf/readerHtml.generated.js");

// A JS string literal that is safe inside <script>.
const literal = (source) => JSON.stringify(source).replace(/<\//g, "<\\/");

const pdf = readFileSync(join(build, "pdf.min.mjs"), "utf8");
const worker = readFileSync(join(build, "pdf.worker.min.mjs"), "utf8");

// pdf.js reads text with \`for await (const chunk of readableStream)\`. Safari
// and iOS WebViews don't make ReadableStream async-iterable, so that line
// throws "undefined is not a function" and no statement can be read. This adds
// the standard iterator where it's missing; it runs before pdf.js on the page
// and at the top of the worker.
const STREAM_ITERATOR = `(() => {
  if (typeof ReadableStream === "undefined" || ReadableStream.prototype[Symbol.asyncIterator]) return;
  function values(options) {
    const preventCancel = Boolean(options && options.preventCancel);
    const reader = this.getReader();
    return {
      async next() {
        const result = await reader.read();
        if (result.done) reader.releaseLock();
        return result;
      },
      async return(value) {
        if (!preventCancel) {
          const cancelled = reader.cancel(value);
          reader.releaseLock();
          await cancelled;
        } else {
          reader.releaseLock();
        }
        return { done: true, value };
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }
  Object.defineProperty(ReadableStream.prototype, "values", { value: values, writable: true, configurable: true });
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, { value: values, writable: true, configurable: true });
})();
`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body><script type="module">
${STREAM_ITERATOR}
const PDF_SOURCE = ${literal(pdf)};
const WORKER_SOURCE = ${literal(STREAM_ITERATOR + worker)};
const MAX_PAGES = 300;

const send = (message) => window.ReactNativeWebView.postMessage(JSON.stringify(message));
const moduleUrl = (source) => URL.createObjectURL(new Blob([source], { type: "text/javascript" }));

let loading = null;
let workerUrl = null;
let moduleWorkers = true;
function pdfjs() {
  loading ??= (async () => {
    const lib = await import(moduleUrl(PDF_SOURCE));
    workerUrl = moduleUrl(WORKER_SOURCE);
    try {
      new Worker(workerUrl, { type: "module" }).terminate();
    } catch {
      // No module workers here: run the worker code on this thread instead.
      moduleWorkers = false;
      globalThis.pdfjsWorker = await import(workerUrl);
    }
    return lib;
  })();
  return loading;
}

// A fresh worker for every read. pdf.js shuts a worker down with its document,
// so sharing one made the read after a password prompt fail with
// "the worker is being destroyed".
function newWorker(lib) {
  return moduleWorkers ? new lib.PDFWorker({ port: new Worker(workerUrl, { type: "module" }) }) : null;
}

function bytesFromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function read({ id, base64, password }) {
  let task = null;
  let worker = null;
  try {
    const lib = await pdfjs();
    worker = newWorker(lib);
    task = lib.getDocument({ data: bytesFromBase64(base64), password: password || undefined, ...(worker ? { worker } : {}) });
    const doc = await task.promise;
    if (doc.numPages > MAX_PAGES) {
      throw new Error("This PDF has " + doc.numPages + " pages. Statements over " + MAX_PAGES + " pages are not supported.");
    }
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      const items = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim() || !item.transform) continue;
        items.push({ str: item.str, x: item.transform[4], y: item.transform[5] });
      }
      pages.push(items);
    }
    send({ id, ok: true, pages });
  } catch (error) {
    const message = error && error.message ? String(error.message) : String(error);
    // pdf.js PasswordException: code 1 = no password given, 2 = wrong password.
    const code = error && error.name === "PasswordException" ? (error.code === 1 ? "password-required" : "password-wrong") : null;
    send({ id, ok: false, code, message });
  } finally {
    try {
      if (task) await task.destroy();
    } catch {}
    try {
      if (worker) worker.destroy();
    } catch {}
  }
}

const onMessage = (event) => {
  let message;
  try { message = JSON.parse(event.data); } catch { return; }
  if (message && message.type === "read") read(message);
};
window.addEventListener("message", onMessage);
document.addEventListener("message", onMessage);
send({ type: "ready" });
</script></body></html>`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `// Generated by scripts/build-pdf-reader.mjs. Do not edit.\nexport const READER_HTML = ${JSON.stringify(html)};\n`,
);
writeFileSync(out.replace(/\.js$/, ".d.ts"), "export declare const READER_HTML: string;\n");
console.log(`PDF reader page: ${(html.length / 1024 / 1024).toFixed(1)} MB`);
