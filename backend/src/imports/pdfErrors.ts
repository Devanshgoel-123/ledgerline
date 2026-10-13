import { ErrorCode } from "../enums/index.js";
import { AppError } from "../errors/AppError.js";

export function assertPdfUpload(
  file: Express.Multer.File | undefined,
): Express.Multer.File {
  if (!file) {
    throw AppError.badRequest("Please upload a PDF file");
  }

  // Check file extension
  if (!file.originalname.toLowerCase().endsWith(".pdf")) {
    throw AppError.badRequest("Please upload a PDF file (must end in .pdf)");
  }

  // Check MIME type
  if (file.mimetype !== "application/pdf") {
    throw AppError.badRequest("File must be a valid PDF (incorrect file type)");
  }

  // Check PDF signature (magic bytes: %PDF)
  if (file.buffer.length < 4 || !file.buffer.slice(0, 4).toString("ascii").startsWith("%PDF")) {
    throw AppError.badRequest("File is not a valid PDF (corrupt or wrong format)");
  }

  return file;
}

export function pdfPasswordError(message: string): AppError {
  if (/required|no password/i.test(message)) {
    return new AppError(
      "This statement is password-protected. Enter its password and upload again. For HDFC it is usually your customer ID.",
      { statusCode: 422, code: ErrorCode.PdfPasswordRequired },
    );
  }
  return new AppError(
    "That password did not open the statement. Check it and try again. For HDFC it is usually your customer ID.",
    { statusCode: 422, code: ErrorCode.PdfPasswordIncorrect },
  );
}

export function mapPdfImportError(error: unknown): never {
  if (!(error instanceof Error)) {
    throw AppError.internal("Failed to parse PDF: unknown error", error);
  }

  const message = error.message;

  // Password problems are 422, never 401: a 401 tells the app the session ended and signs the user out.
  if (/password|encrypted/i.test(message)) {
    throw pdfPasswordError(message);
  }

  // User-recoverable errors
  if (/no transactions|could not extract|empty|unsupported|please upload|too large|invalid|corrupt/i.test(message)) {
    throw AppError.badRequest(message);
  }

  // Check for pdfjs-specific error names if available
  if (error.name === "PasswordException" || error.name === "UnknownErrorException") {
    return mapPdfImportError(
      new Error(/password/i.test(message) ? "PDF requires a password" : message),
    );
  }

  // Log full error for debugging, but return safe message to user
  console.error("PDF parse error:", { name: error.name, message });
  throw AppError.internal("Failed to parse PDF. Please check the file and try again.", error);
}
