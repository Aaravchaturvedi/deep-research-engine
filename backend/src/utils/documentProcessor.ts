// backend/src/utils/documentProcessor.ts
import { PDFParse } from "pdf-parse";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/octet-stream", // some browsers send this for .txt/.csv; validated by extension below
]);

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;
const MAX_CHARS = 500_000; // ~250 chunks cap, protects embedding loop

function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

export async function processUploadedFile(file: Express.Multer.File): Promise<string[]> {
  try {
    const ext = extOf(file.originalname || "");
    const isPdf = file.mimetype === "application/pdf" || ext === ".pdf";
    const isTxt = file.mimetype === "text/plain" || ext === ".txt";
    const isCsv =
      file.mimetype === "text/csv" || ext === ".csv" || file.mimetype === "application/vnd.ms-excel";

    if (!ALLOWED_MIME.has(file.mimetype) && !isPdf && !isTxt && !isCsv) {
      throw new Error("Unsupported file type. Please upload PDF, TXT, or CSV.");
    }

    let text = "";

    if (isPdf) {
      // Extract text from PDF (pdf-parse v2 API: class + getText + destroy)
      const parser = new PDFParse({ data: file.buffer });
      try {
        const data = await parser.getText();
        text = data.text || "";
      } catch (pdfErr: any) {
        throw new Error(
          `Could not parse this PDF (${pdfErr?.message || "unknown error"}). Try another file or a TXT/CSV export.`
        );
      } finally {
        await parser.destroy().catch(() => {});
      }
      // pdf-parse v2 inserts page markers like "-- 1 of 3 --"; strip them
      text = text.replace(/--\s*\d+\s+of\s+\d+\s*--/g, " ");
    } else if (isTxt || isCsv) {
      // Extract text from TXT/CSV
      text = file.buffer.toString("utf-8");
    } else {
      throw new Error("Unsupported file type. Please upload PDF, TXT, or CSV.");
    }

    // Clean up whitespace
    text = text.replace(/\s+/g, " ").trim();

    if (!text) {
      throw new Error("No readable text found in file");
    }

    // Hard cap to avoid embedding huge docs forever
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS);
    }

    // Chunk with overlap so context isn't lost at boundaries
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const chunk = text.slice(i, i + CHUNK_SIZE).trim();
      if (chunk) chunks.push(chunk);
      if (i + CHUNK_SIZE >= text.length) break;
    }

    return chunks;
  } catch (err) {
    console.error("Error processing file:", err);
    throw err;
  }
}