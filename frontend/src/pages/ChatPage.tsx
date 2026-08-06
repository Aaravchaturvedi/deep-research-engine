import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../app/store";
import { addMessage, setSessionId, setLoading } from "../features/chat/chatSlice";
import { sendChatMessage } from "../features/chat/chatApi";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const dispatch = useDispatch();
  const { messages, sessionId, loading } = useSelector((state: RootState) => state.chat);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input;
    setInput("");
    dispatch(addMessage({ role: "user", content: userMessage }));
    dispatch(setLoading(true));

    try {
      const data = await sendChatMessage(userMessage, sessionId);
      dispatch(setSessionId(data.sessionId));
      dispatch(addMessage({ role: "assistant", content: data.reply }));
    } catch (err) {
      dispatch(addMessage({ role: "assistant", content: "Something went wrong." }));
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
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
        {loading && <div className="text-gray-400 text-sm">Thinking...</div>}
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
  );
}