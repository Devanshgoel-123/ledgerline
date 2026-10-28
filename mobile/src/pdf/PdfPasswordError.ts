export class PdfPasswordError extends Error {
  constructor(readonly wrong: boolean) {
    super(wrong ? "That password didn't open the PDF. Check it and try again." : "This PDF is locked with a password.");
  }
}
