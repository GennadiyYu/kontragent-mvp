import type {
  DataSourceId,
  FactMeta,
  RiskCategoryKey,
  RiskLevel,
  SourceFetchStatus,
} from "./common";

/** Базовые идентификационные данные компании, отображаются в шапке страницы. */
export interface CompanyIdentity {
  fullName: string;
  shortName: string;
  inn: string;
  ogrn: string;
  kpp?: string;
  legalForm: string; // например, «Общество с ограниченной ответственностью»
  status: "active" | "liquidating" | "liquidated" | "bankrupt" | "reorganizing";
  statusLabel: string;
  registrationDate: string; // ISO
  liquidationDate?: string;
  okvedCode: string;
  okvedName: string;
  legalAddress: string;
  authorizedCapital?: number; // в рублях
  meta: FactMeta;
}

/** Дополнительные регистрационные признаки, влияющие на корпоративный риск. */
export interface RegistryFlags {
  addressIsMassRegistration: boolean; // массовый адрес регистрации
  hasUnreliableDataMark: boolean; // отметка о недостоверности сведений (ФНС)
  taxAuthorityName?: string;
  meta: FactMeta;
}

export interface DirectorInfo {
  fullName: string;
  position: string;
  appointedDate?: string;
  isMassDirector: boolean; // директор в нескольких десятках компаний
  isDisqualified: boolean; // дисквалифицирован
  meta: FactMeta;
}

export interface ManagementInfo {
  director: DirectorInfo;
  registryFlags: RegistryFlags;
}

export interface Founder {
  name: string;
  type: "individual" | "company" | "state" | "foreign";
  inn?: string;
  sharePercent: number;
  meta: FactMeta;
}

export interface OwnersInfo {
  founders: Founder[];
  beneficiaryNote?: string; // текстовое пояснение, если бенефициар не раскрыт напрямую
  meta: FactMeta;
}

export interface RelatedCompany {
  name: string;
  inn: string;
  relationType: "общий учредитель" | "общий директор" | "правопреемник" | "дочерняя организация";
  status: CompanyIdentity["status"];
  statusLabel: string;
  meta: FactMeta;
}

export interface RelatedCompaniesInfo {
  items: RelatedCompany[];
  meta: FactMeta;
}

export interface FinanceYear {
  year: number;
  revenue: number; // выручка, руб.
  netProfit: number; // чистая прибыль (убыток), руб.
  assets: number; // балансовая стоимость активов, руб.
  capital: number; // капитал и резервы, руб.
  accountsPayable: number; // кредиторская задолженность, руб.
  meta: FactMeta;
}

export interface FinanceInfo {
  years: FinanceYear[]; // по убыванию года (последний год — первый элемент)
  trend: "growth" | "decline" | "stagnation" | "unknown";
  meta: FactMeta;
}

export interface ArbitrationCase {
  caseNumber: string;
  date: string;
  role: "defendant" | "plaintiff" | "third_party";
  roleLabel: string;
  counterparty: string;
  claimAmount: number;
  subject: string;
  status: "pending" | "satisfied" | "dismissed" | "settled";
  statusLabel: string;
  sourceUrl?: string;
  meta: FactMeta;
}

export interface ArbitrationInfo {
  cases: ArbitrationCase[];
  totalCasesAsDefendant: number;
  totalCasesAsPlaintiff: number;
  totalClaimAmountAsDefendant: number;
  meta: FactMeta;
}

export interface EnforcementProceeding {
  number: string;
  date: string;
  subject: string;
  amount: number;
  status: "active" | "closed";
  statusLabel: string;
  bailiffOffice: string;
  meta: FactMeta;
}

export interface EnforcementInfo {
  proceedings: EnforcementProceeding[];
  activeCount: number;
  activeAmount: number;
  meta: FactMeta;
}

export interface BankruptcyPublication {
  date: string;
  type: string; // например, «Сообщение о намерении подать заявление о банкротстве»
  description: string;
  sourceUrl?: string;
  meta: FactMeta;
}

export interface BankruptcyInfo {
  hasActiveCase: boolean;
  stage?: "observation" | "external_management" | "receivership" | "settlement";
  stageLabel?: string;
  publications: BankruptcyPublication[];
  meta: FactMeta;
}

