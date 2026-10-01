import { io, Socket } from "socket.io-client";
import { store } from "../app/store";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = store.getState().auth.accessToken;
    const opts = {
      auth: { token },
      withCredentials: true,
    };
    // Same-origin (nginx proxies /socket.io) unless VITE_SOCKET_URL is set
    // (local `npm run dev` against backend on :5000).
    const socketUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
    socket = socketUrl ? io(socketUrl, opts) : io(opts);
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}