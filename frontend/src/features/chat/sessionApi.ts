import api from "../../lib/axios";

export async function fetchSessions() {
  const res = await api.get("/sessions");
  return res.data;
}

export async function fetchSessionMessages(sessionId: string) {
  const res = await api.get(`/sessions/${sessionId}`);
  return res.data;
}