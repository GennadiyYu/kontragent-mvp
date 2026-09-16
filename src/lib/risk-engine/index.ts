import type { RiskAssessment, RiskCategoryScore, RiskCoverage } from "@/types/dossier";
import { RISK_CATEGORY_LABEL, scoreToRiskLevel, type FactMeta, type RiskCategoryKey, type RiskLevel } from "@/types/common";
import { RISK_RULES } from "./rules";
import type { RiskEngineInput } from "./types";

export const RISK_ENGINE_VERSION = "1.1.0";

/** Ниже этого покрытия реальными данными (%) оценка помечается как предварительная. */
const PRELIMINARY_COVERAGE_THRESHOLD = 50;

function isRealMeta(meta: FactMeta): boolean {
  return meta.reliability === "verified";
}

/**
 * Подкреплена ли категория риска реальными (не демо) данными хотя бы по
 * одному из своих источников. Используется ТОЛЬКО для метрики покрытия
 * (UI «Достоверность оценки»); сам расчёт баллов гейтится независимо, на
 * уровне каждого правила — см. isReal() в rules.ts.
 */
function isCategoryReal(category: RiskCategoryKey, input: RiskEngineInput): boolean {
  switch (category) {
    case "financial":
      return isRealMeta(input.finance.meta);
    case "judicial":
      return isRealMeta(input.arbitration.meta);
    case "enforcement":
      return isRealMeta(input.enforcement.meta);
    case "bankruptcy":
      return isRealMeta(input.bankruptcy.meta);
    case "corporate":
      return (
        isRealMeta(input.company.meta) ||
        isRealMeta(input.identity.meta) ||
        isRealMeta(input.management.director.meta) ||
        isRealMeta(input.relatedCompanies.meta) ||
        isRealMeta(input.licenses.meta)
      );
    case "tax":
      return isRealMeta(input.enforcement.meta) || (isRealMeta(input.identity.meta) && input.identity.taxDebtAmount !== undefined);
    case "procurement":
      return isRealMeta(input.procurement.meta);
    case "reputational":
      return isRealMeta(input.reputation.meta);
  }
}

/**
 * Вес категории в итоговом балле. Сумма весов равна 1. Подобраны так, чтобы
 * отразить относительную значимость категорий для B2B-проверки контрагента:
 * банкротство и финансовое состояние — наиболее весомые группы риска,
 * закупки и репутация — вспомогательные сигналы.
 */
const CATEGORY_WEIGHTS: Record<RiskCategoryKey, number> = {
  financial: 0.2,
  bankruptcy: 0.2,
  judicial: 0.15,
  enforcement: 0.15,
  corporate: 0.1,
  tax: 0.1,
  procurement: 0.05,
  reputational: 0.05,
};

const ALL_CATEGORIES = Object.keys(CATEGORY_WEIGHTS) as RiskCategoryKey[];

