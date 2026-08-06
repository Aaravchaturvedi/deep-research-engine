import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  loading: boolean;
}

const initialState: ChatState = {
  sessionId: null,
  messages: [],
  loading: false,
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
  },
});

export const { addMessage, setSessionId, setLoading } = chatSlice.actions;
export default chatSlice.reducer;