import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const linkStyles = {
  color: "rgb(37 99 235)",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
} as const;

const components = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-2xl font-bold mt-5 mb-3 text-gray-900 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-xl font-bold mt-4 mb-2 text-gray-900 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-lg font-bold mt-3 mb-2 text-gray-900 first:mt-0">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="text-base font-bold mt-3 mb-2 text-gray-900 first:mt-0">{children}</h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-3 text-gray-800 leading-relaxed first:mt-0 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-gray-900">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-gray-800">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-outside ml-6 my-3 space-y-1 text-gray-800">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-outside ml-6 my-3 space-y-1 text-gray-800">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 my-3 text-gray-600 italic">
      {children}
    </blockquote>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="bg-gray-100 text-pink-600 rounded px-1 py-0.5 text-sm font-mono">
      {children}
    </code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 my-3 overflow-x-auto text-sm font-mono">
      {children}
    </pre>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyles}>
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-gray-200" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border-collapse text-sm text-gray-800">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-gray-300 bg-gray-100 px-3 py-2 text-left font-bold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-gray-300 px-3 py-2">{children}</td>
  ),
};

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="w-full">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
