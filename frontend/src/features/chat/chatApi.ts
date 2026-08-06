import api from "../../lib/axios";

export async function sendChatMessage(message: string, sessionId: string | null) {
  const res = await api.post("/chat", { message, sessionId });
  return res.data;
}