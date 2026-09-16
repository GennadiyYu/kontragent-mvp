import type { CompanyDossier, RuleContribution } from "@/types/dossier";

/**
 * Данные, необходимые risk-engine для расчёта. Намеренно не зависит от
 * провайдерского слоя (src/lib/providers) — только от формы досье. Это
 * позволяет тестировать и переиспользовать движок независимо от того,
 * откуда взялись факты (mock-провайдеры сегодня, реальные API завтра).
 */
export type RiskEngineInput = Pick<
  CompanyDossier,
  | "company"
  | "identity"
  | "management"
  | "owners"
  | "relatedCompanies"
  | "finance"
  | "arbitration"
  | "enforcement"
  | "bankruptcy"
  | "procurement"
  | "licenses"
  | "reputation"
>;

export interface RiskRule {
  id: string;
  category: RuleContribution["category"];
  /** Возвращает 0 или более вкладов в оценку. Точка > 0 повышает риск, < 0 — снижает. */
  evaluate: (input: RiskEngineInput) => RuleContribution[];
}
