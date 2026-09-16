import { buildCompanyCore } from "@/lib/mock-data/generator";
import type { BankruptcyInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import type { DataProviderAdapter } from "./types";

export interface FedresursData {
  bankruptcy: BankruptcyInfo;
}

const BLOCKED_REASON = "fedresurs.ru возвращает 401 Unauthorized на запросы без авторизованной сессии — публичного бесплатного API не найдено";

/**
 * Адаптер Федресурса (fedresurs.ru): банкротные процедуры и юридически
 * значимые сообщения.
 *
 * ИССЛЕДОВАНО (см. README): и fedresurs.ru, и bankrot.fedresurs.ru при
 * проверке возвращали 401 Unauthorized на автоматические запросы без
 * авторизованной сессии — публичного бесплатного API без соглашения не
 * обнаружено. Статус "unavailable" — проверка технически невозможна, это
 * НЕ означает «банкротства нет».
 *
 * ДЕМО-ДАННЫЕ используются ТОЛЬКО для кураторских демо-компаний — для
 * реальных компаний данные пусты (UI: «Данные пока недоступны»).
 */
export const fedresursAdapter: DataProviderAdapter<FedresursData> = {
  id: "FEDRESURS",
  label: "Федресурс — банкротство",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "FEDRESURS");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");

    if (query.curated) {
      const core = buildCompanyCore(query);
      return {
        source: "FEDRESURS",
        status: "demo",
        data: { bankruptcy: core.bankruptcy },
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
      };
    }

    return {
      source: "FEDRESURS",
      status: "unavailable",
      data: {
        bankruptcy: {
          hasActiveCase: false,
          publications: [],
          meta: { source: "FEDRESURS", retrievedAt: new Date().toISOString(), reliability: "unconfirmed" },
        },
      },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      errorMessage: BLOCKED_REASON,
    };
  },
};
