import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "../app/store";
import { fetchSessions, fetchSessionMessages } from "../features/chat/sessionApi";
import { setSessions, loadSession, startNewChat, closeSidebar } from "../features/chat/chatSlice";

export default function Sidebar() {
  const dispatch = useDispatch();
  const { sessions, sessionId, isSidebarOpen } = useSelector((state: RootState) => state.chat);

  const loadSessions = async () => {
    const data = await fetchSessions();
    dispatch(setSessions(data));
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleSelect = async (id: string) => {
    const data = await fetchSessionMessages(id);
    dispatch(loadSession({ sessionId: data.session.id, messages: data.messages }));
    dispatch(closeSidebar()); // Close sidebar on mobile after selecting a chat
  };

  const handleNewChat = () => {
    dispatch(startNewChat());
    dispatch(closeSidebar()); // Close sidebar on mobile after clicking new chat
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" 
          onClick={() => dispatch(closeSidebar())}
        />
      )}

      {/* Sidebar Wrapper - Responsive */}
      <div className={`fixed md:relative z-40 w-64 bg-gray-900 text-white flex flex-col h-screen transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
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
    </>
  );
}