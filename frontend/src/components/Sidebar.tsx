import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "../app/store";
import { fetchSessions, fetchSessionMessages } from "../features/chat/sessionApi";
import { setSessions, loadSession, startNewChat } from "../features/chat/chatSlice";

export default function Sidebar() {
  const dispatch = useDispatch();
  const { sessions, sessionId } = useSelector((state: RootState) => state.chat);

  // 1. Define the function FIRST
  const loadSessions = async () => {
    const data = await fetchSessions();
    dispatch(setSessions(data));
  };

  // 2. Then use it in the useEffect
  useEffect(() => {
    loadSessions();
  }, []);

  const handleSelect = async (id: string) => {
    const data = await fetchSessionMessages(id);
    dispatch(loadSession({ sessionId: data.session.id, messages: data.messages }));
  };

  const handleNewChat = () => {
    dispatch(startNewChat());
  };

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-screen">
      <div className="p-4">
        <button
          onClick={handleNewChat}
          className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded text-sm"
        >
          + New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => handleSelect(s.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm truncate ${
              s.id === sessionId ? "bg-gray-700" : "hover:bg-gray-800"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}