import { RISK_LEVEL_LABEL } from "@/types/common";
import { formatMoney } from "@/lib/utils/format";
import { recommendationForRiskLevel } from "@/lib/risk-engine";
import type { AIProvider, AiSummaryInput, AiSummaryResult } from "./types";

/**
 * Шаблонный (безмодельный) AI-провайдер. Формирует связный текст из уже
 * рассчитанного Risk Engine без обращения к внешним сервисам — используется,
 * когда GEMINI_API_KEY не задан или запрос к Gemini завершился ошибкой.
 * Гарантирует, что сервис остаётся полностью работоспособным без ИИ.
 */
export class TemplateAIProvider implements AIProvider {
  readonly id = "template" as const;

  async generateSummary(input: AiSummaryInput): Promise<AiSummaryResult> {
    const { company, riskAssessment } = input;
    const levelLabel = RISK_LEVEL_LABEL[riskAssessment.level].toLowerCase();

    const parts: string[] = [];
    parts.push(
      `По результатам автоматической проверки уровень риска работы с «${company.shortName}» оценён как ${levelLabel} (${riskAssessment.totalScore} из 100 баллов).`
    );

    const topRisks = riskAssessment.riskFactors.slice(0, 3);
    if (topRisks.length > 0) {
      parts.push(`Наиболее значимые факторы риска: ${topRisks.join("; ")}.`);
    } else {
      parts.push("Существенных факторов риска в проверенных источниках не выявлено.");
    }

    const topPositives = riskAssessment.positiveFactors.slice(0, 3);
    if (topPositives.length > 0) {
      parts.push(`Положительно на оценке сказались: ${topPositives.join("; ")}.`);
    }

    if (input.finance.years[0]) {
      const y = input.finance.years[0];
      parts.push(`Выручка за ${y.year} год составила ${formatMoney(y.revenue)}, финансовый результат — ${formatMoney(y.netProfit)}.`);
    }

    const recommendation = recommendationForRiskLevel(riskAssessment.level);

    return {
      summaryText: parts.join(" "),
      keyPositives: topPositives.length > 0 ? topPositives : ["Существенных положительных факторов, выделяющихся на общем фоне, не выявлено"],
      keyRisks: topRisks.length > 0 ? topRisks : ["Существенных факторов риска не выявлено"],
      recommendation,
    };
  }
}

export const templateAIProvider = new TemplateAIProvider();
