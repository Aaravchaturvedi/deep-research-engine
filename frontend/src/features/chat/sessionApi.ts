import api from "../../lib/axios";

export async function fetchSessions() {
  const res = await api.get("/sessions");
  return res.data;
}

export async function fetchSessionMessages(sessionId: string) {
  const res = await api.get(`/sessions/${sessionId}`);
  return res.data;
}

export async function renameSession(sessionId: string, title: string) {
  const res = await api.patch(`/sessions/${sessionId}`, { title });
  return res.data;
}

export async function deleteSession(sessionId: string) {
  const res = await api.delete(`/sessions/${sessionId}`);
  return res.data;
}