const CONSEQUENCE_TEMPLATES: Record<RiskCategoryKey, Record<RiskLevel, string>> = {
  financial: {
    low: "Существенных финансовых рисков не выявлено.",
    moderate: "Возможны временные кассовые разрывы при ухудшении рыночной конъюнктуры.",
    high: "Повышен риск неисполнения обязательств по крупным или длительным контрактам.",
    critical: "Высокая вероятность неплатёжеспособности и срыва расчётов по договору.",
  },
  judicial: {
    low: "Судебная нагрузка минимальна.",
    moderate: "Возможны отдельные споры по типовым обязательствам.",
    high: "Существенная судебная нагрузка повышает риск взыскания задолженности через суд.",
    critical: "Крупные судебные споры создают риск ареста активов и блокировки счетов.",
  },
  enforcement: {
    low: "Действующих исполнительных производств не выявлено.",
    moderate: "Отдельные исполнительные производства не создают существенной угрозы.",
    high: "Значительная сумма долгов на принудительном взыскании — риск блокировки счетов контрагента.",
    critical: "Масштабное принудительное взыскание указывает на системные проблемы с платёжеспособностью.",
  },
  bankruptcy: {
    low: "Признаков банкротства не выявлено.",
    moderate: "Есть отдельные сигналы, требующие наблюдения.",
    high: "Зафиксированы предвестники банкротной процедуры.",
    critical: "Открыта процедура банкротства — высокий риск неисполнения обязательств и потери актива.",
  },
  corporate: {
    low: "Корпоративная структура прозрачна и устойчива.",
    moderate: "Отдельные корпоративные признаки требуют внимания.",
    high: "Совокупность признаков (адрес/руководитель/недостоверность сведений) повышает риск номинальности компании.",
    critical: "Высокая вероятность технической/номинальной компании или подготовки к уходу от обязательств.",
  },
  tax: {
    low: "Налоговых рисков не выявлено.",
    moderate: "Требуется уточнение налоговой дисциплины контрагента.",
    high: "Обнаружены признаки нарушения налоговых обязательств.",
    critical: "Существенная налоговая задолженность создаёт риск доначислений и субсидиарной ответственности.",
  },
  procurement: {
    low: "Закупочная деятельность не выявила рисков.",
    moderate: "Ограниченный опыт участия в закупках либо отдельные замечания.",
    high: "Выявлены нарушения при исполнении государственных контрактов.",
    critical: "Включение в РНП существенно ограничивает деловую репутацию и указывает на системные нарушения.",
  },
  reputational: {
    low: "Негативных сведений в открытых источниках не выявлено.",
    moderate: "Единичные негативные упоминания не носят системного характера.",
    high: "Заметный объём негативных публикаций может влиять на деловую репутацию.",
    critical: "Массовые негативные упоминания указывают на системные проблемы в работе с контрагентами.",
  },
};

function clip(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Текстовая рекомендация по сотрудничеству для заданного уровня риска. Используется
 * и шаблонным AI-провайдером (fallback.ts), и генератором PDF — единая формулировка. */
export function recommendationForRiskLevel(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "Сотрудничество возможно на стандартных договорных условиях. Рекомендуется периодический мониторинг контрагента.";
    case "moderate":
      return "Сотрудничество возможно при соблюдении осторожности: зафиксируйте чёткие условия оплаты и штрафные санкции, периодически отслеживайте изменения статуса контрагента.";
    case "high":
      return "Сотрудничество сопряжено с повышенным риском. Рекомендуется минимизировать авансирование, запросить дополнительное обеспечение обязательств и установить лимит на сумму сделки.";
    case "critical":
      return "Сотрудничество не рекомендуется без дополнительных гарантий. При необходимости работы с контрагентом — только на условиях полной предоплаты и с юридическим сопровождением сделки.";
  }
}

/**
 * Рассчитывает итоговую оценку риска контрагента 0–100. Выполняется
 * обычным TypeScript-кодом: ни одно правило не обращается к ИИ, оценка
 * полностью детерминирована и воспроизводима для одних и тех же входных
 * данных. AI-провайдер (см. src/lib/ai) получает уже готовый результат и не
 * имеет возможности изменить рейтинг — только прокомментировать его.
 */
