import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  children: ReactNode;
  className?: string;
}

export function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = extractText(children);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative group border border-border rounded-lg overflow-hidden mb-4">
      <pre className={`bg-muted ${className || ""}`}>{children}</pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded border border-border bg-background opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
        aria-label="Copy code"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function extractText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    const el = children as { props: { children?: ReactNode; className?: string } };
    // If it's a <code> element, extract from its children
    if (el.props.className?.includes("language-")) {
      return extractText(el.props.children);
    }
    // If it's a span with tokens (rehype-pretty-code), extract text
    if (el.props.className?.includes("line")) {
      return extractText(el.props.children);
    }
    return extractText(el.props.children);
  }
  return "";
}
