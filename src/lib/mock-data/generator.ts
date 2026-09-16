import type {
  ArbitrationCase,
  ArbitrationInfo,
  BankruptcyInfo,
  BankruptcyPublication,
  CompanyIdentity,
  DirectorInfo,
  EnforcementInfo,
  EnforcementProceeding,
  FinanceInfo,
  FinanceYear,
  Founder,
  LicensesInfo,
  ManagementInfo,
  OwnersInfo,
  ProcurementContract,
  ProcurementInfo,
  RegistryFlags,
  RelatedCompaniesInfo,
  RelatedCompany,
  ReputationInfo,
  ReputationMention,
} from "@/types/dossier";
import type { DataSourceId, FactMeta } from "@/types/common";
import { SeededRandom } from "@/lib/utils/seededRandom";
import { buildValidInn10, buildValidOgrn13 } from "@/lib/utils/inn";
import {
  BUSINESS_CENTER_NAMES,
  CITIES,
  FIRST_NAMES_M,
  LAST_NAMES_M,
  LEGAL_FORMS,
  NAME_ADJECTIVES,
  NAME_NOUNS,
  NAME_SUFFIXES,
  NEWS_HEADLINE_TEMPLATES,
  OKVED_OPTIONS,
  PATRONYMIC_M,
  STREET_NAMES,
} from "./lexicon";

export type RiskArchetype = "low" | "moderate" | "high" | "critical";

export interface ResolvedCompanyQuery {
  seed: string;
  archetype: RiskArchetype;
  knownFullName?: string;
  knownShortName?: string;
  knownInn?: string;
  knownOgrn?: string;
}

export interface CompanyCoreData {
  company: CompanyIdentity;
  identity: RegistryFlags;
  management: ManagementInfo;
  owners: OwnersInfo;
  relatedCompanies: RelatedCompaniesInfo;
  finance: FinanceInfo;
  arbitration: ArbitrationInfo;
  enforcement: EnforcementInfo;
  bankruptcy: BankruptcyInfo;
  procurement: ProcurementInfo;
  licenses: LicensesInfo;
  reputation: ReputationInfo;
}

function nowIso(): string {
  return new Date().toISOString();
}

function meta(source: DataSourceId): FactMeta {
  return { source, retrievedAt: nowIso(), reliability: "demo" };
}

function isoDateYearsAgo(years: number, extraDays = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - Math.floor(years));
  d.setDate(d.getDate() - Math.round((years % 1) * 365) - extraDays);
  return d.toISOString().slice(0, 10);
}

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function pickWeighted<T extends { weight: number }>(rnd: SeededRandom, items: readonly T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rnd.float(0, total);
  for (const item of items) {
    if (r < item.weight) return item;
    r -= item.weight;
  }
  return items[items.length - 1];
}

function buildFio(rnd: SeededRandom): string {
  const last = rnd.pick(LAST_NAMES_M);
  const first = rnd.pick(FIRST_NAMES_M);
  const patronymic = rnd.pick(PATRONYMIC_M);
  return `${last} ${first} ${patronymic}`;
}

function buildFakeCompanyName(rnd: SeededRandom, legalFormShort: string): { fullName: string; shortName: string } {
  const adj = rnd.pick(NAME_ADJECTIVES);
  const noun = rnd.pick(NAME_NOUNS);
  const suffix = rnd.pick(NAME_SUFFIXES);
  const name = `${adj}${noun}${suffix}`;
  const legalForm = LEGAL_FORMS.find((f) => f.short === legalFormShort) ?? LEGAL_FORMS[0];
  return {
    fullName: `${legalForm.full} «${name}»`,
    shortName: `${legalFormShort} «${name}»`,
  };
}

/** Диапазоны «возраста» компании (лет) по архетипу риска — влияет на risk-engine правило возраста. */
const AGE_RANGE_BY_ARCHETYPE: Record<RiskArchetype, [number, number]> = {
  low: [6, 22],
  moderate: [2, 15],
  high: [0.4, 9],
  critical: [0.3, 7],
};

