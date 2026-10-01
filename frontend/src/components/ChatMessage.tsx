import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  FileUp,
  Loader2,
  RotateCcw,
  User,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import { copyText, downloadMarkdown, downloadPdf, wordCount } from "../lib/exportReport";
import { useToast } from "./Toasts";

export interface ChatMessageData {
  role: "user" | "assistant";
  content: string;
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  if (role === "user") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
        <User className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white">
      <Bot className="h-4 w-4" />
    </span>
  );
}

function ActionButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
    >
      {children}
    </button>
  );
}

export default function ChatMessage({
  message,
  sessionTitle,
  onRegenerate,
  regenerateDisabled,
}: {
  message: ChatMessageData;
  sessionTitle: string;
  onRegenerate?: () => void;
  regenerateDisabled?: boolean;
}) {
  const { push } = useToast();
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const doCopy = async () => {
    if (await copyText(message.content)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      push("error", "Copy failed in this browser.");
    }
  };

  const isUploadNote =
    message.role === "user" &&
    (message.content.startsWith("📎 Uploading ") || message.content.startsWith("Upload failed:"));

  if (message.role === "user") {
    return (
      <div className="flex w-full justify-end gap-3 animate-fade-in">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-3 text-white shadow-[var(--shadow-card)] sm:max-w-[75%]">
          {isUploadNote ? (
            <p className="flex items-center gap-2 text-sm">
              {message.content.startsWith("📎") ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              <span className="whitespace-pre-wrap">{message.content.replace(/^📎 /, "")}</span>
            </p>
          ) : (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
          )}
        </div>
        <Avatar role="user" />
      </div>
    );
  }

  const words = wordCount(message.content);

  return (
    <div className="flex w-full gap-3 animate-fade-in">
      <Avatar role="assistant" />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white shadow-[var(--shadow-card)]">
        {/* Report header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <span className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium">
              {words > 150 ? "Research report" : "Answer"} · {words} words
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <ActionButton onClick={doCopy} title="Copy to clipboard">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </ActionButton>
            {onRegenerate && (
              <ActionButton
                onClick={onRegenerate}
                title="Regenerate response"
              >
                <span className={regenerateDisabled ? "pointer-events-none opacity-40" : ""}>
                  <RotateCcw className="h-4 w-4" />
                </span>
              </ActionButton>
            )}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setExportOpen((o) => !o)}
                title="Export report"
                aria-label="Export report"
                aria-expanded={exportOpen}
                className="flex items-center gap-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <Download className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[var(--shadow-pop)]">
                  <button
                    onClick={async () => {
                      setExportOpen(false);
                      try {
                        await downloadPdf(message.content, sessionTitle);
                        push("success", "PDF downloaded.");
                      } catch {
                        push("error", "PDF export failed. Try again.");
                      }
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <FileText className="h-4 w-4 text-slate-400" /> Download PDF
                  </button>
                  <button
                    onClick={() => {
                      downloadMarkdown(message.content, sessionTitle);
                      setExportOpen(false);
                      push("success", "Markdown downloaded.");
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4 text-slate-400" /> Download .md
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 sm:px-5 sm:py-4">
          <MarkdownRenderer content={message.content} />
        </div>
      </div>
    </div>
  );
}
