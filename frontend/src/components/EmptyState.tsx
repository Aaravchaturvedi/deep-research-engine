import { FileUp, Globe2, LineChart, Newspaper } from "lucide-react";
import Logo from "./Logo";

const SUGGESTIONS = [
  {
    icon: LineChart,
    title: "Market report",
    prompt: "Write a comprehensive market report on AI in 2024 with key players and projections.",
  },
  {
    icon: Newspaper,
    title: "Explain a topic",
    prompt: "Explain how retrieval-augmented generation works, with concrete examples.",
  },
  {
    icon: Globe2,
    title: "Compare options",
    prompt: "Compare Postgres vs MongoDB for a real-time analytics workload in 2026.",
  },
  {
    icon: FileUp,
    title: "Ask your document",
    prompt: "Upload a PDF with the button below, then ask me anything about it.",
  },
];

export default function EmptyState({ onSuggest }: { onSuggest: (prompt: string) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 pb-10 pt-10 text-center animate-fade-in sm:pt-16">
      <Logo size={56} />
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        What should we research today?
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-500 sm:text-[15px]">
        Ask anything — quick questions get instant answers, bigger ones get a full cited report.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            onClick={() => onSuggest(s.prompt)}
            className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[var(--shadow-pop)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
              <s.icon className="h-4.5 w-4.5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900">{s.title}</span>
              <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-slate-500">
                {s.prompt}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
