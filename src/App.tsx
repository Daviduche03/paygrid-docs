import { Routes, Route, Navigate, NavLink, useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Menu, Search, Moon, Sun, FileText, BookOpen, Terminal, Webhook, CreditCard, KeyRound, Users, ChevronRight, X } from "lucide-react";

const docs = import.meta.glob("./docs/**/*.mdx", { eager: true }) as Record<
  string,
  { default: React.ComponentType }
>;

type DocEntry = {
  slug: string;
  title: string;
  Component: React.ComponentType;
};

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
      "index": 0,
      "getting-started": 1,
      "api-keys": 2,
      "api-reference": 3,
      "customers": 4,
      "virtual-accounts": 5,
      "webhooks": 6,
    };
    return (order[a.slug] ?? 99) - (order[b.slug] ?? 99);
  });

const iconMap: Record<string, React.ReactNode> = {
  "index": <BookOpen size={18} />,
  "getting-started": <Terminal size={18} />,
  "virtual-accounts": <CreditCard size={18} />,
  "webhooks": <Webhook size={18} />,
  "api-keys": <KeyRound size={18} />,
  "api-reference": <FileText size={18} />,
  "customers": <Users size={18} />,
};

function DocPage() {
  const { "*": splat } = useParams();
  const slug = splat || "index";
  const entry = docEntries.find((e) => e.slug === slug);

  if (!entry) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Page not found
      </div>
    );
  }

  return (
    <article className="prose max-w-3xl mx-auto">
      <entry.Component />
    </article>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button
      onClick={toggle}
      className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
      aria-label="Toggle theme"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function SearchInput({ onSelect }: { onSelect: (slug: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return docEntries.filter((e) =>
      e.title.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-9 px-3 border border-border rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors w-full max-w-[320px]"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search docs...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
          <span>⌘</span>K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
          onClick={() => { setOpen(false); setQuery(""); }}
        >
          <div className="fixed inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-[560px] bg-background border border-border rounded-lg shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <input
                autoFocus
                placeholder="Search documentation..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={() => { setOpen(false); setQuery(""); }} className="text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </div>
            <div className="max-h-[320px] overflow-y-auto p-2">
              {results.length === 0 && query.trim() && (
                <div className="text-sm text-muted-foreground px-2 py-4 text-center">No results found</div>
              )}
              {results.map((entry) => (
                <button
                  key={entry.slug}
                  onClick={() => { onSelect(entry.slug); setOpen(false); setQuery(""); }}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                >
                  {iconMap[entry.slug] || <FileText size={18} className="text-muted-foreground" />}
                  <span>{entry.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SidebarNav({ expanded, onNavigate }: { expanded: boolean; onNavigate: () => void }) {
  return (
    <nav className="flex-1 space-y-1 px-3 pt-4">
      {docEntries.map((entry) => (
        <NavLink
          key={entry.slug}
          to={`/docs/${entry.slug}`}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 h-10 px-3 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`
          }
        >
          <span className="shrink-0">{iconMap[entry.slug] || <FileText size={18} />}</span>
          {expanded && (
            <span className="whitespace-nowrap overflow-hidden transition-opacity duration-150 delay-75">
              {entry.title}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function MobileMenu({ onNavigate }: { onNavigate: (slug: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden w-9 h-9 flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
      >
        <Menu size={18} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-[280px] bg-background border-r border-border h-full flex flex-col">
            <div className="flex items-center gap-3 h-16 px-4 border-b border-border">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M4.5 19 L8.5 5 L11.5 13 L14.5 5 L18.5 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm font-semibold">API Docs</span>
              <button onClick={() => setOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pb-4">
              <SidebarNav expanded={true} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const handleSearchSelect = useCallback((slug: string) => {
    navigate(`/docs/${slug}`);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed header */}
      <header className="fixed top-0 left-0 right-0 z-[70] h-16 border-b border-border bg-background flex items-stretch">
        <div className="hidden md:flex w-[70px] shrink-0 items-center justify-center border-r border-border">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M4.5 19 L8.5 5 L11.5 13 L14.5 5 L18.5 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm font-semibold">API Docs</span>
        </div>
        <div className="flex-1 flex items-center gap-4 px-4 md:px-6">
          <MobileMenu onNavigate={handleSearchSelect} />
          <div className="hidden sm:block flex-1 max-w-md">
            <SearchInput onSelect={handleSearchSelect} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className="fixed left-0 z-[60] hidden md:flex flex-col border-r border-border bg-background transition-all duration-200 overflow-hidden"
        style={{ top: "64px", height: "calc(100vh - 64px)", width: sidebarExpanded ? "240px" : "70px" }}
      >
        <SidebarNav expanded={sidebarExpanded} onNavigate={() => {}} />
      </aside>

      {/* Content */}
      <main
        className="transition-all duration-200"
        style={{ marginLeft: sidebarExpanded ? "240px" : "70px", paddingTop: "64px" }}
      >
        <div className="px-4 md:px-8 py-8">
          <Routes>
            <Route path="/docs/*" element={<DocPage />} />
            <Route path="*" element={<Navigate to="/docs/index" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
