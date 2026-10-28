import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  buildAnalytics,
  pageTextFromItems,
  parseTransactions,
  type PdfTextItem,
} from "./parser.js";
import type { ParseResult, Transaction } from "./lib/index.js";

// pdf.js lives here, apart from parser.ts, so the parsers stay free of it:
// the mobile app shares them and reads PDFs its own way.

const MAX_PDF_PAGES = 300;

export async function extractTextFromPdf(
  data: Buffer,
  password = "",
): Promise<string> {
  const loadingTask = getDocument({
    data: new Uint8Array(data),
    password: password || undefined,
    useSystemFonts: true,
  });

  try {
    const pdf = await loadingTask.promise;
    // Parsing runs on the API's event loop. A bank statement is a few dozen pages.
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new Error(`This PDF has ${pdf.numPages} pages. Statements over ${MAX_PDF_PAGES} pages are not supported.`);
    }
    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const transform = "transform" in item ? item.transform : null;
        if (!transform) continue;
        items.push({ str: item.str, x: transform[4] as number, y: transform[5] as number });
      }
      pages.push(pageTextFromItems(items));
    }

    return pages.join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/password/i.test(message)) {
      // pdf.js PasswordException: code 1 = no password given, 2 = wrong password.
      const code = (error as { code?: number }).code;
      throw new Error(
        code === 1 || /no password/i.test(message)
          ? "PDF password required"
          : "Incorrect PDF password",
      );
    }
    throw error;
  }
}

export async function parsePdf(
  data: Buffer,
  password = "",
  /** Reads transactions from the PDF text; pass a bank adapter's extract. */
  extract: (text: string) => Transaction[] = parseTransactions,
): Promise<ParseResult> {
  const text = await extractTextFromPdf(data, password);
  if (!text.trim()) {
    throw new Error(
      "Could not extract text from PDF. It may be image-based or empty.",
    );
  }

  const transactions = extract(text);
  if (!transactions.length) {
    throw new Error("No transactions found in this statement.");
  }

  const result = buildAnalytics(transactions);
  result.meta.pagesTextChars = text.length;
  return result;
}
