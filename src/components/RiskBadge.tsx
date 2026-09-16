import { RISK_LEVEL_LABEL, type RiskLevel } from "@/types/common";

const STYLES: Record<RiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  moderate: "bg-amber-50 text-amber-700 ring-amber-200",
  high: "bg-orange-50 text-orange-700 ring-orange-200",
  critical: "bg-red-50 text-red-700 ring-red-200",
};

const DOT_STYLES: Record<RiskLevel, string> = {
  low: "bg-emerald-500",
  moderate: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

export function RiskBadge({ level, score, size = "md" }: { level: RiskLevel; score?: number; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ${STYLES[level]} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[level]}`} />
      {RISK_LEVEL_LABEL[level]}
      {typeof score === "number" ? ` · ${score}` : ""}
    </span>
  );
}

export const RISK_TEXT_COLOR: Record<RiskLevel, string> = {
  low: "text-emerald-600",
  moderate: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

export const RISK_BG_COLOR: Record<RiskLevel, string> = {
  low: "bg-emerald-500",
  moderate: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};
