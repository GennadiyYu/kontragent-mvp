import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold text-slate-900">{children}</h3>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">{children}</p>;
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function SourceFootnote({ label, url }: { label: string; url?: string }) {
  return (
    <p className="mt-2 text-[11px] text-slate-400">
      Источник: {label}
      {url ? (
        <>
          {" · "}
          <a href={url} target="_blank" rel="noreferrer" className="underline hover:text-slate-600">
            первоисточник
          </a>
        </>
      ) : null}
    </p>
  );
}
