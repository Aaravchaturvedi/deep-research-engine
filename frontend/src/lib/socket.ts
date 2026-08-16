import { io, Socket } from "socket.io-client";
import { store } from "../app/store";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = store.getState().auth.accessToken;
    socket = io("http://localhost:5000", {
      auth: { token },
      withCredentials: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}