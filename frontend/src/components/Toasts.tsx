import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

// Provider + hook live together by design (single import for consumers).
/* eslint-disable react-refresh/only-export-components */

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ push: (kind: ToastKind, message: string) => void }>({
  push: () => {},
});

export const useToast = () => useContext(ToastContext);

let nextId = 1;

const icons: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const styles: Record<ToastKind, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-brand-200 bg-brand-50 text-brand-800",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => {
          const Icon = icons[t.kind];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-[var(--shadow-pop)] animate-fade-in ${styles[t.kind]}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
                className="rounded p-0.5 opacity-60 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
