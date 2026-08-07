import { Routes, Route, Navigate, NavLink, useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Home,
  Rocket,
  BookOpen,
  Search,
  Moon,
  Sun,
  FileText,
  ChevronRight,
  Play,
} from "lucide-react";
import { Playground } from "./components/playground";

const docs = import.meta.glob("./docs/**/*.mdx", { eager: true }) as Record<
  string,
  { default: React.ComponentType }
>;

type DocEntry = {
  slug: string;
  title: string;
  Component: React.ComponentType;
};

const PRIMARY_SLUGS = ["index", "getting-started", "api-reference"];

const docEntries: DocEntry[] = Object.entries(docs)
  .map(([filepath, mod]) => {
    const slug = filepath.replace("./docs/", "").replace(/\.mdx$/, "");
    const title = slug
      .split("/")
      .pop()!
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bApi\b/g, "API");
    return { slug, title, Component: mod.default };
  })
  .sort((a, b) => {
    const order: Record<string, number> = {
      index: 0,
      "getting-started": 1,
      "api-reference": 2,
    };
    return (order[a.slug] ?? 99) - (order[b.slug] ?? 99);
  });

const iconMap: Record<string, React.ReactNode> = {
  index: <Home size={18} />,
  "getting-started": <Rocket size={18} />,
  "api-reference": <BookOpen size={18} />,
};

const tabs = docEntries.filter((e) => PRIMARY_SLUGS.includes(e.slug));

type NavItem = { slug: string; title: string };
const navItems: NavItem[] = [...tabs.map((t) => ({ slug: t.slug, title: t.title })), { slug: "playground", title: "Playground" }];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ---------------------------------- Brand ---------------------------------- */

function WMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ transform: "rotate(180deg)" }}
    >
      <path
        d="M4.5 19 L8.5 5 L11.5 13 L14.5 5 L18.5 19"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="21" r="1.3" fill="currentColor" />
    </svg>
  );
}

function Brand() {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <WMark className="h-5 w-5 text-primary" />
      <span className="text-sm font-semibold tracking-tight text-foreground">API Docs</span>
    </div>
  );
}

/* -------------------------- Expandable search -------------------------- */

function ExpandableSearch({ onSelect }: { onSelect: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docEntries;
    return docEntries.filter((e) => e.title.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function close() {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  return (
    <div className="relative z-40">
      <div
        className={`flex h-9 items-center gap-2 rounded-full border transition-all duration-200 ${
          open
            ? "w-72 border-ring bg-background shadow-lg sm:w-[24rem]"
            : "w-44 border-border bg-muted hover:bg-accent"
        }`}
      >
        <Search size={14} className="ml-3 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="Search docs…"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {!open && (
          <kbd className="mr-2.5 shrink-0 rounded border border-border px-1 py-0.5 text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-10 w-72 overflow-hidden rounded-xl border border-border bg-background shadow-xl sm:w-[24rem]">
          <div className="max-h-[320px] overflow-y-auto p-1.5">
            {results.length === 0 && query.trim() && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No results found
              </div>
            )}
            {results.map((entry) => (
              <button
                key={entry.slug}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(entry.slug);
                  close();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
              >
                <span className="shrink-0 text-muted-foreground">
                  {iconMap[entry.slug] || <FileText size={16} />}
                </span>
                <span className="truncate">{entry.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Theme toggle ------------------------------- */

function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") !== "light");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-label="Toggle theme"
      className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/* -------------------------------- Sidebar -------------------------------- */

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="sticky top-[6.75rem] hidden h-[calc(100vh-6.75rem)] w-60 shrink-0 overflow-y-auto border-r border-border lg:block">
      <nav className="space-y-0.5 p-4">
        <div className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Pages
        </div>
        {docEntries.map((entry) => (
          <NavLink
            key={entry.slug}
            to={`/docs/${entry.slug}`}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`
            }
          >
            <span className="shrink-0">{iconMap[entry.slug] || <FileText size={16} />}</span>
            <span className="truncate">{entry.title}</span>
          </NavLink>
        ))}
        <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Tools
        </div>
        <NavLink
          to="/docs/playground"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`
          }
        >
          <span className="shrink-0"><Play size={16} /></span>
          <span className="truncate">Playground</span>
        </NavLink>
      </nav>
    </aside>
  );
}

/* ------------------------------ On this page ------------------------------ */

type TocItem = { id: string; text: string; level: number };

function OnThisPage({ toc }: { toc: TocItem[] }) {
  if (toc.length === 0) return null;
  return (
    <aside className="sticky top-[6.75rem] hidden h-[calc(100vh-6.75rem)] w-56 shrink-0 overflow-y-auto border-l border-border xl:block">
      <nav className="p-5">
        <div className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          On this page
        </div>
        <ul className="space-y-1 border-l border-border">
          {toc.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`block truncate border-l transition-colors hover:text-foreground ${
                  item.level === 2
                    ? "ml-0 border-l-2 border-transparent py-1 text-[13px] font-medium text-muted-foreground hover:border-brand"
                    : "ml-3 border-l-2 border-transparent py-0.5 text-xs text-muted-foreground/70 hover:border-brand"
                }`}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/* -------------------------------- Doc shell -------------------------------- */

function DocShell() {
  const { "*": splat } = useParams();
  const slug = splat || "index";
  const articleRef = useRef<HTMLElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);

  const entry = docEntries.find((e) => e.slug === slug);

  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const seen: Record<string, number> = {};
    const items: TocItem[] = [];
    el.querySelectorAll("h2, h3").forEach((h) => {
      const text = h.textContent?.trim() || "";
      if (!text) return;
      let id = slugify(text);
      seen[id] = (seen[id] ?? 0) + 1;
      if (seen[id] > 1) id = `${id}-${seen[id]}`;
      h.id = id;
      items.push({ id, text, level: h.tagName === "H2" ? 2 : 3 });
    });
    setToc(items);
  }, [slug]);

  if (!entry) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Page not found
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1">
      <main className="min-w-0 flex-1">
        <article
          ref={articleRef}
          className="prose mx-auto max-w-3xl px-6 py-10 sm:px-10 lg:px-12"
        >
          <entry.Component />
        </article>

        <footer className="mx-auto max-w-3xl px-6 pb-10 sm:px-10 lg:px-12">
          <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
            <span className="text-xs text-muted-foreground">
              {entry.title} · API Docs
            </span>
            <a
              href="https://weldrr.app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <WMark className="h-3.5 w-3.5" />
              Powered by Weldrr
            </a>
          </div>
        </footer>
      </main>
      <OnThisPage toc={toc} />
    </div>
  );
}

/* --------------------------------- App --------------------------------- */

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPlayground = location.pathname.startsWith("/docs/playground");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-5 sm:px-8">
          <Brand />
          <ExpandableSearch onSelect={(slug) => navigate(`/docs/${slug}`)} />
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate("/docs/getting-started")}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get started
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Sub-nav tabs */}
        <nav className="flex h-11 items-center gap-1 overflow-x-auto border-t border-border px-5 sm:px-8">
          {navItems.map((entry) => (
            <NavLink
              key={entry.slug}
              to={`/docs/${entry.slug}`}
              className={({ isActive }) =>
                `-mb-px inline-flex h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {entry.title}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* 3-column layout */}
      <div className="flex items-start">
        {!isPlayground && <Sidebar />}
        <Routes>
          <Route path="/docs/playground" element={<Playground />} />
          <Route path="/docs/*" element={<DocShell />} />
          <Route path="*" element={<Navigate to="/docs/index" replace />} />
        </Routes>
      </div>
    </div>
  );
}
