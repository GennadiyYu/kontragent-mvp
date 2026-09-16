import { buildCompanyCore, type ResolvedCompanyQuery } from "@/lib/mock-data/generator";
import type { LicenseInfo, LicensesInfo } from "@/types/dossier";
import { simulateLatency } from "./mockLatency";
import { fetchCbrFinOrgByInn, findCbrWarningEntry, type CbrFinOrgRecord, type CbrWarningListRecord } from "./cbrFinOrg";
import type { DataProviderAdapter } from "./types";

export interface CbrData {
  licenses: LicensesInfo;
}

function toIsoDate(value: string | null): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function mapFinOrgToLicenses(record: CbrFinOrgRecord, warning: CbrWarningListRecord | null): LicensesInfo {
  const now = new Date().toISOString();
  const meta = { source: "CBR" as const, retrievedAt: now, reliability: "verified" as const };

  const items: LicenseInfo[] = record.licenses.map((l) => {
    const validUntil = toIsoDate(l.dtEnd);
    const isExpired = Boolean(validUntil && validUntil < now.slice(0, 10));
    return {
      type: l.licName || l.vidD || "Лицензия участника финансового рынка",
      number: l.licNumber || "—",
      issuedBy: "Банк России",
      issuedDate: toIsoDate(l.dtStart) ?? now.slice(0, 10),
      validUntil,
      status: isExpired ? "expired" : "active",
      statusLabel: isExpired ? "Истёк срок действия" : "Действует",
      meta,
    };
  });

  return {
    items,
    warningListEntry: warning ? { sign: warning.sign, addedDate: warning.date || now.slice(0, 10), meta } : null,
    meta,
  };
}

interface CbrLookupResult {
  licenses: LicensesInfo;
  /** Найдено ли что-то конкретное (лицензия участника финрынка или запись в предупредительном списке). */
  found: boolean;
}

/**
 * СЕМАНТИКА ОТСУТСТВИЯ ЗАПИСИ (REAL_NOT_FOUND): для подавляющего
 * большинства обычных компаний, не работающих на финансовом рынке,
 * отсутствие записи в FinOrg — ОЖИДАЕМЫЙ и корректный результат (это не
 * означает «компания надёжна», а означает «не регулируется Банком России»).
 * Предупредительный список проверяется независимо — см. findCbrWarningEntry.
 */
async function tryRealLookup(query: ResolvedCompanyQuery, signal: AbortSignal): Promise<CbrLookupResult | null> {
  if (!query.knownInn) return null; // реальные сервисы ЦБ РФ поддерживают точный поиск только по ИНН/ОГРН

  try {
    const [finOrg, warning] = await Promise.all([
      fetchCbrFinOrgByInn(query.knownInn, signal),
      findCbrWarningEntry(query.knownInn, signal),
    ]);
    if (finOrg) return { licenses: mapFinOrgToLicenses(finOrg, warning), found: true };

    const now = new Date().toISOString();
    const meta = { source: "CBR" as const, retrievedAt: now, reliability: "verified" as const };
    return {
      licenses: { items: [], warningListEntry: warning ? { sign: warning.sign, addedDate: warning.date || now.slice(0, 10), meta } : null, meta },
      found: Boolean(warning),
    };
  } catch {
    return null;
  }
}

function emptyLicenses(): LicensesInfo {
  return { items: [], warningListEntry: null, meta: { source: "CBR", retrievedAt: new Date().toISOString(), reliability: "unconfirmed" } };
}

/**
 * Адаптер Банка России. РЕАЛЬНЫЕ данные (см. cbrFinOrg.ts) через два
 * официальных бесплатных сервиса ЦБ: SOAP-сервис FinOrg.asmx (лицензии
 * участников финансового рынка) и JSON-реестр предупреждений о признаках
 * нелегальной деятельности.
 *
 * ДЕМО-ДАННЫЕ (buildCompanyCore) используются ТОЛЬКО для кураторских
 * демо-компаний — для любого другого запроса при невозможности выполнить
 * реальную проверку возвращается пустой блок лицензий ("unavailable"), а не
 * выдуманные цифры (см. задачу data quality).
 */
export const cbrAdapter: DataProviderAdapter<CbrData> = {
  id: "CBR",
  label: "Банк России — реестры и лицензии",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "CBR");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");

    if (!query.curated) {
      const real = await tryRealLookup(query, signal);
      if (real) {
        return {
          source: "CBR",
          status: real.found ? "real_found" : "real_not_found",
          data: { licenses: real.licenses },
          retrievedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
        };
      }
      return {
        source: "CBR",
        status: "unavailable",
        data: { licenses: emptyLicenses() },
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        errorMessage: query.knownInn ? "Сервис ЦБ РФ временно недоступен" : "Поиск по ИНН/ОГРН недоступен для запроса без установленного ИНН",
      };
    }

    const core = buildCompanyCore(query);
    return {
      source: "CBR",
      status: "demo",
      data: { licenses: core.licenses },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  },
};
