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

export default function RiskScoreCard({ score, level }: { score: number; level: RiskLevel }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - score / 100);

  return (
    <div className={`flex w-full flex-col items-center rounded-2xl p-5 ring-1 shadow-sm ${PANEL_COLOR[level]} sm:w-56`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Общий риск</p>
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
            className={RING_COLOR[level]}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={`text-3xl font-bold ${TEXT_COLOR[level]}`}>{score}</span>
          <span className="text-[11px] text-slate-500">из 100</span>
        </div>
      </div>
      <p className={`mt-3 text-sm font-semibold ${TEXT_COLOR[level]}`}>{RISK_LEVEL_LABEL[level]} риск</p>
      <div className="mt-3 grid w-full grid-cols-4 gap-1 text-center text-[10px] text-slate-400">
        <span className={level === "low" ? "font-semibold text-emerald-600" : ""}>0–30</span>
        <span className={level === "moderate" ? "font-semibold text-amber-600" : ""}>31–60</span>
        <span className={level === "high" ? "font-semibold text-orange-600" : ""}>61–80</span>
        <span className={level === "critical" ? "font-semibold text-red-600" : ""}>81–100</span>
      </div>
    </div>
  );
}
