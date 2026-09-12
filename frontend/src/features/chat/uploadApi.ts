import api from "../../lib/axios";

export interface UploadResult {
  sessionId: string;
  chunks: number;
  filename: string;
  newSession: boolean;
}

export async function uploadDocument(
  file: File,
  sessionId: string | null
): Promise<UploadResult> {
  const form = new FormData();
  form.append("document", file);
  if (sessionId) form.append("sessionId", sessionId);
  const res = await api.post("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 180000, // embedding can take a while on first run
  });
  return res.data;
}
