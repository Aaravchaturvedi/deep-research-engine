import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ChevronsRight, Menu, Plus } from "lucide-react";
import { type RootState } from "../app/store";
import {
  addMessage,
  setSessionId,
  setLoading,
  toggleSidebar,
  toggleSidebarCollapsed,
  loadSession,
  startNewChat,
} from "../features/chat/chatSlice";
import { setUser } from "../features/auth/authSlice";
import { fetchMe } from "../features/auth/authApi";
import { getSocket } from "../lib/socket";
import Sidebar from "../components/Sidebar";
import ChatMessage from "../components/ChatMessage";
import Composer from "../components/Composer";
import EmptyState from "../components/EmptyState";
import ProgressStepper from "../components/ProgressStepper";
import { useToast } from "../components/Toasts";
import { setSessions } from "../features/chat/chatSlice";
import { fetchSessions, fetchSessionMessages } from "../features/chat/sessionApi";
import { uploadDocument } from "../features/chat/uploadApi";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [progressStep, setProgressStep] = useState("");
  const [isResearchRun, setIsResearchRun] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const dispatch = useDispatch();
  const { push } = useToast();
  const { messages, sessionId, loading, sessions, sidebarCollapsed } = useSelector(
    (state: RootState) => state.chat
  );
  const streamingRef = useRef("");
  const ignoreRef = useRef(false); // set on Stop: late events from the killed run are dropped
  const loadingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  // Live elapsed timer while a run is in flight.
  useEffect(() => {
    if (!loading) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [loading]);

  // Populate the sidebar user card (refresh flow only restores the token).
  useEffect(() => {
    fetchMe()
      .then((u) => dispatch(setUser({ id: u.id, email: u.email, name: u.name })))
      .catch(() => {});
  }, [dispatch]);

  const finishRun = useCallback(() => {
    streamingRef.current = "";
    setStreamingText("");
    setProgressStep("");
    setIsResearchRun(false);
    dispatch(setLoading(false));
  }, [dispatch]);

  useEffect(() => {
    const socket = getSocket();

    socket.on("chat:session", async ({ sessionId }) => {
      dispatch(setSessionId(sessionId));
      try {
        const data = await fetchSessions();
        dispatch(setSessions(data));
      } catch {
        /* list refresh is best-effort here */
      }
    });

    socket.on("chat:chunk", ({ chunk }) => {
      if (ignoreRef.current) return;
      streamingRef.current += chunk;
      setStreamingText(streamingRef.current);
    });

    socket.on("research:progress", (data) => {
      if (ignoreRef.current) return;
      setIsResearchRun(true);
      setProgressStep(data.step);
    });

    socket.on("chat:done", ({ fullResponse }) => {
      if (ignoreRef.current) return;
      dispatch(addMessage({ role: "assistant", content: fullResponse }));
      finishRun();
    });

    socket.on("chat:error", ({ error }) => {
      if (ignoreRef.current) return;
      dispatch(addMessage({ role: "assistant", content: `Something went wrong: ${error || "please try again."}` }));
      push("error", "The run failed. Try again.");
      finishRun();
    });

    socket.on("chat:stopped", () => {
      if (!loadingRef.current && !streamingRef.current) return;
      if (streamingRef.current) {
        dispatch(
          addMessage({ role: "assistant", content: `${streamingRef.current}\n\n*Stopped by user.*` })
        );
      }
      finishRun();
      push("info", "Run stopped.");
    });

    return () => {
      socket.off("chat:session");
      socket.off("chat:chunk");
      socket.off("research:progress");
      socket.off("chat:done");
      socket.off("chat:error");
      socket.off("chat:stopped");
    };
  }, [dispatch, finishRun, push]);

  const sendMessage = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || loadingRef.current || uploading) return;
      ignoreRef.current = false;
      setInput("");
      dispatch(addMessage({ role: "user", content: message }));
      dispatch(setLoading(true));
      setRunStartedAt(Date.now());
      setNow(Date.now());
      setProgressStep("");
      setIsResearchRun(false);
      getSocket().emit("chat:message", { message, sessionId });
      window.setTimeout(scrollToBottom, 50);
    },
    [dispatch, sessionId, uploading]
  );

  const handleSend = () => sendMessage(input);

  const handleStop = () => {
    ignoreRef.current = true;
    getSocket().emit("chat:stop", {});
    // Optimistic UI: don't wait for the server ack.
    if (streamingRef.current) {
      dispatch(
        addMessage({ role: "assistant", content: `${streamingRef.current}\n\n*Stopped by user.*` })
      );
    }
    finishRun();
  };

  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser && !lastUser.content.startsWith("📎 Uploading ")) {
      sendMessage(lastUser.content);
    }
  };

  const uploadFile = useCallback(
    async (file: File) => {
      if (uploading) return;
      setUploading(true);
      dispatch(addMessage({ role: "user", content: `📎 Uploading ${file.name}…` }));
      try {
        const result = await uploadDocument(file, sessionId);
        dispatch(setSessionId(result.sessionId));
        const data = await fetchSessionMessages(result.sessionId);
        dispatch(loadSession({ sessionId: data.session.id, messages: data.messages }));
        const list = await fetchSessions();
        dispatch(setSessions(list));
        push("success", `"${result.filename}" ready — ${result.chunks} chunks indexed.`);
    } catch (err: unknown) {
      const apiError =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      const msg = apiError || "Document upload failed. Please try again.";
        dispatch(addMessage({ role: "assistant", content: `Upload failed: ${msg}` }));
        push("error", msg);
      } finally {
        setUploading(false);
      }
    },
    [dispatch, push, sessionId, uploading]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await uploadFile(file);
  };

  // Press "/" anywhere to focus the composer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(t.tagName)) {
        e.preventDefault();
        composerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeTitle =
    sessions.find((s) => s.id === sessionId)?.title ||
    (messages.length > 0 ? messages[0].content.slice(0, 42) : "New chat");

  const showEmpty = messages.length === 0 && !loading;

  return (
    <div
      className="flex h-screen overflow-hidden"
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current++;
        if (e.dataTransfer.types.includes("Files")) setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        if (--dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void uploadFile(file);
      }}
    >
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
        {/* Header */}
        <header className="flex items-center gap-2 border-b border-slate-200 bg-white/80 px-3 py-2.5 backdrop-blur sm:px-5">
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          {sidebarCollapsed && (
            <button
              onClick={() => dispatch(toggleSidebarCollapsed())}
              className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:block"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronsRight className="h-5 w-5" />
            </button>
          )}
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 sm:text-[15px]">
            {activeTitle}
          </h1>
          <button
            onClick={() => dispatch(startNewChat())}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
            title="Start a new chat"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New chat</span>
          </button>
        </header>

        {/* Messages */}
        <div className="nice-scroll flex-1 overflow-y-auto">
          {showEmpty ? (
            <EmptyState onSuggest={sendMessage} />
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
              {messages.map((msg, i) => (
                <ChatMessage
                  key={`${sessionId ?? "new"}-${i}`}
                  message={msg}
                  sessionTitle={activeTitle}
                  onRegenerate={msg.role === "assistant" ? handleRegenerate : undefined}
                  regenerateDisabled={loading}
                />
              ))}

              {loading && streamingText && (
                <div className="flex w-full gap-3 animate-fade-in">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-[var(--shadow-card)] sm:px-5 sm:py-4">
                    <div className="break-words text-[15px] leading-relaxed text-slate-800">
                      {streamingText}
                      <span className="ml-0.5 inline-block h-4 w-[7px] animate-pulse bg-brand-400 align-middle" />
                    </div>
                  </div>
                </div>
              )}

              {loading && !streamingText && isResearchRun && progressStep && (
                <ProgressStepper step={progressStep} startedAt={runStartedAt} now={now} />
              )}

              {loading && !streamingText && (!isResearchRun || !progressStep) && (
                <div className="flex w-full gap-3 animate-fade-in">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-[var(--shadow-card)] sm:px-5 sm:py-4">
                    <p className="flex items-center gap-1.5 text-[15px] text-slate-500">
                      Thinking
                      <span className="flex gap-1" aria-hidden>
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                        <span
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                          style={{ animationDelay: "300ms" }}
                        />
                      </span>
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6 sm:py-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.csv"
              className="hidden"
              onChange={handleFileSelect}
              aria-hidden
              tabIndex={-1}
            />
            <Composer
              value={input}
              onChange={setInput}
              onSend={handleSend}
              onStop={handleStop}
              loading={loading}
              uploading={uploading}
              onAttach={() => fileInputRef.current?.click()}
              composerRef={composerRef}
            />
            <p className="mt-2 text-center text-xs text-slate-400">
              Reports cite their sources · Verify important claims before acting on them
            </p>
          </div>
        </div>
      </div>

      {/* Drag-drop overlay */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-brand-600/10 p-6 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-brand-400 bg-white px-12 py-10 shadow-[var(--shadow-pop)]">
            <FileIcon />
            <p className="text-base font-semibold text-slate-900">Drop to upload</p>
            <p className="text-sm text-slate-500">PDF, TXT or CSV — I’ll index it for Q&amp;A</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="stroke-brand-500">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <polyline points="9 15 12 12 15 15" />
    </svg>
  );
}
