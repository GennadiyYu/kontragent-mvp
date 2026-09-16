import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { LicensesInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface CbrData {
  licenses: LicensesInfo;
}

/**
 * Адаптер Банка России: лицензии и реестры финансовых организаций
 * (актуально для компаний в соответствующих отраслях ОКВЭД). Если у
 * компании нет вида деятельности, требующего лицензирования ЦБ, источник
 * возвращает статус "not_applicable" — это не ошибка и не демо-заглушка,
 * а корректный результат «неприменимо».
 */
export const cbrAdapter: DataProviderAdapter<CbrData> = {
  id: "CBR",
  label: "Банк России — реестры и лицензии",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "CBR");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");
    const core = buildCompanyCore(query);
    const applicable = core.licenses.items.length > 0;
    return {
      source: "CBR",
      status: applicable ? "demo" : "not_applicable",
      data: { licenses: core.licenses },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  },
};
