import { useEffect, useMemo, useState } from "react";
import { Copy, Check, Send, LoaderCircle, TerminalSquare, Plus, X, ShieldAlert } from "lucide-react";
import endpointsData from "../data/endpoints.json";

type Param = { name: string; in: "path" | "query"; type: string; required?: boolean };
type Endpoint = {
  method: string;
  path: string;
  summary?: string;
  operationId?: string;
  params?: Param[];
  requestBody?: { contentType?: string; schema?: string } | null;
  responses?: { status: string; schema?: string }[];
  auth?: string;
};

type HeaderRow = { id: number; name: string; value: string };

type EndpointsData = { baseUrl: string; proxyUrl?: string; endpoints: Endpoint[] };
const data = endpointsData as EndpointsData;

const methodColors: Record<string, string> = {
  GET: "text-emerald-600 dark:text-emerald-400",
  POST: "text-sky-600 dark:text-sky-400",
  PUT: "text-amber-600 dark:text-amber-400",
  PATCH: "text-violet-600 dark:text-violet-400",
  DELETE: "text-rose-600 dark:text-rose-400",
};

const methodBg: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  POST: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PATCH: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (status >= 300 && status < 400) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
}

export function Playground() {
  const [selected, setSelected] = useState(0);
  const [baseUrl, setBaseUrl] = useState(data.baseUrl);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("weldrr-pg-token") ?? "");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState("");
  const [customHeaders, setCustomHeaders] = useState<HeaderRow[]>([]);
  const [proxyUsed, setProxyUsed] = useState(false);
  const [showCurl, setShowCurl] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; statusText: string; body: string; timeMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const endpoint = data.endpoints[selected];

  useEffect(() => {
    setParamValues({});
    setBodyText("");
    setCustomHeaders([]);
    setProxyUsed(false);
    setResponse(null);
    setError(null);
  }, [selected]);

  useEffect(() => {
    localStorage.setItem("weldrr-pg-token", authToken);
  }, [authToken]);

  const pathParams = useMemo(
    () => (endpoint.params ?? []).filter((p) => p.in === "path"),
    [endpoint],
  );
  const queryParams = useMemo(
    () => (endpoint.params ?? []).filter((p) => p.in === "query"),
    [endpoint],
  );

  function buildUrl(): string {
    let path = endpoint.path;
    for (const p of pathParams) {
      const value = (paramValues[p.name] ?? "").trim();
      path = path.replace(`:${p.name}`, encodeURIComponent(value || p.name));
    }
    const qs = queryParams
      .filter((p) => (paramValues[p.name] ?? "").trim() !== "")
      .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(paramValues[p.name].trim())}`);
    return `${baseUrl.replace(/\/+$/, "")}${path}${qs.length ? `?${qs.join("&")}` : ""}`;
  }

  function customHeaderPairs(): { name: string; value: string }[] {
    return customHeaders
      .map((h) => ({ name: h.name.trim(), value: h.value.trim() }))
      .filter((h) => h.name !== "");
  }

  function buildCurl(): string {
    const url = buildUrl();
    const parts = [`curl -X ${endpoint.method} '${url}'`];
    for (const h of customHeaderPairs()) {
      parts.push(`-H '${h.name}: ${h.value.replace(/'/g, "'\\''")}'`);
    }
    if (authToken) parts.push(`-H 'Authorization: Bearer ${authToken}'`);
    if (endpoint.requestBody && bodyText.trim()) {
      parts.push(`-H 'Content-Type: application/json'`);
      parts.push(`-d '${bodyText.replace(/'/g, "'\\''")}'`);
    }
    return parts.join(" \\\n  ");
  }

  async function doFetch(url: string, viaProxy: boolean): Promise<{ status: number; statusText: string; body: string }> {
    const headers: Record<string, string> = {};
    for (const h of customHeaderPairs()) headers[h.name] = h.value;
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    if (endpoint.requestBody && bodyText.trim()) headers["Content-Type"] = "application/json";

    if (viaProxy) {
      const proxyUrl = data.proxyUrl?.replace(/\/+$/, "");
      if (!proxyUrl) throw new Error("No proxy configured for this docs site");
      const res = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          method: endpoint.method,
          headers,
          body: endpoint.requestBody && bodyText.trim() ? bodyText : undefined,
        }),
        signal: AbortSignal.timeout(40_000),
      });
      const text = await res.text();
      return { status: res.status, statusText: res.statusText || "", body: text };
    }

    const res = await fetch(url, {
      method: endpoint.method,
      headers,
      body: endpoint.requestBody && bodyText.trim() ? bodyText : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    return { status: res.status, statusText: res.statusText, body: text };
  }

  async function send() {
    setLoading(true);
    setError(null);
    setResponse(null);
    setProxyUsed(false);
    const started = performance.now();
    const url = buildUrl();
    try {
      const result = await doFetch(url, false);
      setResponse({ ...result, timeMs: performance.now() - started });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort && data.proxyUrl) {
        try {
          const proxied = await doFetch(url, true);
          setProxyUsed(true);
          setResponse({ ...proxied, timeMs: performance.now() - started });
          return;
        } catch {
          // fall through to the direct-fetch error message
        }
      }
      setError(
        err instanceof Error
          ? isAbort
            ? "Request timed out after 30s."
            : `Could not reach the API directly (${err.message}). This is usually a CORS block — the request was not sent to the server. Use the cURL command, or if a proxy is configured, it will be attempted automatically.`
          : "Request failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-[calc(100vh-6.75rem)]">
      <div className="flex h-full">
        {/* Endpoint list */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border md:flex">
          <div className="border-b border-border px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Endpoints
            </div>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {data.endpoints.map((ep, i) => (
              <button
                key={`${ep.method}-${ep.path}`}
                type="button"
                onClick={() => setSelected(i)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                  i === selected ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <span className={`w-12 shrink-0 font-mono text-xs font-semibold ${methodColors[ep.method] ?? "text-muted-foreground"}`}>
                  {ep.method}
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground">{ep.path}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Request builder */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${methodBg[endpoint.method] ?? "bg-muted text-muted-foreground"}`}>
              {endpoint.method}
            </span>
            <span className="truncate font-mono text-sm">{endpoint.path}</span>
            {endpoint.auth && (
              <span className="ml-auto shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {endpoint.auth}
              </span>
            )}
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Base URL</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                spellCheck={false}
                className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30"
              />
            </div>

            {(pathParams.length > 0 || queryParams.length > 0) && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Parameters</label>
                <div className="space-y-2">
                  {[...pathParams, ...queryParams].map((p) => (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                        {p.name}
                        {p.in === "query" && <span className="text-muted-foreground/50">?</span>}
                      </span>
                      <input
                        value={paramValues[p.name] ?? ""}
                        onChange={(e) => setParamValues((v) => ({ ...v, [p.name]: e.target.value }))}
                        placeholder={p.required ? `${p.name} (required)` : `${p.name} (optional)`}
                        spellCheck={false}
                        className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Authorization</label>
              <input
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="API key or bearer token"
                spellCheck={false}
                className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-muted-foreground">Headers</label>
                <button
                  type="button"
                  onClick={() => setCustomHeaders((hs) => [...hs, { id: Date.now(), name: "", value: "" }])}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-opacity hover:opacity-80"
                >
                  <Plus size={12} />
                  Add header
                </button>
              </div>
              {customHeaders.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">
                  Optional custom headers (e.g. <span className="font-mono">X-API-Key</span>).
                </p>
              ) : (
                <div className="space-y-2">
                  {customHeaders.map((h) => (
                    <div key={h.id} className="flex items-center gap-2">
                      <input
                        value={h.name}
                        onChange={(e) =>
                          setCustomHeaders((hs) => hs.map((x) => (x.id === h.id ? { ...x, name: e.target.value } : x)))
                        }
                        placeholder="Header"
                        spellCheck={false}
                        className="w-36 shrink-0 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30"
                      />
                      <input
                        value={h.value}
                        onChange={(e) =>
                          setCustomHeaders((hs) => hs.map((x) => (x.id === h.id ? { ...x, value: e.target.value } : x)))
                        }
                        placeholder="Value"
                        spellCheck={false}
                        className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomHeaders((hs) => hs.filter((x) => x.id !== h.id))}
                        aria-label="Remove header"
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {endpoint.requestBody && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Request body <span className="text-muted-foreground/50">(JSON)</span>
                </label>
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder={endpoint.requestBody.schema ? `// ${endpoint.requestBody.schema}` : "{}"}
                  className="w-full resize-y rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/30"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={send}
              disabled={loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
              {loading ? "Sending…" : "Send request"}
            </button>
            <button
              type="button"
              onClick={() => setShowCurl((s) => !s)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <TerminalSquare size={14} />
              cURL
            </button>
            {showCurl && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(buildCurl());
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>

          {showCurl && (
            <div className="border-t border-border bg-muted/40 px-5 py-3">
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                {buildCurl()}
              </pre>
            </div>
          )}
        </div>

        {/* Response */}
        <aside className="hidden w-96 shrink-0 flex-col border-l border-border lg:flex">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Response
            </span>
            {response && (
              <span className={`ml-auto rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${statusColor(response.status)}`}>
                {response.status} {response.statusText}
              </span>
            )}
            {response && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {response.timeMs.toFixed(0)}ms
              </span>
            )}
            {proxyUsed && response && (
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground" title="The browser could not reach the API directly (CORS), so this request was relayed through a server-side proxy.">
                <ShieldAlert size={10} />
                via proxy
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto bg-muted/20 p-4">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <LoaderCircle size={16} className="mr-2 animate-spin" />
                Sending…
              </div>
            ) : error ? (
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-rose-600 dark:text-rose-400">
                {error}
              </pre>
            ) : response ? (
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                {prettyJson(response.body)}
              </pre>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                Select an endpoint and send a request to see the response here.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
