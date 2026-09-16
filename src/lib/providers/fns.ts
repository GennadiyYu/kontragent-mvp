import { buildCompanyCore, type ResolvedCompanyQuery } from "@/lib/mock-data/generator";
import type {
  CompanyIdentity,
  ManagementInfo,
  OwnersInfo,
  RegistryFlags,
  RelatedCompaniesInfo,
} from "@/types/dossier";
import { COMPANY_STATUS_LABEL } from "@/lib/utils/companyStatus";
import { LEGAL_FORMS } from "@/lib/mock-data/lexicon";
import { simulateLatency } from "./mockLatency";
import { fetchDaDataByInnOrOgrn, fetchDaDataByName, type DaDataPartyRecord } from "./dadata";
import { findDisqualifiedMatch, getSpecialRegime, getTaxDebt } from "./fnsRiskDb";
import { getTaxPaid } from "./fnsTaxPaid";
import { getEmployeeCount } from "./fnsEmployees";
import type { DataProviderAdapter } from "./types";

export interface FnsData {
  company: CompanyIdentity;
  identity: RegistryFlags;
  management: ManagementInfo;
  owners: OwnersInfo;
  relatedCompanies: RelatedCompaniesInfo;
}

function epochToIsoDate(ms?: number | null): string | undefined {
  if (!ms) return undefined;
  return new Date(ms).toISOString().slice(0, 10);
}

function guessLegalFormFull(shortWithOpf?: string, opfFull?: string): string {
  if (opfFull) return opfFull;
  if (!shortWithOpf) return "Общество с ограниченной ответственностью";
  const prefix = shortWithOpf.trim().split(/\s|«/)[0].toUpperCase();
  const match = LEGAL_FORMS.find((f) => f.short === prefix);
  return match?.full ?? shortWithOpf;
}

/** Преобразует запись DaData (реальные данные ЕГРЮЛ) в наши типы company/identity/management. */
async function mapDaDataRecord(record: DaDataPartyRecord): Promise<Pick<FnsData, "company" | "identity" | "management">> {
  const d = record.data;
  const now = new Date().toISOString();
  const meta = { source: "FNS" as const, retrievedAt: now, reliability: "verified" as const };

  const mainOkved = d.okveds?.find((o) => o.main) ?? d.okveds?.[0];
  const status = (d.state.status?.toLowerCase() ?? "active") as CompanyIdentity["status"];

  const company: CompanyIdentity = {
    fullName: d.name?.full_with_opf ?? d.name?.full ?? record.value,
    shortName: d.name?.short_with_opf ?? d.name?.short ?? record.value,
    inn: d.inn,
    ogrn: d.ogrn,
    kpp: d.kpp ?? undefined,
    legalForm: guessLegalFormFull(d.name?.short_with_opf, d.opf?.full),
    status,
    statusLabel: COMPANY_STATUS_LABEL[status] ?? COMPANY_STATUS_LABEL.active,
    registrationDate: epochToIsoDate(d.state.registration_date) ?? now.slice(0, 10),
    liquidationDate: epochToIsoDate(d.state.liquidation_date),
    okvedCode: mainOkved?.code ?? d.okved ?? "—",
    okvedName: mainOkved?.name ?? "Не указан",
    legalAddress: d.address?.value ?? "Не указан",
    authorizedCapital: typeof d.capital?.value === "number" ? d.capital.value : undefined,
    meta,
  };

  // Реальные открытые данные ФНС (локальная БД, см. providers/fnsRiskDb.ts,
  // fnsTaxPaid.ts, fnsEmployees.ts и scripts/import-fns-risk.mjs) —
  // налоговая задолженность, спецрежим, уплаченные налоги, численность.
  // undefined, если ETL не выполнялся; null, если ИНН проверен в датасете,
  // но записи нет (см. семантику "REAL_NOT_FOUND" в каждом провайдере).
  const [taxDebt, specialRegime, taxPaid, employees] = await Promise.all([
    getTaxDebt(d.inn),
    getSpecialRegime(d.inn),
    getTaxPaid(d.inn),
    getEmployeeCount(d.inn),
  ]);

  const identity: RegistryFlags = {
    // Бесплатный тариф DaData не даёт отдельный признак «массовый адрес» —
    // честно оставляем false, а не выдумываем; агрегированный признак
    // недостоверности (data.invalid) отражаем как есть.
    addressIsMassRegistration: false,
    hasUnreliableDataMark: Boolean(d.invalid),
    taxDebtAmount: taxDebt ? taxDebt.amount : null,
    hasSpecialTaxRegime: specialRegime ? specialRegime.isUsn || specialRegime.isAusn || specialRegime.isEsxn || specialRegime.isSrp : undefined,
    taxPaidAmount: taxPaid ? taxPaid.amount : null,
    taxPaidPeriodYear: taxPaid ? taxPaid.periodYear : null,
    employeesCount: employees ? employees.count : null,
    employeesPeriodYear: employees ? employees.periodYear : null,
    meta,
  };

  const directorFullName = d.management?.name ?? "Не указан";
  // Сверка с реестром дисквалифицированных лиц ФНС — ТОЛЬКО по совпадению
  // (ФИО директора + название именно этой компании), см. fnsRiskDb.ts —
  // исключает ложные срабатывания на однофамильцев.
  const disqualifiedMatch =
    (await findDisqualifiedMatch(directorFullName, company.shortName)) ?? (await findDisqualifiedMatch(directorFullName, company.fullName));

  const management: ManagementInfo = {
    director: {
      fullName: directorFullName,
      position: d.management?.post ?? "Руководитель",
      isMassDirector: false, // недоступно на бесплатном тарифе DaData
      isDisqualified: Boolean(d.management?.disqualified) || Boolean(disqualifiedMatch),
      meta,
    },
    registryFlags: identity,
  };

  return { company, identity, management };
}

