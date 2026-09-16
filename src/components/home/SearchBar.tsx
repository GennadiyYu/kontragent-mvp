"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const EXAMPLES = ["Технологии Будущего", "СтройГарант", "Регион Трейд", "Агроинвест Плюс"];

export default function SearchBar() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function goToCompany(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Введите ИНН, ОГРН или название компании");
      return;
    }
    setError(null);
    setSubmitting(true);
    router.push(`/company/${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    goToCompany(value);
  }

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Введите ИНН, ОГРН или название компании"
            className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-4 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="h-14 shrink-0 rounded-xl bg-blue-600 px-8 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
        >
          {submitting ? "Проверяем…" : "Проверить"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Например:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => goToCompany(ex)}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 cursor-pointer"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
