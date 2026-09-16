import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { EnforcementInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface FsspData {
  enforcement: EnforcementInfo;
}

const BLOCKED_REASON = "Официальный API ФССП требует аккредитации/соглашения с ведомством; fssp.gov.ru не отвечает на автоматические запросы";

/**
 * Адаптер ФССП России: исполнительные производства (действующие и
 * оконченные).
 *
 * ИССЛЕДОВАНО (см. README): у ФССП есть официальный API «Банка данных
 * исполнительных производств», но доступ к нему выдаётся только по
 * аккредитации/соглашению с ведомством — мгновенного бесплатного
 * самостоятельного подключения нет. Публичный веб-поиск (fssp.gov.ru)
 * при проверке не отвечал на автоматические HTTP-запросы (таймаут/503 —
 * сетевая защита от ботов, не CAPTCHA на форме). Статус "unavailable" —
 * проверка технически невозможна, это НЕ означает «производств нет».
 *
 * ДЕМО-ДАННЫЕ используются ТОЛЬКО для кураторских демо-компаний — для
 * реальных компаний данные пусты (UI: «Данные пока недоступны»).
 */
export const fsspAdapter: DataProviderAdapter<FsspData> = {
  id: "FSSP",
  label: "ФССП России — исполнительные производства",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "FSSP");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");

    if (query.curated) {
      const core = buildCompanyCore(query);
      return {
        source: "FSSP",
        status: "demo",
        data: { enforcement: core.enforcement },
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
      };
    }

    return {
      source: "FSSP",
      status: "unavailable",
      data: {
        enforcement: {
          proceedings: [],
          activeCount: 0,
          activeAmount: 0,
          meta: { source: "FSSP", retrievedAt: new Date().toISOString(), reliability: "unconfirmed" },
        },
      },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      errorMessage: BLOCKED_REASON,
    };
  },
};
