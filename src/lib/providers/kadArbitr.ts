import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { ArbitrationInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface KadArbitrData {
  arbitration: ArbitrationInfo;
}

/**
 * Адаптер картотеки арбитражных дел (КАД Арбитр, kad.arbitr.ru):
 * судебные споры с участием компании. Демонстрационные данные — у КАД Арбитр
 * нет официального публичного API с ключом, для реальной интеграции
 * потребуется партнёрский доступ или согласованный парсинг.
 */
export const kadArbitrAdapter: DataProviderAdapter<KadArbitrData> = {
  id: "KAD_ARBITR",
  label: "Картотека арбитражных дел",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "KAD_ARBITR");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");
    const core = buildCompanyCore(query);
    return {
      source: "KAD_ARBITR",
      status: "demo",
      data: { arbitration: core.arbitration },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  },
};
