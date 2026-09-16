import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { EnforcementInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface FsspData {
  enforcement: EnforcementInfo;
}

/**
 * Адаптер ФССП России: исполнительные производства (действующие и
 * оконченные). Демонстрационные данные — у ФССП есть публичный сервис
 * банка данных исполнительных производств, но без официального API с
 * ключом; реальная интеграция потребует согласованного доступа.
 */
export const fsspAdapter: DataProviderAdapter<FsspData> = {
  id: "FSSP",
  label: "ФССП России — исполнительные производства",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "FSSP");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");
    const core = buildCompanyCore(query);
    return {
      source: "FSSP",
      status: "demo",
      data: { enforcement: core.enforcement },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  },
};
