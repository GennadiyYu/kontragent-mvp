import { buildCompanyCore, type ResolvedCompanyQuery } from "@/lib/mock-data/generator";
import type { FinanceInfo, FinanceYear } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import { getFinanceRecords } from "./financeDb";
import type { DataProviderAdapter } from "./types";

export interface GirboData {
  finance: FinanceInfo;
}

const REVEXP_SOURCE_URL = "https://www.nalog.gov.ru/opendata/7707329152-revexp/";
/** Датасет ФНС публикуется раз в год — если самому свежему снимку больше 2 лет, считаем данные устаревшими ("stale"). */
const STALE_AFTER_YEARS = 2;

function computeTrend(years: FinanceYear[]): FinanceInfo["trend"] {
  if (years.length < 2) return "unknown"; // одного года снимка недостаточно для тренда
  const [latest, prev] = years;
  if (prev.revenue <= 0) return "unknown";
  const change = (latest.revenue - prev.revenue) / prev.revenue;
  if (change > 0.05) return "growth";
  if (change < -0.05) return "decline";
  return "stagnation";
}

/**
 * Читает реальные данные из локальной БД (data/kontragent.db), наполненной
 * `npm run import:finance` из официального открытого датасета ФНС (revexp).
 * ВАЖНО: этот датасет содержит ТОЛЬКО выручку и расходы — активы/капитал/
 * кредиторская задолженность недоступны бесплатно нигде (см. README), поэтому
 * остаются undefined даже для реальных записей. netProfit — расчётный
 * (выручка − расходы), помечен isNetProfitEstimated.
 */
async function tryRealLookup(query: ResolvedCompanyQuery): Promise<FinanceInfo | null> {
  if (query.curated) return null; // кураторские демо-компании — стабильный демо-профиль
  if (!query.knownInn) return null; // датасет ФНС индексирован по ИНН — по названию не ищем

  const rows = await getFinanceRecords(query.knownInn);
  if (rows.length === 0) return null;

  const meta = { source: "GIRBO" as const, retrievedAt: rows[0].retrievedAt, sourceUrl: REVEXP_SOURCE_URL, reliability: "verified" as const };
  const years: FinanceYear[] = rows.map((r) => ({
    year: r.reportYear,
    revenue: r.revenue,
    netProfit: r.revenue - r.expense,
    isNetProfitEstimated: true,
    meta,
  }));

  return { years, trend: computeTrend(years), meta };
}

/**
 * Адаптер ГИР БО/ФНС — бухгалтерские показатели. Реальные данные (выручка,
 * расчётная прибыль) — из локальной БД, наполняемой ETL из официального
 * открытого датасета ФНС (см. scripts/import-finance.mjs). Это НЕ полная
 * бухотчётность: активы/капитал/кредиторская задолженность недоступны
 * бесплатно (см. README, "Исследование источников") — эти поля остаются
 * незаполненными даже при реальных данных, UI и PDF помечают это явно.
 * Если для компании нет записи в БД (в датасете ФНС ~1,9 млн компаний из
 * ~4-5 млн действующих юрлиц — набор неполный) — используется демо-профиль.
 */
export const girboAdapter: DataProviderAdapter<GirboData> = {
  id: "GIRBO",
  label: "ФНС — открытые данные о доходах/расходах",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "GIRBO");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");

    const real = await tryRealLookup(query);
    if (real) {
      const latestYear = real.years[0]?.year ?? 0;
      const isStale = latestYear > 0 && new Date().getFullYear() - latestYear > STALE_AFTER_YEARS;
      return {
        source: "GIRBO",
        // "partial" — не "ok": реальные данные ФНС есть, но это только
        // выручка/расходы, без полного баланса (активы/капитал) — см. класс
        // комментарий адаптера. "stale" — если снимок старше STALE_AFTER_YEARS.
        status: isStale ? "stale" : "partial",
        data: { finance: real },
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
      };
    }

    const core = buildCompanyCore(query);
    return {
      source: "GIRBO",
      status: "demo",
      data: { finance: core.finance },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      errorMessage: "Компании нет в локальной БД (импортированный датасет ФНС покрывает ~1,9 млн из ~4-5 млн юрлиц) либо БД не наполнена — выполните npm run import:finance",
    };
  },
};