export interface ProcurementContract {
  number: string;
  date: string;
  customerOrSupplier: string;
  subject: string;
  amount: number;
  status: "executed" | "active" | "terminated";
  statusLabel: string;
  meta: FactMeta;
}

export interface ProcurementInfo {
  asSupplierContractsCount: number;
  asSupplierTotalAmount: number;
  isInUnreliableSuppliersRegistry: boolean; // РНП
  contracts: ProcurementContract[];
  meta: FactMeta;
}

export interface LicenseInfo {
  type: string;
  number: string;
  issuedBy: string;
  issuedDate: string;
  validUntil?: string;
  status: "active" | "suspended" | "revoked" | "expired";
  statusLabel: string;
  meta: FactMeta;
}

export interface LicensesInfo {
  items: LicenseInfo[];
  meta: FactMeta;
}

export interface ReputationMention {
  title: string;
  date: string;
  sentiment: "positive" | "neutral" | "negative";
  sourceUrl?: string;
  meta: FactMeta;
}

export interface ReputationInfo {
  mentions: ReputationMention[];
  negativeMentionsCount: number;
  meta: FactMeta;
}

export interface TimelineEvent {
  date: string;
  type: string;
  description: string;
  meta: FactMeta;
}

export interface EventsInfo {
  timeline: TimelineEvent[];
}

/** Сводка по состоянию каждого источника — вкладка «Источники». */
export interface SourceStatusSummary {
  source: DataSourceId;
  label: string;
  status: SourceFetchStatus;
  retrievedAt: string;
  latencyMs?: number;
  note: string;
}

/** Один пункт «почему получился такой балл» — вклад конкретного правила. */
export interface RuleContribution {
  ruleId: string;
  description: string;
  points: number; // может быть отрицательным (снижает риск)
  category: RiskCategoryKey;
}

export interface RiskCategoryScore {
  category: RiskCategoryKey;
  score: number; // 0–100
  level: RiskLevel;
  weight: number; // доля в итоговом балле, 0..1
  facts: string[]; // выявленные факты (для матрицы рисков)
  consequences: string[]; // возможные последствия (для матрицы рисков)
}

export interface RiskAssessment {
  totalScore: number; // 0–100
  level: RiskLevel;
  categories: RiskCategoryScore[];
  positiveFactors: string[];
  riskFactors: string[];
  contributions: RuleContribution[]; // полная трассировка расчёта
  computedAt: string;
  engineVersion: string;
}

export interface AiSummary {
  generatedBy: "gemini" | "template";
  summaryText: string;
  keyPositives: string[];
  keyRisks: string[];
  recommendation: string;
  disclaimer: string;
  generatedAt: string;
  modelName?: string;
}

export interface DealInput {
  amount: number; // сумма сделки, руб.
  prepaymentPercent: number; // 0..100
  postpaymentDays: number; // срок постоплаты, дней
  subject: string; // предмет договора
}

export interface DealAssessment {
  input: DealInput;
  dealRiskScore: number; // 0–100
  dealRiskLevel: RiskLevel;
  recommendations: string[];
  suggestedTerms: {
    maxRecommendedPrepaymentBelow?: number; // ниже этого % предоплаты — риск растёт
    maxRecommendedPostpaymentDays?: number;
    requireSecurity: boolean; // рекомендовать доп. обеспечение (гарантия/залог)
    notes: string[];
  };
  contributions: RuleContribution[];
  computedAt: string;
}

/** Единый внутренний тип аналитического досье компании. */
export interface CompanyDossier {
  id: string; // стабильный идентификатор, производный от ИНН
  query: string; // исходный запрос пользователя
  generatedAt: string;
  company: CompanyIdentity;
  identity: RegistryFlags; // алиас-секция с доп. регистрационными признаками
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
  events: EventsInfo;
  sources: SourceStatusSummary[];
  riskAssessment: RiskAssessment;
  aiSummary: AiSummary | null;
  /**
   * true, если хотя бы один раздел досье построен на демонстрационных данных
   * (см. sources[].status: "demo" означает демо-раздел, "ok" — реальный).
   * В текущей версии MVP реальный источник подключён только для части
   * установочных данных (ФНС/ЕГРЮЛ через DaData) — это поле поэтому
   * практически всегда true.
   */
  isDemoData: boolean;
}
