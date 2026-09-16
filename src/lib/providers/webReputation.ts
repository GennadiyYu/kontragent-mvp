import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { ReputationInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface WebReputationData {
  reputation: ReputationInfo;
}

/**
 * Адаптер репутационного фона по открытым источникам/СМИ. В реальной
 * интеграции это может быть новостной поисковый API или собственный индекс —
 * намеренно самый «мягкий» по достоверности источник, поэтому в risk-engine
 * репутационная категория имеет наименьший вес.
 */
export const webReputationAdapter: DataProviderAdapter<WebReputationData> = {
  id: "WEB_REPUTATION",
  label: "Открытые источники / СМИ",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "WEB_REPUTATION");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");
    const core = buildCompanyCore(query);
    return {
      source: "WEB_REPUTATION",
      status: "demo",
      data: { reputation: core.reputation },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  },
};
