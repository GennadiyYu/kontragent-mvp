import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { FinanceInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface GirboData {
  finance: FinanceInfo;
}

/**
 * Адаптер ГИР БО (Государственный информационный ресурс бухгалтерской
 * отчётности ФНС): выручка, прибыль, активы, капитал за последние периоды.
 * Демонстрационные данные — реальная интеграция подключается через открытый
 * API ГИР БО без API-ключа, но требует отдельной реализации парсинга.
 */
export const girboAdapter: DataProviderAdapter<GirboData> = {
  id: "GIRBO",
  label: "ГИР БО ФНС — бухгалтерская отчётность",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "GIRBO");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");
    const core = buildCompanyCore(query);
    return {
      source: "GIRBO",
      status: "demo",
      data: { finance: core.finance },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  },
};
