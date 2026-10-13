export const ERROR_CODES = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "PAYLOAD_TOO_LARGE",
  "UNPROCESSABLE",
  "INTERNAL",
  "SERVICE_UNAVAILABLE",
  "PDF_PASSWORD_REQUIRED",
  "PDF_PASSWORD_INCORRECT",
] as const;

export const ErrorCode = {
  BadRequest: "BAD_REQUEST",
  Unauthorized: "UNAUTHORIZED",
  Forbidden: "FORBIDDEN",
  NotFound: "NOT_FOUND",
  Conflict: "CONFLICT",
  ValidationError: "VALIDATION_ERROR",
  RateLimited: "RATE_LIMITED",
  PayloadTooLarge: "PAYLOAD_TOO_LARGE",
  Unprocessable: "UNPROCESSABLE",
  Internal: "INTERNAL",
  ServiceUnavailable: "SERVICE_UNAVAILABLE",
  PdfPasswordRequired: "PDF_PASSWORD_REQUIRED",
  PdfPasswordIncorrect: "PDF_PASSWORD_INCORRECT",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
