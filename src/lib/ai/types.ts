import type {
  ArbitrationInfo,
  BankruptcyInfo,
  CompanyIdentity,
  EnforcementInfo,
  FinanceInfo,
  ProcurementInfo,
  ReputationInfo,
  RiskAssessment,
} from "@/types/dossier";

/**
 * Вход для AI-провайдера: ТОЛЬКО уже рассчитанные структурированные факты и
 * результат Risk Engine. ИИ никогда не получает «сырые» непроверенные
 * данные и не имеет возможности сам что-то домыслить сверх переданного —
 * это гарантируется составом полей ниже и системной инструкцией в
 * конкретной реализации (см. gemini.ts).
 */
export interface AiSummaryInput {
  company: CompanyIdentity;
  riskAssessment: RiskAssessment;
  finance: FinanceInfo;
  arbitration: ArbitrationInfo;
  enforcement: EnforcementInfo;
  bankruptcy: BankruptcyInfo;
  procurement: ProcurementInfo;
  reputation: ReputationInfo;
}

export interface AiSummaryResult {
  summaryText: string;
  keyPositives: string[];
  keyRisks: string[];
  recommendation: string;
}

export interface AIProvider {
  id: "gemini" | "template";
  generateSummary(input: AiSummaryInput): Promise<AiSummaryResult>;
}
