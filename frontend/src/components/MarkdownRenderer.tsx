import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { copyText } from "../lib/exportReport";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-1.5">
        <span className="font-mono text-xs text-slate-400">{language || "code"}</span>
        <button
          onClick={async () => {
            if (await copyText(code)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }
          }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Copy code block"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

const components = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-3 mt-6 border-b border-slate-100 pb-2 text-[22px] font-bold tracking-tight text-slate-900 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-2 mt-5 text-lg font-bold tracking-tight text-slate-900 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-2 mt-4 text-[15px] font-bold text-slate-900 first:mt-0">{children}</h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="mb-1.5 mt-3 text-sm font-bold text-slate-900 first:mt-0">{children}</h4>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-2.5 break-words text-[15px] leading-relaxed text-slate-700 first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="text-slate-600">{children}</em>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-2.5 ml-1 space-y-1.5 text-[15px] text-slate-700">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-2.5 ml-1 list-decimal space-y-1.5 pl-5 text-[15px] text-slate-700 [counter-reset:item]">
      {children}
    </ol>
  ),
  li: ({ children, ...props }: { children?: ReactNode; className?: string }) => {
    const cls = (props as { className?: string }).className || "";
    if (cls.includes("task-list-item")) {
      return <li className="list-none [&>input]:mr-2 [&>input]:accent-indigo-600">{children}</li>;
    }
    return (
      <li className="relative break-words list-none pl-6 leading-relaxed before:absolute before:left-1 before:top-[0.62em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand-400">
        {children}
      </li>
    );
  },
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-3 break-words rounded-r-xl border-l-[3px] border-brand-300 bg-brand-50/60 py-2 pl-4 pr-3 text-[15px] text-slate-600">
      {children}
    </blockquote>
  ),
  code: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => {
    if (className) {
      // Fenced block: rendered by the `pre` override below; keep raw text.
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800 ring-1 ring-slate-200">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: ReactNode }) => {
    // Extract language + raw code from the nested <code className="language-x">.
    let language = "";
    const code = textOf(children);
    const walk = (node: ReactNode): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === "object" && "props" in node) {
        const p = (node as { props: { className?: string } }).props;
        if (p.className?.startsWith("language-")) language = p.className.slice(9);
      }
    };
    walk(children);
    return <CodeBlock language={language} code={code.replace(/\n$/, "")} />;
  },
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 hover:text-brand-700 hover:decoration-brand-400"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-5 border-slate-200" />,
  table: ({ children }: { children?: ReactNode }) => (
    <div className="nice-scroll my-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full border-collapse text-sm text-slate-700">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="bg-slate-50">{children}</thead>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b border-slate-200 px-3.5 py-2.5 text-left text-[13px] font-semibold text-slate-900">
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-slate-100 px-3.5 py-2.5 align-top last:border-b-0">{children}</td>
  ),
};

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="w-full min-w-0 break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
