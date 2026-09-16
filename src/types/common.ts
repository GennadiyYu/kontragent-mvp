/**
 * Общие типы, используемые во всей системе: идентификаторы источников данных,
 * статусы получения фактов и уровни риска. Вынесены отдельно, чтобы типы
 * провайдеров (src/lib/providers) и типы досье (src/types/dossier.ts) могли
 * ссылаться на них без циклических импортов.
 */

/** Идентификатор внешнего источника данных (реального или будущего). */
export type DataSourceId =
  | "FNS" // ФНС — ЕГРЮЛ/ЕГРИП, регистрационные данные
  | "GIRBO" // ГИР БО ФНС — бухгалтерская отчётность
  | "KAD_ARBITR" // Картотека арбитражных дел
  | "FSSP" // Федеральная служба судебных приставов
  | "EIS_ZAKUPKI" // Единая информационная система в сфере закупок
  | "FEDRESURS" // Федресурс — банкротство и юридически значимые сообщения
  | "CBR" // Банк России — реестры и лицензии финансовых организаций
  | "WEB_REPUTATION"; // Открытые источники / СМИ — репутационный фон

/** Результат обращения к конкретному источнику при формировании досье. */
export type SourceFetchStatus =
  | "ok" // источник ответил (в MVP — демонстрационными данными)
  | "demo" // источник не подключён технически, используются демо-данные
  | "timeout" // источник не ответил в отведённое время
  | "unavailable" // источник вернул ошибку / недоступен
  | "not_applicable"; // источник неприменим к данному типу компании

/** Насколько можно доверять конкретному факту. */
export type FactReliability =
  | "verified" // подтверждено реальным источником (в MVP не используется)
  | "demo" // демонстрационные/смоделированные данные — НЕ реальные сведения
  | "unconfirmed"; // источник недоступен, факт не подтверждён

/**
 * Метаданные происхождения факта. По ТЗ каждый факт должен по возможности
 * сопровождаться источником, датой получения, ссылкой на первоисточник и
 * статусом достоверности.
 */
export interface FactMeta {
  source: DataSourceId;
  retrievedAt: string; // ISO-8601
  sourceUrl?: string;
  reliability: FactReliability;
}

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low: "Низкий",
  moderate: "Умеренный",
  high: "Высокий",
  critical: "Критический",
};

/** Границы уровней риска по ТЗ: 0–30 / 31–60 / 61–80 / 81–100. */
export function scoreToRiskLevel(score: number): RiskLevel {
  if (score <= 30) return "low";
  if (score <= 60) return "moderate";
  if (score <= 80) return "high";
  return "critical";
}

/** Категории риска, используемые в матрице рисков на вкладке «Обзор». */
export type RiskCategoryKey =
  | "financial" // финансовый
  | "judicial" // судебный
  | "enforcement" // исполнительный
  | "bankruptcy" // банкротный
  | "corporate" // корпоративный
  | "tax" // налоговый
  | "procurement" // закупочный
  | "reputational"; // репутационный

export const RISK_CATEGORY_LABEL: Record<RiskCategoryKey, string> = {
  financial: "Финансовый",
  judicial: "Судебный",
  enforcement: "Исполнительный",
  bankruptcy: "Банкротный",
  corporate: "Корпоративный",
  tax: "Налоговый",
  procurement: "Закупочный",
  reputational: "Репутационный",
};
