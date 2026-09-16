"use client";

import { useState, type FormEvent } from "react";
import type { DealAssessment } from "@/types/dossier";
import { RiskBadge } from "@/components/RiskBadge";
import { formatMoneyExact } from "@/lib/utils/format";
import { Card, SectionTitle } from "./ui";

export default function DealAssessmentForm({ query }: { query: string }) {
  const [amount, setAmount] = useState("1000000");
  const [prepaymentPercent, setPrepaymentPercent] = useState("30");
  const [postpaymentDays, setPostpaymentDays] = useState("30");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DealAssessment | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/deal-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          amount: Number(amount) || 0,
          prepaymentPercent: Number(prepaymentPercent) || 0,
          postpaymentDays: Number(postpaymentDays) || 0,
          subject,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Не удалось рассчитать риск сделки");
      setResult(data.dealAssessment as DealAssessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось рассчитать риск сделки");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <SectionTitle hint="риск конкретной сделки, а не общий рейтинг компании">Оценить конкретную сделку</SectionTitle>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Сумма сделки, ₽
          <input
            type="number"
            min={0}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Предоплата, %
          <input
            type="number"
            min={0}
            max={100}
            required
            value={prepaymentPercent}
            onChange={(e) => setPrepaymentPercent(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Срок постоплаты, дней
          <input
            type="number"
            min={0}
            required
            value={postpaymentDays}
            onChange={(e) => setPostpaymentDays(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Предмет договора
          <input
            type="text"
            placeholder="например, поставка оборудования"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
          >
            {loading ? "Считаем…" : "Оценить риск сделки"}
          </button>
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">
              Риск сделки: {result.dealRiskScore}/100
            </p>
            <RiskBadge level={result.dealRiskLevel} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <p className="text-slate-600">
              Мин. рекомендуемая предоплата:{" "}
              <strong>{result.suggestedTerms.maxRecommendedPrepaymentBelow ?? 0}%</strong>
            </p>
            <p className="text-slate-600">
              Макс. рекомендуемая отсрочка:{" "}
              <strong>{result.suggestedTerms.maxRecommendedPostpaymentDays} дн.</strong>
            </p>
            <p className="text-slate-600">
              Доп. обеспечение: <strong>{result.suggestedTerms.requireSecurity ? "рекомендуется" : "не требуется"}</strong>
            </p>
          </div>

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Рекомендации по условиям договора</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {result.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>

          <details className="mt-3 text-xs text-slate-500">
            <summary className="cursor-pointer select-none font-medium text-slate-600">Как рассчитан балл сделки</summary>
            <ul className="mt-2 space-y-1 pl-4">
              {result.contributions.map((c, i) => (
                <li key={i} className={c.points >= 0 ? "text-slate-600" : "text-emerald-600"}>
                  {c.points > 0 ? "+" : ""}
                  {c.points} — {c.description}
                </li>
              ))}
            </ul>
          </details>

          <p className="mt-3 text-xs text-slate-400">Сумма сделки: {formatMoneyExact(result.input.amount)}</p>
        </div>
      )}
    </Card>
  );
}
