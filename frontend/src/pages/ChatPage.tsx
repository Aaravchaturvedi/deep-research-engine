import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "../app/store";
import { addMessage, setSessionId, setLoading } from "../features/chat/chatSlice";
import { getSocket } from "../lib/socket";
import Sidebar from "../components/Sidebar";
import { setSessions } from "../features/chat/chatSlice";
import { fetchSessions } from "../features/chat/sessionApi";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const dispatch = useDispatch();
  const { messages, sessionId, loading } = useSelector((state: RootState) => state.chat);
  const streamingRef = useRef("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  useEffect(() => {
    const socket = getSocket();

    socket.on("chat:session", async ({ sessionId }) => {
      dispatch(setSessionId(sessionId));
      const data = await fetchSessions();
  dispatch(setSessions(data));
    });

    socket.on("chat:chunk", ({ chunk }) => {
      streamingRef.current += chunk;
      setStreamingText(streamingRef.current);
    });

    socket.on("chat:done", ({ fullResponse }) => {
      dispatch(addMessage({ role: "assistant", content: fullResponse }));
      streamingRef.current = "";
      setStreamingText("");
      dispatch(setLoading(false));
    });

    socket.on("chat:error", () => {
      dispatch(addMessage({ role: "assistant", content: "Something went wrong." }));
      dispatch(setLoading(false));
    });

    return () => {
      socket.off("chat:session");
      socket.off("chat:chunk");
      socket.off("chat:done");
      socket.off("chat:error");
    };
  }, [dispatch]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMessage = input;
    setInput("");
    dispatch(addMessage({ role: "user", content: userMessage }));
    dispatch(setLoading(true));

    const socket = getSocket();
    socket.emit("chat:message", { message: userMessage, sessionId });
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1 h-screen bg-gray-50">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-lg p-3 rounded-lg ${
                msg.role === "user"
                  ? "bg-blue-600 text-white ml-auto"
                  : "bg-white border text-gray-800"
              }`}
            >
              {msg.content}
            </div>
          ))}
          {loading && streamingText && (
            <div className="max-w-lg p-3 rounded-lg bg-white border text-gray-800">
              {streamingText}
            </div>
          )}
          {loading && !streamingText && (
            <div className="text-gray-400 text-sm">Thinking...</div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 border rounded px-4 py-2"
          />
          <button
            onClick={handleSend}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}