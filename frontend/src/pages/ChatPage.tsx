import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "../app/store";
import { addMessage, setSessionId, setLoading, toggleSidebar, loadSession } from "../features/chat/chatSlice";
import { getSocket } from "../lib/socket";
import Sidebar from "../components/Sidebar";
import { setSessions } from "../features/chat/chatSlice";
import { fetchSessions, fetchSessionMessages } from "../features/chat/sessionApi";
import { uploadDocument } from "../features/chat/uploadApi";
import MarkdownRenderer from "../components/MarkdownRenderer";
import html2pdf from "html2pdf.js";

// Minimal markdown -> HTML for PDF export (the on-screen renderer stays ReactMarkdown).
function markdownToHtml(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const inline = (s: string) =>
    s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|\W)\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const lines = escaped.split("\n");
  const out: string[] = [];
  let listOpen: "ul" | "ol" | null = null;
  const closeList = () => {
    if (listOpen) {
      out.push(listOpen === "ul" ? "</ul>" : "</ol>");
      listOpen = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (line.startsWith("### ")) {
      closeList();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      closeList();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      closeList();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith("&gt; ")) {
      closeList();
      out.push(`<blockquote>${inline(line.slice(5))}</blockquote>`);
    } else if (/^(-|\*) /.test(line)) {
      if (listOpen !== "ul") {
        closeList();
        out.push("<ul>");
        listOpen = "ul";
      }
      out.push(`<li>${inline(line.replace(/^(-|\*) /, ""))}</li>`);
    } else if (/^\d+\. /.test(line)) {
      if (listOpen !== "ol") {
        closeList();
        out.push("<ol>");
        listOpen = "ol";
      }
      out.push(`<li>${inline(line.replace(/^\d+\. /, ""))}</li>`);
    } else if (/^(-{3,}|\*{3*})$/.test(line)) {
      closeList();
      out.push("<hr/>");
    } else {
      closeList();
      out.push(`<p>${inline(raw.trim())}</p>`);
    }
  }
  closeList();
  return out.join("");
}

function handleDownloadPDF(markdownText: string, index: number) {
  const element = document.createElement("div");
  element.innerHTML = markdownToHtml(markdownText);
  element.style.padding = "24px";
  element.style.fontFamily = "Arial, sans-serif";
  element.style.color = "#111827";
  element.style.lineHeight = "1.6";
  html2pdf()
    .set({
      margin: 12,
      filename: `report-${index + 1}.pdf`,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(element)
    .save();
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [progressStep, setProgressStep] = useState(""); // <--- ADDED for progress bar
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dispatch = useDispatch();
  const { messages, sessionId, loading } = useSelector((state: RootState) => state.chat);
  const streamingRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

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

    // <--- ADDED: Listen for research progress updates
    socket.on("research:progress", (data) => {
      setProgressStep(data.step);
    });

    socket.on("chat:done", ({ fullResponse }) => {
      dispatch(addMessage({ role: "assistant", content: fullResponse }));
      streamingRef.current = "";
      setStreamingText("");
      setProgressStep(""); // <--- ADDED: Clear progress when done
      dispatch(setLoading(false));
    });

    socket.on("chat:error", () => {
      dispatch(addMessage({ role: "assistant", content: "Something went wrong." }));
      dispatch(setLoading(false));
    });

    return () => {
      socket.off("chat:session");
      socket.off("chat:chunk");
      socket.off("research:progress"); // <--- ADDED: Cleanup
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file || uploading) return;

    setUploading(true);
    dispatch(
      addMessage({ role: "user", content: `📎 Uploading ${file.name}...` })
    );
    try {
      // Pass the open session so the doc attaches to it instead of
      // creating a new chat. Backend creates one only when sessionId is null.
      const result = await uploadDocument(file, sessionId);
      dispatch(setSessionId(result.sessionId));
      const data = await fetchSessionMessages(result.sessionId);
      dispatch(
        loadSession({ sessionId: data.session.id, messages: data.messages })
      );
      const sessions = await fetchSessions();
      dispatch(setSessions(sessions));
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || "Document upload failed. Please try again.";
      dispatch(addMessage({ role: "assistant", content: `Upload failed: ${msg}` }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      
      <div className="flex flex-col flex-1 h-screen bg-gray-50">
        
        {/* Mobile Header with Hamburger Menu */}
        <div className="flex items-center gap-3 p-4 border-b bg-white md:hidden">
          <button onClick={() => dispatch(toggleSidebar())} className="text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h1 className="font-semibold">Chat</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`w-full flex ${msg.role === "user" ? "justify-end" : ""}`}
              >
                <div
                  className={`rounded-lg p-4 flex ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white max-w-[85%]"
                      : "bg-white border text-gray-800 w-full"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="w-full">
                      <MarkdownRenderer content={msg.content} />
                      <button
                        onClick={() => handleDownloadPDF(msg.content, i)}
                        title="Export this report as PDF"
                        className="mt-3 text-xs font-medium text-blue-600 border border-blue-200 rounded px-3 py-1.5 hover:bg-blue-50"
                      >
                        Download PDF
                      </button>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && streamingText && (
              <div className="w-full p-4 rounded-lg bg-white border text-gray-800 flex">
                <div className="w-full">
                  <MarkdownRenderer content={streamingText} />
                </div>
              </div>
            )}

            {loading && !streamingText && (
              <div className="w-full p-4 rounded-lg bg-white border text-gray-800 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-gray-600 animate-pulse">{progressStep || "Starting pipeline..."}</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        <div className="p-4 border-t bg-white">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || loading}
              title="Upload document (PDF, TXT, CSV)"
              className="border rounded px-4 py-2 hover:bg-gray-100 disabled:opacity-50"
            >
              {uploading ? "⏳" : "📎"}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                uploading ? "Uploading document..." : "Type a message..."
              }
              disabled={uploading}
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
    </div>
  );
}