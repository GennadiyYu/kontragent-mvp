import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { EnforcementInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface FsspData {
  enforcement: EnforcementInfo;
}

/**
 * Адаптер ФССП России: исполнительные производства (действующие и
 * оконченные).
 *
 * ИССЛЕДОВАНО (см. README): у ФССП есть официальный API «Банка данных
 * исполнительных производств», но доступ к нему выдаётся только по
 * аккредитации/соглашению с ведомством — мгновенного бесплатного
 * самостоятельного подключения нет. Публичный веб-поиск (fssp.gov.ru)
 * при проверке не отвечал на автоматические HTTP-запросы (таймаут/503 —
 * сетевая защита от ботов, не CAPTCHA на форме). Источник помечен
 * "blocked", используются демо-данные.
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
      status: "blocked",
      data: { enforcement: core.enforcement },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      errorMessage: "Официальный API ФССП требует аккредитации/соглашения с ведомством; fssp.gov.ru не отвечает на автоматические запросы",
    };
  },
};