export function computeRiskAssessment(input: RiskEngineInput): RiskAssessment {
  const contributions = RISK_RULES.flatMap((rule) => rule.evaluate(input));

  const categories: RiskCategoryScore[] = ALL_CATEGORIES.map((category) => {
    const categoryContributions = contributions.filter((c) => c.category === category);
    const rawScore = categoryContributions.reduce((sum, c) => sum + c.points, 0);
    const score = Math.round(clip(rawScore, 0, 100));
    const level = scoreToRiskLevel(score);
    const facts = categoryContributions.filter((c) => c.points > 0).map((c) => c.description);
    const categoryIsReal = isCategoryReal(category, input);
    return {
      category,
      score,
      level,
      weight: CATEGORY_WEIGHTS[category],
      facts: facts.length > 0 ? facts : [`Значимых факторов риска в категории «${RISK_CATEGORY_LABEL[category]}» не выявлено`],
      consequences: [CONSEQUENCE_TEMPLATES[category][level]],
      isReal: categoryIsReal,
    };
  });

  const realCategoriesCount = categories.filter((c) => c.isReal).length;
  const coveragePercent = Math.round((realCategoriesCount / categories.length) * 100);
  const coverage: RiskCoverage = {
    realCategories: realCategoriesCount,
    totalCategories: categories.length,
    percent: coveragePercent,
    isPreliminary: coveragePercent < PRELIMINARY_COVERAGE_THRESHOLD,
  };

  // Взвешенное среднее в чистом виде математически не позволяет ни одной
  // категории в одиночку поднять итог выше (её вес × 100) — например, при
  // весе судебной категории 0.15 даже балл 100 внутри неё даст только 15
  // итоговых баллов. Это занижает риск компаний, у которых проблема
  // сконцентрирована в одной категории (например, только суды), хотя это
  // объективно значимый сигнал. Поэтому итог — смесь взвешенного среднего
  // (учитывает общий профиль по всем категориям) и балла САМОЙ проблемной
  // категории (не даёт «размыть» концентрированный риск усреднением).
  const weightedAverage = categories.reduce((sum, c) => sum + c.score * c.weight, 0);
  const worstCategoryScore = Math.max(...categories.map((c) => c.score));
  const blended = weightedAverage * 0.5 + worstCategoryScore * 0.5;
  let totalScore = Math.round(clip(blended, 0, 100));
  const overrideNotes: string[] = [];

  // Взвешенное усреднение по категориям само по себе может «размыть» единичный,
  // но критичный по своей природе фактор (например, открытое банкротство или
  // включение в реестр недобросовестных поставщиков) за счёт благополучных
  // показателей в остальных категориях. В реальной практике due diligence
  // такие факторы работают как «стоп-сигнал» и задают МИНИМАЛЬНО допустимый
  // итоговый уровень риска независимо от среднего балла — это и делают
  // пороги ниже. Сам расчёт по категориям (contributions/categories) при этом
  // не подменяется — он остаётся полностью прозрачным и воспроизводимым.
  const bankruptcyScore = categories.find((c) => c.category === "bankruptcy")?.score ?? 0;
  const procurementScore = categories.find((c) => c.category === "procurement")?.score ?? 0;
  const corporateScore = categories.find((c) => c.category === "corporate")?.score ?? 0;

  if (bankruptcyScore >= 50 && totalScore < 81) {
    totalScore = 81;
    overrideNotes.push("Итоговый балл повышен до критического уровня: открыта процедура конкурсного производства");
  } else if (bankruptcyScore >= 30 && totalScore < 61) {
    totalScore = 61;
    overrideNotes.push("Итоговый балл повышен до высокого уровня: открыта процедура банкротства");
  }
  if (procurementScore >= 40 && totalScore < 61) {
    totalScore = 61;
    overrideNotes.push("Итоговый балл повышен до высокого уровня: компания в реестре недобросовестных поставщиков (РНП)");
  }
  if (corporateScore >= 40 && totalScore < 61) {
    totalScore = 61;
    overrideNotes.push("Итоговый балл повышен до высокого уровня: дисквалификация руководителя или отозванная лицензия");
  }
  totalScore = Math.round(clip(totalScore, 0, 100));
  const level = scoreToRiskLevel(totalScore);

  const sortedByImpact = [...contributions].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const positiveFactors = sortedByImpact.filter((c) => c.points < 0).map((c) => c.description);
  const riskFactors = [...overrideNotes, ...sortedByImpact.filter((c) => c.points > 0).map((c) => c.description)];

  return {
    totalScore,
    level,
    categories,
    positiveFactors,
    riskFactors,
    contributions,
    coverage,
    computedAt: new Date().toISOString(),
    engineVersion: RISK_ENGINE_VERSION,
  };
}
