import type { CompanyIdentity } from "@/types/dossier";

/** Единые русские подписи статуса компании — используются и mock-генератором, и реальными адаптерами. */
export const COMPANY_STATUS_LABEL: Record<CompanyIdentity["status"], string> = {
  active: "Действующая",
  liquidating: "В процессе ликвидации",
  liquidated: "Ликвидирована",
  bankrupt: "Банкротство (конкурсное производство)",
  reorganizing: "В процессе реорганизации",
};

/**
 * Нормализация названия компании для точного текстового сопоставления
 * (используется при сверке с реестром дисквалифицированных лиц ФНС, см.
 * providers/fnsRiskDb.ts). ЗЕРКАЛЬНАЯ копия normalizeCompanyName из
 * scripts/lib/db.mjs (тот файл — ETL, чистый Node.js без TS; этот — код
 * приложения) — при изменении логики нормализации меняйте оба места.
 */
export function normalizeCompanyNameTs(name: string): string {
  return name
    .toUpperCase()
    .replace(/[«»"']/g, "")
    .replace(/^(ООО|АО|ПАО|ЗАО|ОАО|ИП)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