async function tryRealLookup(query: ResolvedCompanyQuery, signal: AbortSignal): Promise<Pick<FnsData, "company" | "identity" | "management"> | null> {
  if (query.curated) return null; // кураторские демо-компании всегда используют стабильный демо-профиль
  if (!process.env.DADATA_API_KEY) return null;

  try {
    let record: DaDataPartyRecord | null = null;
    if (query.knownInn) record = await fetchDaDataByInnOrOgrn(query.knownInn, signal);
    else if (query.knownOgrn) record = await fetchDaDataByInnOrOgrn(query.knownOgrn, signal);
    else record = await fetchDaDataByName(query.rawQuery, signal);
    if (!record?.data?.inn) return null;
    return await mapDaDataRecord(record);
  } catch {
    return null; // любая ошибка реального источника — тихий откат на демо-данные, а не сбой проверки
  }
}

/** "Пустое, но проверенное" состояние учредителей/связей для реальной компании — НЕ демо-заглушка (см. fetch() ниже). */
function emptyOwnersAndRelated(): Pick<FnsData, "owners" | "relatedCompanies"> {
  const meta = { source: "FNS" as const, retrievedAt: new Date().toISOString(), reliability: "unconfirmed" as const };
  return {
    owners: { founders: [], meta },
    relatedCompanies: { items: [], meta },
  };
}

/**
 * Адаптер ФНС России (ЕГРЮЛ). Установочные данные, статус, руководитель,
 * налоговая задолженность/уплаченные налоги/численность — РЕАЛЬНЫЕ (через
 * бесплатный API DaData + локальную БД открытых данных ФНС), кроме
 * кураторских демо-компаний.
 *
 * КРИТИЧНО (см. задачу data quality): демо-профиль (`buildCompanyCore`)
 * используется ТОЛЬКО для кураторских демо-компаний (`query.curated`).
 * Для любого другого запроса — либо реальные данные, либо явно ПУСТОЙ
 * результат (`emptyOwnersAndRelated`, statusLabel через UI — «Данные пока
 * недоступны»), но никогда фиктивные цифры, выданные за настоящие.
 *
 * Про «Связи» (владелец/директор → другие юрлица): ИССЛЕДОВАНО (см. README)
 * — датасеты ФНС «массовый руководитель/учредитель» существуют формально,
 * но ФАКТИЧЕСКИ ЗАБРОШЕНЫ (последнее обновление — 22.05.2021, почти пустые
 * файлы) — использовать нельзя, поэтому owners/relatedCompanies для реальных
 * компаний всегда пусты (REAL_NOT_FOUND в смысле «источника для этого факта
 * сейчас просто нет», а не демо). Дисквалификация директора, напротив,
 * реальна и актуальна — сверяется СТРОГО по паре (ФИО директора + название
 * именно этой компании), чтобы не приписать дисквалификацию однофамильцу.
 */
export const fnsAdapter: DataProviderAdapter<FnsData> = {
  id: "FNS",
  label: "ФНС России — ЕГРЮЛ",
  async fetch(query, signal) {
    const started = Date.now();
    await simulateLatency(query.seed, "FNS");
    if (signal.aborted) throw new Error("Запрос отменён по таймауту");

    const real = await tryRealLookup(query, signal);
    if (real) {
      return {
        source: "FNS",
        status: "real_found",
        data: { ...real, ...emptyOwnersAndRelated() },
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
      };
    }

    if (query.curated) {
      const core = buildCompanyCore(query);
      return {
        source: "FNS",
        status: "demo",
        data: { company: core.company, identity: core.identity, management: core.management, owners: core.owners, relatedCompanies: core.relatedCompanies },
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
      };
    }

    // Не кураторский запрос, но и реальную личность подтвердить не удалось
    // (нет ключа DaData / компания не найдена в ЕГРЮЛ / сбой источника) —
    // честно показываем пустое состояние, а не выдуманный профиль.
    const emptyMeta = { source: "FNS" as const, retrievedAt: new Date().toISOString(), reliability: "unconfirmed" as const };
    const placeholderCompany: CompanyIdentity = {
      fullName: query.knownFullName ?? query.rawQuery,
      shortName: query.knownShortName ?? query.rawQuery,
      inn: query.knownInn ?? "—",
      ogrn: query.knownOgrn ?? "—",
      legalForm: "Не подтверждено",
      status: "active",
      statusLabel: "Не подтверждено",
      registrationDate: emptyMeta.retrievedAt.slice(0, 10),
      okvedCode: "—",
      okvedName: "Не подтверждено",
      legalAddress: "Не подтверждено",
      meta: emptyMeta,
    };
    return {
      source: "FNS",
      status: "unavailable",
      data: {
        company: placeholderCompany,
        identity: { addressIsMassRegistration: false, hasUnreliableDataMark: false, meta: emptyMeta },
        management: {
          director: { fullName: "Не указан", position: "Не указан", isMassDirector: false, isDisqualified: false, meta: emptyMeta },
          registryFlags: { addressIsMassRegistration: false, hasUnreliableDataMark: false, meta: emptyMeta },
        },
        ...emptyOwnersAndRelated(),
      },
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      errorMessage: "Компания не найдена в ЕГРЮЛ (через DaData) либо ключ DADATA_API_KEY не задан",
    };
  },
};
