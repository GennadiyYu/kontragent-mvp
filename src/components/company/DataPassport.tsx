import type { RiskAssessment, SourceStatusSummary } from "@/types/dossier";
import { RISK_CATEGORY_LABEL } from "@/types/common";
import { formatDateTime } from "@/lib/utils/format";

/**
 * «Паспорт проверки» — компактная сводка охвата источников + раскрывающаяся
 * панель «Как рассчитана оценка» (какие категории вошли/не вошли в Risk
 * Score, с какими весами, и какие конкретные факторы на него повлияли).
 */
export default function DataPassport({
  sources,
  riskAssessment,
  generatedAt,
}: {
  sources: SourceStatusSummary[];
  riskAssessment: RiskAssessment;
  generatedAt: string;
}) {
  const realCount = sources.filter((s) => s.status === "real_found").length;
  const partialCount = sources.filter((s) => s.status === "partial" || s.status === "stale" || s.status === "real_not_found").length;
  const unavailableCount = sources.filter((s) => s.status === "unavailable" || s.status === "demo").length;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Паспорт проверки</p>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <PassportStat label="Проверено источников" value={sources.length} />
        <PassportStat label="Доступно реальных данных" value={realCount} accent="text-emerald-600" />
        <PassportStat label="Частично" value={partialCount} accent="text-teal-600" />
        <PassportStat label="Недоступно" value={unavailableCount} accent="text-slate-500" />
      </div>
      <p className="mt-3 text-xs text-slate-400">Последнее обновление: {formatDateTime(generatedAt)}</p>

      <details className="mt-3 group">
        <summary className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700">Как рассчитана оценка</summary>
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead>
                <tr className="text-left uppercase tracking-wide text-slate-400">
                  <th className="pb-1 pr-2">Категория</th>
                  <th className="pb-1 pr-2">Вес</th>
                  <th className="pb-1 pr-2">Вошла в балл</th>
                  <th className="pb-1">Балл категории</th>
                </tr>
              </thead>
              <tbody>
                {riskAssessment.categories.map((c) => (
                  <tr key={c.category} className="border-t border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-700">{RISK_CATEGORY_LABEL[c.category]}</td>
                    <td className="py-1.5 pr-2 text-slate-500">{Math.round(c.weight * 100)}%</td>
                    <td className="py-1.5 pr-2">
                      {c.isReal ? <span className="text-emerald-600">да</span> : <span className="text-slate-400">нет (демо/недоступно)</span>}
                    </td>
                    <td className="py-1.5 text-slate-500">{c.score}/100</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {riskAssessment.riskFactors.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">Факторы, повысившие балл:</p>
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                {riskAssessment.riskFactors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {riskAssessment.positiveFactors.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">Факторы, снизившие балл:</p>
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                {riskAssessment.positiveFactors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-slate-400">
            Категории без реальных данных исключены из расчёта итогового балла целиком (см. risk-engine/rules.ts) —
            их балл 0 означает «не оценивалось», а не «риска нет».
          </p>
        </div>
      </details>
    </div>
  );
}

function PassportStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <p className={`text-lg font-semibold ${accent ?? "text-slate-800"}`}>{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}
