import { useEffect } from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  loading,
  uploading,
  onAttach,
  composerRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  uploading: boolean;
  onAttach: () => void;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const busy = loading || uploading;

  // Autogrow up to ~200px, then scroll internally.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value, composerRef]);

  const canSend = value.trim().length > 0 && !busy;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] transition focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100">
      <textarea
        ref={composerRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        rows={1}
        placeholder={uploading ? "Uploading document…" : "Ask anything — or request a full report…"}
        disabled={uploading}
        aria-label="Message input"
        className="nice-scroll max-h-[200px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
      />
      <div className="flex items-center justify-between px-2.5 pb-2.5 pt-1">
        <div className="flex items-center gap-1">
          <button
            onClick={onAttach}
            disabled={busy}
            title="Upload document (PDF, TXT, CSV)"
            aria-label="Upload document"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>
          <span className="hidden text-xs text-slate-300 sm:inline">Enter to send · Shift+Enter for a new line</span>
        </div>
        {loading ? (
          <button
            onClick={onStop}
            title="Stop generating"
            aria-label="Stop generating"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-700"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!canSend}
            title="Send message"
            aria-label="Send message"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowUp className="h-4.5 w-4.5" />
          </button>
        )}
      </div>
    </div>
  );
}
