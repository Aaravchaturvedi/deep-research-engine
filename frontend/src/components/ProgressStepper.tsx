import {
  BadgeCheck,
  BookOpenText,
  ClipboardList,
  Database,
  Globe,
  PenLine,
  ShieldCheck,
} from "lucide-react";

const STAGES = [
  { label: "Planning", icon: ClipboardList, keys: ["planning"] },
  { label: "Searching", icon: Globe, keys: ["searching"] },
  { label: "Reading sources", icon: BookOpenText, keys: ["fetching"] },
  { label: "Embedding", icon: Database, keys: ["embedding"] },
  { label: "Writing", icon: PenLine, keys: ["drafting", "evaluating"] },
  { label: "Verifying", icon: ShieldCheck, keys: ["cross-checking", "mapping"] },
] as const;

function stageIndexForStep(step: string): number {
  const s = step.toLowerCase();
  let idx = -1;
  STAGES.forEach((st, i) => {
    if (st.keys.some((k) => s.includes(k))) idx = i;
  });
  return idx;
}

function formatElapsed(startedAt: number): string {
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default function ProgressStepper({
  step,
  startedAt,
  now,
}: {
  step: string;
  startedAt: number;
  now: number;
}) {
  // Re-render tick uses `now` so the elapsed timer stays live.
  void now;
  const current = stageIndexForStep(step);
  return (
    <div className="w-full animate-fade-in rounded-2xl border border-brand-100 bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-slate-700">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <span className="truncate animate-pulse-soft">{step || "Starting pipeline…"}</span>
        </p>
        <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 font-mono text-xs font-medium text-brand-700">
          {formatElapsed(startedAt)}
        </span>
      </div>

      {/* Shimmer bar */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--color-brand-500) 30%, var(--color-brand-200) 50%, var(--color-brand-500) 70%)",
            backgroundSize: "200% 100%",
            animation: "var(--animate-shimmer)",
          }}
        />
      </div>

      {/* Stage timeline */}
      <ol className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
        {STAGES.map((st, i) => {
          const done = current > i;
          const active = current === i;
          const Icon = done ? BadgeCheck : st.icon;
          return (
            <li
              key={st.label}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium sm:flex-col sm:gap-1 sm:py-2 sm:text-center sm:text-xs ${
                done
                  ? "text-emerald-700"
                  : active
                    ? "bg-brand-50 text-brand-700 ring-1 ring-brand-100"
                    : "text-slate-400"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "animate-pulse-soft" : ""}`} />
              <span className="truncate">{st.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
