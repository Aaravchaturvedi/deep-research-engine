// backend/src/utils/documentProcessor.ts
// Change this:
// import pdfParse from "pdf-parse";

// To this:
import * as pdfParseLib from "pdf-parse";
const pdfParse = (pdfParseLib as any).default || pdfParseLib;

export async function processUploadedFile(file: Express.Multer.File): Promise<string[]> {
  let text = "";

  try {
    if (file.mimetype === "application/pdf") {
      // Extract text from PDF
      const data = await pdfParse(file.buffer); // This will now work perfectly!
      text = data.text;
    } else if (file.mimetype === "text/plain" || file.mimetype === "text/csv") {
      // Extract text from TXT/CSV
      text = file.buffer.toString("utf-8");
    } else {
      throw new Error("Unsupported file type. Please upload PDF, TXT, or CSV.");
    }

    // Clean up whitespace
    text = text.replace(/\s+/g, " ").trim();

    // Chunk it (same 2000 character logic as the scraper)
    const chunkSize = 2000;
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    return chunks;
  } catch (err) {
    console.error("Error processing file:", err);
    throw err;
  }
}