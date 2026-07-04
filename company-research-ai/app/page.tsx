"use client";

import { useState, useRef, useEffect } from "react";

type Competitor = { name: string; website: string };

type ResearchResult = {
  companyName: string;
  summary: string;
  products: string[];
  painPoints: string[];
  competitors: Competitor[];
  website: string;
  crawledPages: string[];
};

type Step = "queued" | "locating" | "crawling" | "analyzing" | "done" | "error";

type Entry = {
  id: string;
  input: string;
  model: string;
  step: Step;
  result?: ResearchResult;
  error?: string;
};

const MODELS = [
  { id: "cohere/north-mini-code-20260617:free", label: "Standard — fast" },
  { id: "poolside/laguna-xs-2.1-20260625:free", label: "Deep analysis — slower" },
  { id: "openrouter/free", label: "Auto — let router pick" },
];

const STEP_LABELS: Record<Step, string> = {
  queued: "Queued",
  locating: "Locating official site",
  crawling: "Reading site & sources",
  analyzing: "Compiling brief",
  done: "Complete",
  error: "Failed",
};

const STEP_ORDER: Step[] = ["locating", "crawling", "analyzing", "done"];

export default function Home() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [entries, setEntries] = useState<Entry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  async function runResearch(query: string, selectedModel: string) {
    const id = crypto.randomUUID();
    setEntries((prev) => [
      ...prev,
      { id, input: query, model: selectedModel, step: "locating" },
    ]);

    // Simulate visible step progression while the single request resolves —
    // the API does search+crawl+AI in one call, so we advance the UI steps
    // on a timer to give honest, non-blocking feedback rather than a static spinner.
    const stepTimer = setTimeout(() => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id && e.step === "locating" ? { ...e, step: "crawling" } : e))
      );
    }, 1800);
    const stepTimer2 = setTimeout(() => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id && e.step === "crawling" ? { ...e, step: "analyzing" } : e))
      );
    }, 4500);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: query, model: selectedModel }),
      });

      const data = await res.json();
      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);

      if (!res.ok) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, step: "error", error: data.error || "Request failed." } : e
          )
        );
        return;
      }

      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, step: "done", result: data } : e))
      );
    } catch {
      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, step: "error", error: "Network error. Check connection and try again." } : e
        )
      );
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    runResearch(trimmed, model);
    setInput("");
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="border-b border-[var(--color-line)] bg-[var(--color-surface)]/40 px-6 py-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3.5">
            <SealMark />
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-[26px] italic leading-none text-[var(--color-ink)]">
                Dossier
              </h1>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-accent)]">
                Field Research Unit
              </p>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <p className="font-mono text-xs text-[var(--color-ink-dim)]">Open a file on any company.</p>
            <p className="font-mono text-[10px] text-[var(--color-ink-dim)]/70">
              name or website — either works
            </p>
          </div>
        </div>
      </header>

      {/* Chat feed */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {entries.length === 0 && (
            <div className="rounded border border-dashed border-[var(--color-line)] px-6 py-12 text-center">
              <p className="font-[family-name:var(--font-display)] text-lg italic text-[var(--color-ink-dim)]">
                Enter a company name or website to open a file.
              </p>
              <p className="mt-2 font-mono text-xs text-[var(--color-ink-dim)]">
                e.g. &quot;Stripe&quot; or &quot;https://stripe.com&quot;
              </p>
            </div>
          )}

          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      </main>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-4"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Company name or website URL"
            className="flex-1 rounded border border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-2.5 font-mono text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-dim)] focus:border-[var(--color-accent)]"
          />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2.5 font-mono text-xs text-[var(--color-ink-dim)] focus:border-[var(--color-accent)]"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded bg-[var(--color-accent)] px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-wide text-[var(--color-bg)] transition hover:bg-[var(--color-accent-dim)]"
          >
            Open File
          </button>
        </div>
      </form>
    </div>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  return (
    <div className="flex flex-col gap-3">
      {/* User query pill */}
      <div className="self-end rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 font-mono text-sm text-[var(--color-ink)]">
        {entry.input}
      </div>

      {/* Progress or result */}
      {entry.step !== "done" && entry.step !== "error" && (
        <div className="rounded border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4">
          <ol className="flex flex-col gap-2">
            {STEP_ORDER.filter((s) => s !== "done").map((s) => {
              const currentIdx = STEP_ORDER.indexOf(entry.step);
              const thisIdx = STEP_ORDER.indexOf(s);
              const active = thisIdx === currentIdx;
              const complete = thisIdx < currentIdx;
              return (
                <li
                  key={s}
                  className={`flex items-center gap-2 font-mono text-xs ${
                    active
                      ? "text-[var(--color-accent)]"
                      : complete
                      ? "text-[var(--color-ink-dim)] line-through"
                      : "text-[var(--color-line)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      active ? "animate-pulse bg-[var(--color-accent)]" : "bg-current"
                    }`}
                  />
                  {STEP_LABELS[s]}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {entry.step === "error" && (
        <div className="rounded border border-red-900/50 bg-red-950/20 px-5 py-4">
          <p className="font-mono text-xs text-red-400">
            File could not be opened — {entry.error}
          </p>
        </div>
      )}

      {entry.step === "done" && entry.result && <DossierCard result={entry.result} />}
    </div>
  );
}

function DossierCard({ result }: { result: ResearchResult }) {
  async function downloadPDF() {
    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(result),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${result.companyName}_Research_Report.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Unable to generate PDF.");
    }
  }

  return (
    <div className="overflow-hidden rounded border border-[var(--color-line)] bg-[var(--color-card)]">
      {/* File label bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-2.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--color-accent)]">
          File — {result.companyName}
        </p>
        <button
          onClick={downloadPDF}
          className="font-mono text-[11px] uppercase tracking-wide text-[var(--color-ink-dim)] underline decoration-dotted hover:text-[var(--color-accent)] cursor-pointer"
        >
          Download PDF
        </button>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl italic text-[var(--color-ink)]">
            {result.companyName}
          </h2>
          <a
            href={result.website}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-[var(--color-ink-dim)] hover:text-[var(--color-accent)]"
          >
            {result.website}
          </a>
        </div>

        <p className="text-sm leading-relaxed text-[var(--color-ink)]">{result.summary}</p>

        <Field label="Products & Services">
          <ul className="flex flex-col gap-1">
            {result.products.map((p, i) => (
              <li key={i} className="font-mono text-xs text-[var(--color-ink)]">
                · {p}
              </li>
            ))}
          </ul>
        </Field>

        <Field label="Pain Points (AI-inferred)">
          <ul className="flex flex-col gap-1">
            {result.painPoints.map((p, i) => (
              <li key={i} className="font-mono text-xs text-[var(--color-ink)]">
                · {p}
              </li>
            ))}
          </ul>
        </Field>

        <Field label="Competitors">
          <div className="flex flex-col gap-1.5">
            {result.competitors.map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="font-mono text-xs text-[var(--color-ink)]">{c.name}</span>
                <a
                  href={c.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-[var(--color-ink-dim)] hover:text-[var(--color-accent)]"
                >
                  {c.website}
                </a>
              </div>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

function SealMark() {
  return (
    <svg
      width="38"
      height="38"
      viewBox="0 0 38 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      <circle cx="19" cy="19" r="18" stroke="var(--color-accent)" strokeWidth="1.2" />
      <circle cx="19" cy="19" r="13.5" stroke="var(--color-accent)" strokeWidth="0.6" opacity="0.5" />
      {/* compass ticks */}
      <line x1="19" y1="2.5" x2="19" y2="6" stroke="var(--color-accent)" strokeWidth="1" />
      <line x1="19" y1="32" x2="19" y2="35.5" stroke="var(--color-accent)" strokeWidth="1" />
      <line x1="2.5" y1="19" x2="6" y2="19" stroke="var(--color-accent)" strokeWidth="1" />
      <line x1="32" y1="19" x2="35.5" y2="19" stroke="var(--color-accent)" strokeWidth="1" />
      {/* compass needle */}
      <path d="M19 10L22 19L19 28L16 19L19 10Z" fill="var(--color-accent)" opacity="0.9" />
      <circle cx="19" cy="19" r="1.6" fill="var(--color-bg)" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-ink-dim)]">
        {label}
      </p>
      {children}
    </div>
  );
}