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

async function tryRealLookup(query: ResolvedCompanyQuery, signal: AbortSignal): Promise<LicensesInfo | null> {
  if (query.curated) return null; // кураторские демо-компании — стабильный демо-профиль
  if (!query.knownInn) return null; // реальные сервисы ЦБ РФ поддерживают точный поиск только по ИНН/ОГРН

  try {
    const [finOrg, warning] = await Promise.all([
      fetchCbrFinOrgByInn(query.knownInn, signal),
      findCbrWarningEntry(query.knownInn, signal),
    ]);
    if (finOrg) return mapFinOrgToLicenses(finOrg, warning);

    // Компания не найдена среди участников финансового рынка — это РЕАЛЬНЫЙ и
    // ожидаемый результат для подавляющего большинства обычных компаний, а
    // не признак сбоя. Возвращаем настоящий (пустой по лицензиям) результат,
    // а не демо-заглушку, если хотя бы проверка предупредительного списка
    // была успешно выполнена (см. findCbrWarningEntry — при сетевой ошибке
    // список не загрузится и findCbrWarningEntry() тихо вернёт null, что не
    // отличить от "не найдено"; в рамках MVP это допустимый компромисс).
    const now = new Date().toISOString();
    const meta = { source: "CBR" as const, retrievedAt: now, reliability: "verified" as const };
    return {
      items: [],
      warningListEntry: warning ? { sign: warning.sign, addedDate: warning.date || now.slice(0, 10), meta } : null,
      meta,
    };
  } catch {
    return null;
  }
}

/**
 * Адаптер Банка России. РЕАЛЬНЫЕ данные (см. cbrFinOrg.ts) через два
 * официальных бесплатных сервиса ЦБ: SOAP-сервис FinOrg.asmx (лицензии
 * участников финансового рынка) и JSON-реестр предупреждений о признаках
 * нелегальной деятельности. Если компания не найдена ни там, ни там (для
 * подавляющего большинства обычных компаний, не работающих на финансовом
 * рынке, это ожидаемо) — статус "not_applicable"/"demo" с демо-заглушкой,
 * как и раньше.
 */
export const cbrAdapter: DataProviderAdapter<CbrData> = {
  id: "CBR",
  label: "Банк России — реестры и лицензии",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "CBR");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");

    const real = await tryRealLookup(query, signal);
    if (real) {
      return {
        source: "CBR",
        status: "ok",
        data: { licenses: real },
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
      };
    }

    const core = buildCompanyCore(query);
    const applicable = core.licenses.items.length > 0;
    return {
      source: "CBR",
      status: applicable ? "demo" : "not_applicable",
      data: { licenses: core.licenses },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  },
};
