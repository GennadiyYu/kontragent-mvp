import type { RiskCoverage } from "@/types/dossier";
import { RISK_LEVEL_LABEL, type RiskLevel } from "@/types/common";

const RING_COLOR: Record<RiskLevel, string> = {
  low: "stroke-emerald-500",
  moderate: "stroke-amber-500",
  high: "stroke-orange-500",
  critical: "stroke-red-500",
};

const TEXT_COLOR: Record<RiskLevel, string> = {
  low: "text-emerald-600",
  moderate: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

const PANEL_COLOR: Record<RiskLevel, string> = {
  low: "bg-emerald-50 ring-emerald-200",
  moderate: "bg-amber-50 ring-amber-200",
  high: "bg-orange-50 ring-orange-200",
  critical: "bg-red-50 ring-red-200",
};

const NEUTRAL_RING = "stroke-slate-400";
const NEUTRAL_TEXT = "text-slate-600";
const NEUTRAL_PANEL = "bg-slate-50 ring-slate-200";

/**
 * Отображение итогового балла зависит от покрытия реальными данными
 * (RiskCoverage.tier, см. risk-engine/index.ts) — по требованию data quality:
 * при недостаточном покрытии (<50%) нельзя показывать пользователю общую
 * квалификацию риска («низкий/умеренный/высокий/критический») как будто это
 * полноценная оценка компании — только балл по проверенным факторам и явное
 * предупреждение. При 50–79% — можно показать уровень, но с пометкой
 * «предварительная оценка». При ≥80% — обычный «Общий риск» без оговорок.
 */
export default function RiskScoreCard({ score, level, coverage }: { score: number; level: RiskLevel; coverage: RiskCoverage }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - score / 100);
  const isInsufficient = coverage.tier === "insufficient";

  const ringColor = isInsufficient ? NEUTRAL_RING : RING_COLOR[level];
  const textColor = isInsufficient ? NEUTRAL_TEXT : TEXT_COLOR[level];
  const panelColor = isInsufficient ? NEUTRAL_PANEL : PANEL_COLOR[level];

  return (
    <div className={`flex w-full flex-col items-center rounded-2xl p-5 ring-1 shadow-sm ${panelColor} sm:w-56`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {isInsufficient ? "Риск по проверенным факторам" : "Общий риск"}
      </p>
      <div className="relative flex h-32 w-32 items-center justify-center">
        <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
          <circle cx="50" cy="50" r="42" strokeWidth="9" fill="none" className="stroke-slate-200" />
          <circle
            cx="50"
            cy="50"
            r="42"
            strokeWidth="9"
            fill="none"
            strokeLinecap="round"
            className={ringColor}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={`text-3xl font-bold ${textColor}`}>{score}</span>
          <span className="text-[11px] text-slate-500">из 100</span>
        </div>
      </div>

      {isInsufficient ? (
        <p className="mt-3 text-center text-xs font-medium text-slate-500">Недостаточно данных для общей оценки контрагента</p>
      ) : (
        <p className={`mt-3 text-sm font-semibold ${textColor}`}>
          {RISK_LEVEL_LABEL[level]} риск{coverage.tier === "preliminary" ? " (предварительно)" : ""}
        </p>
      )}

      {!isInsufficient && (
        <div className="mt-3 grid w-full grid-cols-4 gap-1 text-center text-[10px] text-slate-400">
          <span className={level === "low" ? "font-semibold text-emerald-600" : ""}>0–30</span>
          <span className={level === "moderate" ? "font-semibold text-amber-600" : ""}>31–60</span>
          <span className={level === "high" ? "font-semibold text-orange-600" : ""}>61–80</span>
          <span className={level === "critical" ? "font-semibold text-red-600" : ""}>81–100</span>
        </div>
      )}

      <div className="mt-4 w-full border-t border-black/5 pt-3 text-center">
        <p className="text-[11px] text-slate-500">
          Полнота проверки: <span className="font-semibold text-slate-700">{coverage.percent}%</span>
          <span className="block text-slate-400">
            проверено {coverage.realCategories} из {coverage.totalCategories} категорий реальными данными
          </span>
        </p>
        {coverage.tier === "preliminary" && (
          <p className="mt-1.5 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
            Предварительная оценка риска — часть источников недоступна
          </p>
        )}
        {coverage.tier === "insufficient" && (
          <p className="mt-1.5 rounded-md bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700">
            Недостаточно данных для общей оценки контрагента
          </p>
        )}
      </div>
    </div>
  );
}