/** Базовая годовая выручка (руб.), масштабируется случайным множителем внутри архетипа. */
const REVENUE_BASE_BY_ARCHETYPE: Record<RiskArchetype, [number, number]> = {
  low: [40_000_000, 900_000_000],
  moderate: [8_000_000, 250_000_000],
  high: [2_000_000, 80_000_000],
  critical: [500_000, 30_000_000],
};

export function buildCompanyCore(resolved: ResolvedCompanyQuery): CompanyCoreData {
  const rnd = new SeededRandom(resolved.seed);
  const { archetype } = resolved;

  // --- company (ФНС / ЕГРЮЛ) ---
  const legalForm = pickWeighted(rnd, LEGAL_FORMS);
  const generatedName = buildFakeCompanyName(rnd, legalForm.short);
  const fullName = resolved.knownFullName ?? generatedName.fullName;
  const shortName = resolved.knownShortName ?? generatedName.shortName;

  const inn = resolved.knownInn ?? buildValidInn10(String(rnd.int(100000000, 999999999)));
  const ogrn = resolved.knownOgrn ?? buildValidOgrn13(String(rnd.int(100000000000, 999999999999)));
  const kpp = String(rnd.int(100000000, 999999999)).slice(0, 9);

  const [ageMin, ageMax] = AGE_RANGE_BY_ARCHETYPE[archetype];
  const ageYears = rnd.float(ageMin, ageMax);
  const registrationDate = isoDateYearsAgo(ageYears);

  const city = rnd.pick(CITIES);
  const street = rnd.pick(STREET_NAMES);
  const isMassAddress = rnd.chance(archetype === "critical" ? 0.45 : archetype === "high" ? 0.28 : archetype === "moderate" ? 0.1 : 0.03);
  const legalAddress = isMassAddress
    ? `${city.region}, г. ${city.city}, ${street}, д. ${rnd.int(1, 40)}, бизнес-центр ${rnd.pick(BUSINESS_CENTER_NAMES)}, офис ${rnd.int(100, 950)}`
    : `${city.region}, г. ${city.city}, ${street}, д. ${rnd.int(1, 40)}, оф. ${rnd.int(1, 90)}`;

  const okved = rnd.pick(OKVED_OPTIONS);

  let status: CompanyIdentity["status"] = "active";
  let statusLabel = "Действующая";
  let liquidationDate: string | undefined;
  if (archetype === "critical") {
    const roll = rnd.next();
    if (roll < 0.18) {
      status = "bankrupt";
      statusLabel = "Банкротство (конкурсное производство)";
    } else if (roll < 0.3) {
      status = "liquidating";
      statusLabel = "В процессе ликвидации";
      liquidationDate = isoDateDaysAgo(rnd.int(10, 200));
    }
  }

  const authorizedCapital =
    archetype === "low"
      ? rnd.int(100_000, 5_000_000)
      : archetype === "moderate"
        ? rnd.int(30_000, 1_000_000)
        : rnd.int(10_000, 50_000);

  const company: CompanyIdentity = {
    fullName,
    shortName,
    inn,
    ogrn,
    kpp,
    legalForm: legalForm.full,
    status,
    statusLabel,
    registrationDate,
    liquidationDate,
    okvedCode: okved.code,
    okvedName: okved.name,
    legalAddress,
    authorizedCapital,
    meta: meta("FNS"),
  };

  const hasUnreliableDataMark = rnd.chance(
    archetype === "critical" ? 0.35 : archetype === "high" ? 0.18 : archetype === "moderate" ? 0.05 : 0.01
  );
  const identity: RegistryFlags = {
    addressIsMassRegistration: isMassAddress,
    hasUnreliableDataMark,
    taxAuthorityName: `Межрайонная ИФНС России по ${city.city}`,
    meta: meta("FNS"),
  };

  // --- management ---
  const isMassDirector = rnd.chance(archetype === "critical" ? 0.25 : archetype === "high" ? 0.12 : 0.02);
  const isDisqualified = archetype === "critical" && rnd.chance(0.08);
  const director: DirectorInfo = {
    fullName: buildFio(rnd),
    position: "Генеральный директор",
    appointedDate: isoDateYearsAgo(Math.min(ageYears, rnd.float(0.2, Math.max(0.3, ageYears)))),
    isMassDirector,
    isDisqualified,
    meta: meta("FNS"),
  };
  const management: ManagementInfo = { director, registryFlags: identity };

  // --- owners ---
  const founderCount = rnd.int(1, 3);
  const founders: Founder[] = [];
  let remainingShare = 100;
  for (let i = 0; i < founderCount; i++) {
    const isLast = i === founderCount - 1;
    const share = isLast ? remainingShare : Math.min(remainingShare - (founderCount - i - 1), rnd.int(15, Math.max(16, remainingShare - (founderCount - i - 1))));
    remainingShare -= share;
    const type: Founder["type"] = rnd.chance(0.75) ? "individual" : "company";
    founders.push({
      name: type === "individual" ? buildFio(rnd) : buildFakeCompanyName(rnd, "ООО").fullName,
      type,
      inn: type === "company" ? buildValidInn10(String(rnd.int(100000000, 999999999))) : undefined,
      sharePercent: share,
      meta: meta("FNS"),
    });
  }
  const owners: OwnersInfo = { founders, meta: meta("FNS") };

  // --- related companies ---
  const relatedCount = archetype === "low" ? rnd.int(0, 1) : archetype === "moderate" ? rnd.int(0, 2) : archetype === "high" ? rnd.int(1, 3) : rnd.int(2, 4);
  const relatedItems: RelatedCompany[] = [];
  for (let i = 0; i < relatedCount; i++) {
    const name = buildFakeCompanyName(rnd, rnd.pick(LEGAL_FORMS).short);
    const troubled = (archetype === "high" || archetype === "critical") && rnd.chance(0.4);
    const relStatus: RelatedCompany["status"] = troubled ? rnd.pick(["liquidated", "bankrupt"] as const) : "active";
    relatedItems.push({
      name: name.shortName,
      inn: buildValidInn10(String(rnd.int(100000000, 999999999))),
      relationType: rnd.pick(["общий учредитель", "общий директор", "правопреемник", "дочерняя организация"] as const),
      status: relStatus,
      statusLabel: relStatus === "active" ? "Действующая" : relStatus === "liquidated" ? "Ликвидирована" : "Банкротство",
      meta: meta("FNS"),
    });
  }
  const relatedCompanies: RelatedCompaniesInfo = { items: relatedItems, meta: meta("FNS") };

  // --- finance (ГИР БО) ---
  const [revMin, revMax] = REVENUE_BASE_BY_ARCHETYPE[archetype];
  const baseRevenue = rnd.float(revMin, revMax);
  const currentYear = new Date().getFullYear() - 1; // последняя доступная отчётность — за прошлый год
  // Тренд намеренно не даёт архетипам "moderate"/"high"/"critical" шанса на "growth" —
  // рост выручки читается как признак низкого риска и не должен доставаться
  // компаниям с изначально повышенным профилем риска (иначе итоговый балл
  // может случайно "размыться" до низкого вне зависимости от архетипа).
  const trend: FinanceInfo["trend"] =
    archetype === "low" ? "growth" : archetype === "moderate" ? (rnd.chance(0.65) ? "stagnation" : "decline") : archetype === "high" ? (rnd.chance(0.7) ? "decline" : "stagnation") : "decline";

  const years: FinanceYear[] = [];
  let revenue = baseRevenue;
  for (let i = 0; i < 3; i++) {
    const year = currentYear - i;
    if (year < new Date(registrationDate).getFullYear()) break;
    const marginBase = archetype === "low" ? rnd.float(0.06, 0.16) : archetype === "moderate" ? rnd.float(-0.03, 0.06) : archetype === "high" ? rnd.float(-0.12, 0.02) : rnd.float(-0.25, -0.02);
    const netProfit = Math.round(revenue * marginBase);
    const assets = Math.round(revenue * rnd.float(0.4, 1.3));
    const capitalRatio = archetype === "critical" ? rnd.float(-0.3, -0.02) : archetype === "high" ? rnd.float(-0.1, 0.08) : archetype === "moderate" ? rnd.float(-0.03, 0.18) : rnd.float(0.15, 0.45);
    const capital = Math.round(assets * capitalRatio);
    const accountsPayable = Math.round(revenue * rnd.float(0.05, archetype === "critical" ? 0.6 : archetype === "high" ? 0.4 : 0.2));
    years.push({ year, revenue: Math.round(revenue), netProfit, assets, capital, accountsPayable, meta: meta("GIRBO") });
    // шаг к предыдущему году в соответствии с трендом
    const stepDir = trend === "growth" ? rnd.float(1.05, 1.25) : trend === "decline" ? rnd.float(0.7, 0.95) : rnd.float(0.92, 1.08);
    revenue = revenue / stepDir;
  }
  const finance: FinanceInfo = { years, trend, meta: meta("GIRBO") };

  // --- arbitration (КАД Арбитр) ---
  // Минимумы диапазонов подобраны так, чтобы правило judicial.defendant_case_count
  // (rules.ts) надёжно относило категорию к ожидаемому архетипу, а не только "в среднем".
  const defendantCasesCount = archetype === "low" ? rnd.int(0, 1) : archetype === "moderate" ? rnd.int(2, 5) : archetype === "high" ? rnd.int(5, 12) : rnd.int(9, 22);
  const plaintiffCasesCount = rnd.int(0, archetype === "low" ? 3 : 2);
  const cases: ArbitrationCase[] = [];
  let totalClaimAmountAsDefendant = 0;
  const subjects = ["Взыскание задолженности по договору поставки", "Взыскание задолженности по договору подряда", "Спор о неисполнении обязательств по оплате", "Взыскание неустойки", "Спор о качестве выполненных работ"];
  for (let i = 0; i < defendantCasesCount; i++) {
    const amount = Math.round(rnd.float(50_000, baseRevenue * 0.15));
    totalClaimAmountAsDefendant += amount;
    const statusRoll = rnd.next();
    const status: ArbitrationCase["status"] = statusRoll < 0.35 ? "pending" : statusRoll < 0.75 ? "satisfied" : statusRoll < 0.9 ? "settled" : "dismissed";
    cases.push({
      caseNumber: `А${rnd.int(40, 41)}-${rnd.int(10000, 99999)}/${new Date().getFullYear() - rnd.int(0, 2)}`,
      date: isoDateDaysAgo(rnd.int(10, 700)),
      role: "defendant",
      roleLabel: "Ответчик",
      counterparty: buildFakeCompanyName(rnd, "ООО").shortName,
      claimAmount: amount,
      subject: rnd.pick(subjects),
      status,
      statusLabel: status === "pending" ? "На рассмотрении" : status === "satisfied" ? "Удовлетворён" : status === "settled" ? "Мировое соглашение" : "Отказано",
      meta: meta("KAD_ARBITR"),
    });
  }
  for (let i = 0; i < plaintiffCasesCount; i++) {
    const amount = Math.round(rnd.float(50_000, baseRevenue * 0.1));
    const status: ArbitrationCase["status"] = rnd.chance(0.6) ? "satisfied" : "pending";
    cases.push({
      caseNumber: `А${rnd.int(40, 41)}-${rnd.int(10000, 99999)}/${new Date().getFullYear() - rnd.int(0, 2)}`,
      date: isoDateDaysAgo(rnd.int(10, 700)),
      role: "plaintiff",
      roleLabel: "Истец",
      counterparty: buildFakeCompanyName(rnd, "ООО").shortName,
      claimAmount: amount,
      subject: rnd.pick(subjects),
      status,
      statusLabel: status === "pending" ? "На рассмотрении" : "Удовлетворён",
      meta: meta("KAD_ARBITR"),
    });
  }
  cases.sort((a, b) => (a.date < b.date ? 1 : -1));
  const arbitration: ArbitrationInfo = {
    cases,
    totalCasesAsDefendant: defendantCasesCount,
    totalCasesAsPlaintiff: plaintiffCasesCount,
    totalClaimAmountAsDefendant: Math.round(totalClaimAmountAsDefendant),
    meta: meta("KAD_ARBITR"),
  };

  // --- enforcement (ФССП) ---
  const proceedingsCount = archetype === "low" ? rnd.int(0, 0) : archetype === "moderate" ? rnd.int(1, 3) : archetype === "high" ? rnd.int(3, 7) : rnd.int(5, 10);
  const proceedings: EnforcementProceeding[] = [];
  let activeAmount = 0;
  let activeCount = 0;
  for (let i = 0; i < proceedingsCount; i++) {
    const amount = Math.round(rnd.float(20_000, baseRevenue * 0.08));
    const isActive = rnd.chance(archetype === "critical" ? 0.8 : archetype === "high" ? 0.65 : 0.5);
    if (isActive) {
      activeAmount += amount;
      activeCount++;
    }
    proceedings.push({
      number: `${rnd.int(100000, 999999)}/${new Date().getFullYear() - rnd.int(0, 2)}/${rnd.int(10000, 99999)}-ИП`,
      date: isoDateDaysAgo(rnd.int(5, 600)),
      subject: rnd.pick(["Взыскание задолженности", "Исполнение решения суда", "Взыскание налоговой задолженности", "Взыскание госпошлины"]),
      amount,
      status: isActive ? "active" : "closed",
      statusLabel: isActive ? "На исполнении" : "Окончено",
      bailiffOffice: `ОСП по ${city.city}`,
      meta: meta("FSSP"),
    });
  }
  const enforcement: EnforcementInfo = { proceedings, activeCount, activeAmount: Math.round(activeAmount), meta: meta("FSSP") };

  // --- bankruptcy (Федресурс) ---
  const bankruptcyChance = archetype === "critical" ? 0.65 : archetype === "high" ? 0.22 : 0.01;
  const hasActiveCase = status === "bankrupt" || rnd.chance(bankruptcyChance);
  let stage: BankruptcyInfo["stage"];
  let stageLabel: string | undefined;
  const publications: BankruptcyPublication[] = [];
  if (hasActiveCase) {
    const stages: Array<{ key: NonNullable<BankruptcyInfo["stage"]>; label: string }> = [
      { key: "observation", label: "Наблюдение" },
      { key: "external_management", label: "Внешнее управление" },
      { key: "receivership", label: "Конкурсное производство" },
      { key: "settlement", label: "Мировое соглашение" },
    ];
    const s = status === "bankrupt" ? stages[2] : rnd.pick(stages);
    stage = s.key;
    stageLabel = s.label;
    publications.push({
      date: isoDateDaysAgo(rnd.int(30, 400)),
      type: "Сообщение о введении процедуры банкротства",
      description: `Арбитражным судом введена процедура «${s.label.toLowerCase()}» в отношении должника`,
      meta: meta("FEDRESURS"),
    });
  } else if (archetype === "high" && rnd.chance(0.4)) {
    publications.push({
      date: isoDateDaysAgo(rnd.int(10, 300)),
      type: "Сообщение о намерении подать заявление о банкротстве",
      description: "Кредитор уведомил о намерении обратиться в суд с заявлением о признании должника банкротом",
      meta: meta("FEDRESURS"),
    });
  }
  const bankruptcy: BankruptcyInfo = { hasActiveCase, stage, stageLabel, publications, meta: meta("FEDRESURS") };

  // --- procurement (ЕИС закупки) ---
  const asSupplierContractsCount = archetype === "low" ? rnd.int(0, 12) : archetype === "moderate" ? rnd.int(0, 6) : rnd.int(0, 3);
  let asSupplierTotalAmount = 0;
  const contracts: ProcurementContract[] = [];
  for (let i = 0; i < Math.min(asSupplierContractsCount, 8); i++) {
    const amount = Math.round(rnd.float(100_000, baseRevenue * 0.3));
    asSupplierTotalAmount += amount;
    const status: ProcurementContract["status"] = rnd.chance(archetype === "critical" ? 0.25 : 0.05) ? "terminated" : rnd.chance(0.7) ? "executed" : "active";
    contracts.push({
      number: `${rnd.int(1000000000000, 9999999999999)}`,
      date: isoDateDaysAgo(rnd.int(30, 900)),
      customerOrSupplier: `Государственный заказчик №${rnd.int(1, 99)}`,
      subject: rnd.pick(["Поставка оборудования", "Оказание услуг по обслуживанию", "Выполнение строительных работ", "Поставка расходных материалов"]),
      amount,
      status,
      statusLabel: status === "executed" ? "Исполнен" : status === "active" ? "На исполнении" : "Расторгнут",
      meta: meta("EIS_ZAKUPKI"),
    });
  }
  const isInUnreliableSuppliersRegistry = archetype !== "low" && rnd.chance(archetype === "critical" ? 0.3 : archetype === "high" ? 0.12 : 0.02);
  const procurement: ProcurementInfo = {
    asSupplierContractsCount,
    asSupplierTotalAmount: Math.round(asSupplierTotalAmount),
    isInUnreliableSuppliersRegistry,
    contracts,
    meta: meta("EIS_ZAKUPKI"),
  };

  // --- licenses (ЦБ РФ / отраслевые реестры) ---
  const licenses: LicensesInfo = { items: [], meta: meta("CBR") };
  if (okved.requiresLicense) {
    const licenseStatus: LicensesInfo["items"][number]["status"] = archetype === "critical" && rnd.chance(0.3) ? "revoked" : "active";
    licenses.items.push({
      type: "Лицензия на осуществление финансовых операций",
      number: `${rnd.int(1000, 9999)}-${rnd.int(1, 9)}`,
      issuedBy: "Банк России",
      issuedDate: isoDateYearsAgo(rnd.float(1, Math.max(1.5, ageYears))),
      validUntil: licenseStatus === "active" ? undefined : isoDateDaysAgo(rnd.int(10, 200)),
      status: licenseStatus,
      statusLabel: licenseStatus === "active" ? "Действует" : "Отозвана",
      meta: meta("CBR"),
    });
  }

  // --- reputation (открытые источники) ---
  const negativeCount = archetype === "low" ? rnd.int(0, 0) : archetype === "moderate" ? rnd.int(0, 1) : archetype === "high" ? rnd.int(1, 3) : rnd.int(2, 5);
  const positiveCount = archetype === "low" ? rnd.int(1, 3) : rnd.int(0, 1);
  const mentions: ReputationMention[] = [];
  const displayName = shortName.replace(/^(ООО|АО|ПАО)\s*/, "");
  for (let i = 0; i < positiveCount; i++) {
    mentions.push({
      title: rnd.pick(NEWS_HEADLINE_TEMPLATES.positive).replace("{company}", displayName),
      date: isoDateDaysAgo(rnd.int(10, 500)),
      sentiment: "positive",
      meta: meta("WEB_REPUTATION"),
    });
  }
  for (let i = 0; i < negativeCount; i++) {
    mentions.push({
      title: rnd.pick(NEWS_HEADLINE_TEMPLATES.negative).replace("{company}", displayName),
      date: isoDateDaysAgo(rnd.int(5, 400)),
      sentiment: "negative",
      meta: meta("WEB_REPUTATION"),
    });
  }
  mentions.sort((a, b) => (a.date < b.date ? 1 : -1));
  const reputation: ReputationInfo = { mentions, negativeMentionsCount: negativeCount, meta: meta("WEB_REPUTATION") };

  return {
    company,
    identity,
    management,
    owners,
    relatedCompanies,
    finance,
    arbitration,
    enforcement,
    bankruptcy,
    procurement,
    licenses,
    reputation,
  };
}
