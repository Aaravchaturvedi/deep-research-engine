import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SessionSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  loading: boolean;
  sessions: SessionSummary[];
  isSidebarOpen: boolean; // property to track sidebar state
}

const initialState: ChatState = {
  sessionId: null,
  messages: [],
  loading: false,
  sessions: [],
  isSidebarOpen: false, // initialize sidebar state
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
    },
    setSessionId: (state, action: PayloadAction<string>) => {
      state.sessionId = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setSessions: (state, action: PayloadAction<SessionSummary[]>) => {
      state.sessions = action.payload;
    },
    loadSession: (
      state,
      action: PayloadAction<{ sessionId: string; messages: ChatMessage[] }>,
    ) => {
      state.sessionId = action.payload.sessionId;
      state.messages = action.payload.messages;
    },
    startNewChat: (state) => {
      state.sessionId = null;
      state.messages = [];
    },
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    closeSidebar: (state) => {
      state.isSidebarOpen = false;
    },
    openSidebar: (state) => {
      state.isSidebarOpen = true;
    }
  },
});

export const {
  addMessage,
  setSessionId,
  setLoading,
  setSessions,
  loadSession,
  toggleSidebar,
  closeSidebar,
  openSidebar,
  startNewChat,
} = chatSlice.actions;
export default chatSlice.reducer;
