import api from "../../lib/axios";

export async function registerUser(email: string, password: string, name?: string) {
  const res = await api.post("/auth/register", { email, password, name });
  return res.data;
}

export async function loginUser(email: string, password: string) {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
}