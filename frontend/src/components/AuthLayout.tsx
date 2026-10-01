import type { ReactNode } from "react";
import { FileSearch, LibraryBig, MessagesSquare } from "lucide-react";
import Logo from "./Logo";

const highlights = [
  {
    icon: MessagesSquare,
    title: "Ask anything",
    text: "Chat naturally — quick answers stream back in seconds.",
  },
  {
    icon: FileSearch,
    title: "Deep research reports",
    text: "Multi-agent pipeline plans, searches, verifies and writes cited reports.",
  },
  {
    icon: LibraryBig,
    title: "Your documents, searchable",
    text: "Upload PDFs and docs, then ask questions grounded in them.",
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Brand panel */}
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 300px at 20% 10%, rgba(99,102,241,.35), transparent 60%), radial-gradient(500px 260px at 85% 90%, rgba(129,140,248,.22), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <Logo size={40} />
          <div>
            <p className="text-base font-bold leading-tight">Deep Research Engine</p>
            <p className="text-xs text-slate-400">Answers with receipts</p>
          </div>
        </div>

        <div className="relative space-y-6">
          <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight">
            Research that shows its work.
          </h2>
          <ul className="space-y-5">
            {highlights.map((h) => (
              <li key={h.title} className="flex gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <h.icon className="h-5 w-5 text-brand-300" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{h.title}</span>
                  <span className="block text-sm text-slate-400">{h.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          Cited reports · Document Q&amp;A · Private by design
        </p>
      </aside>

      {/* Form side */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <Logo size={36} />
            <p className="text-base font-bold text-slate-900">Deep Research Engine</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
