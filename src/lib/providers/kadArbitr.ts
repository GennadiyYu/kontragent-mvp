import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { ArbitrationInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface KadArbitrData {
  arbitration: ArbitrationInfo;
}

/**
 * Адаптер картотеки арбитражных дел (КАД Арбитр, kad.arbitr.ru):
 * судебные споры с участием компании.
 *
 * ИССЛЕДОВАНО (см. README, раздел «Исследование источников»): у kad.arbitr.ru
 * нет официального публичного API/открытых данных. Форма поиска защищена
 * CAPTCHA — это подтверждённая, общеизвестная защита от автоматических
 * запросов, встроенная в сам сервис. По прямому указанию задачи CAPTCHA не
 * обходится — источник помечен "blocked", используются демо-данные.
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
      status: "blocked",
      data: { arbitration: core.arbitration },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      errorMessage: "Поиск на kad.arbitr.ru защищён CAPTCHA — автоматический обход запрещён политикой сервиса и условиями этой задачи",
    };
  },
};
