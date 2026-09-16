import { formatMoney } from "@/lib/utils/format";
import { scoreToRiskLevel } from "@/types/common";
import type { DealAssessment, DealInput, FinanceInfo, RiskAssessment, RuleContribution } from "@/types/dossier";

function clip(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Рекомендуемый минимальный % предоплаты в зависимости от уровня риска контрагента. */
const MIN_RECOMMENDED_PREPAYMENT: Record<RiskAssessment["level"], number> = {
  low: 0,
  moderate: 20,
  high: 40,
  critical: 70,
};

/** Рекомендуемый максимальный срок постоплаты (дней) в зависимости от уровня риска. */
const MAX_RECOMMENDED_POSTPAYMENT_DAYS: Record<RiskAssessment["level"], number> = {
  low: 60,
  moderate: 45,
  high: 21,
  critical: 0,
};

/**
 * Оценивает риск конкретной сделки с контрагентом. Как и общий risk-engine,
 * работает обычным детерминированным TypeScript-кодом поверх уже
 * рассчитанного общего риска контрагента (RiskAssessment) и его финансовых
 * показателей — параметры сделки не пересчитывают рейтинг контрагента, а
 * лишь модулируют риск конкретной транзакции.
 */
export function computeDealAssessment(
  companyRisk: RiskAssessment,
  finance: FinanceInfo,
  input: DealInput
): DealAssessment {
  const contributions: RuleContribution[] = [];

  // База — переносим на сделку долю общего риска контрагента.
  const baseContribution = Math.round(companyRisk.totalScore * 0.45);
  contributions.push({
    ruleId: "deal.base_company_risk",
    category: "financial",
    points: baseContribution,
    description: `Базовый риск контрагента (общая оценка ${companyRisk.totalScore}/100) учтён при оценке сделки`,
  });

  // Размер сделки относительно годовой выручки контрагента.
  const lastYear = finance.years[0];
  if (lastYear && lastYear.revenue > 0 && input.amount > 0) {
    const ratio = input.amount / lastYear.revenue;
    if (ratio > 0.5) {
      contributions.push({
        ruleId: "deal.size_vs_revenue_high",
        category: "financial",
        points: 20,
        description: `Сумма сделки (${formatMoney(input.amount)}) превышает 50% годовой выручки контрагента — непропорционально высокая нагрузка на его финансы`,
      });
    } else if (ratio > 0.2) {
      contributions.push({
        ruleId: "deal.size_vs_revenue_moderate",
        category: "financial",
        points: 10,
        description: `Сумма сделки составляет заметную долю (свыше 20%) годовой выручки контрагента`,
      });
    }
  }

  // Условия оплаты.
  if (input.prepaymentPercent < 20) {
    contributions.push({
      ruleId: "deal.low_prepayment",
      category: "financial",
      points: 10,
      description: "Низкий процент предоплаты увеличивает риск неполучения оплаты после исполнения обязательств",
    });
  } else if (input.prepaymentPercent >= 50) {
    contributions.push({
      ruleId: "deal.high_prepayment",
      category: "financial",
      points: -10,
      description: "Высокая доля предоплаты существенно снижает риск неполучения оплаты",
    });
  }

  if (input.postpaymentDays > 60) {
    contributions.push({
      ruleId: "deal.long_postpayment",
      category: "financial",
      points: 8,
      description: `Длительная отсрочка платежа (${input.postpaymentDays} дн.) увеличивает кредитный риск`,
    });
  } else if (input.postpaymentDays <= 14 && input.postpaymentDays >= 0) {
    contributions.push({
      ruleId: "deal.short_postpayment",
      category: "financial",
      points: -5,
      description: "Короткий срок постоплаты снижает кредитный риск сделки",
    });
  }

  if (input.prepaymentPercent < 20 && input.postpaymentDays > 60 && (companyRisk.level === "high" || companyRisk.level === "critical")) {
    contributions.push({
      ruleId: "deal.combined_terms_risk",
      category: "financial",
      points: 15,
      description: "Сочетание низкой предоплаты и длительной отсрочки при повышенном риске контрагента существенно увеличивает вероятность неплатежа",
    });
  }

  const dealRiskScore = Math.round(clip(contributions.reduce((s, c) => s + c.points, 0), 0, 100));
  const dealRiskLevel = scoreToRiskLevel(dealRiskScore);

  const minPrepayment = MIN_RECOMMENDED_PREPAYMENT[dealRiskLevel];
  const maxPostpayment = MAX_RECOMMENDED_POSTPAYMENT_DAYS[dealRiskLevel];
  const requireSecurity = dealRiskLevel === "high" || dealRiskLevel === "critical";

  const recommendations: string[] = [];
  if (dealRiskLevel === "critical") {
    recommendations.push("Крайне высокий риск сделки — рекомендуется работа только по 100% предоплате либо через аккредитив.");
  } else if (dealRiskLevel === "high") {
    recommendations.push("Высокий риск сделки — рекомендуется существенно повысить долю предоплаты и запросить дополнительное обеспечение.");
  }
  if (input.prepaymentPercent < minPrepayment) {
    recommendations.push(`Рекомендуется увеличить предоплату минимум до ${minPrepayment}% от суммы сделки.`);
  }
  if (maxPostpayment === 0 && input.postpaymentDays > 0) {
    recommendations.push("Рекомендуется отказаться от постоплаты либо минимизировать отсрочку.");
  } else if (input.postpaymentDays > maxPostpayment) {
    recommendations.push(`Рекомендуется сократить срок постоплаты до ${maxPostpayment} дней или менее.`);
  }
  if (requireSecurity) {
    recommendations.push("Запросите дополнительное обеспечение обязательств: банковскую гарантию, залог или поручительство.");
  }
  recommendations.push("Зафиксируйте в договоре штрафные санкции (пени) за просрочку оплаты и порядок урегулирования спора.");
  if (dealRiskLevel === "low") {
    recommendations.push("Существенных ограничений не выявлено — стандартные условия договора допустимы.");
  }

  return {
    input,
    dealRiskScore,
    dealRiskLevel,
    recommendations,
    suggestedTerms: {
      maxRecommendedPrepaymentBelow: minPrepayment || undefined,
      maxRecommendedPostpaymentDays: maxPostpayment,
      requireSecurity,
      notes: [
        `Предмет договора: ${input.subject || "не указан"}`,
      ],
    },
    contributions,
    computedAt: new Date().toISOString(),
  };
}
