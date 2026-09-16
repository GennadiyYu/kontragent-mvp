import { getDb } from "@/lib/db/sqlite";
import { normalizeCompanyNameTs } from "@/lib/utils/companyStatus";

export interface TaxDebtRow {
  amount: number;
  snapshotDate: string | null;
  sourceUrl: string;
}

/** Реальная налоговая задолженность компании (датасет ФНС debtam). null — компания проверена, задолженности нет. */
export async function getTaxDebt(inn: string): Promise<TaxDebtRow | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const row = db
      .prepare(`SELECT total_amount as amount, snapshot_date as snapshotDate, source_url as sourceUrl FROM fns_tax_debt WHERE inn = ?`)
      .get(inn) as unknown as TaxDebtRow | undefined;
    return row ?? null;
  } catch (err) {
    console.warn("[fnsRiskDb] ошибка чтения fns_tax_debt:", err);
    return null;
  }
}

export interface DisqualifiedMatch {
  fullName: string;
  companyNameRaw: string;
  position: string | null;
  startDate: string | null;
  endDate: string | null;
  sourceUrl: string;
}

/**
 * Ищет запись о дисквалификации ТОЛЬКО по точному совпадению (ФИО директора
 * + нормализованное название ИМЕННО этой проверяемой компании) — намеренно
 * не по одному ФИО, чтобы не приписывать компании чужую дисквалификацию из-за
 * однофамильца. См. scripts/import-fns-risk.mjs.
 */
export async function findDisqualifiedMatch(fullName: string, companyName: string): Promise<DisqualifiedMatch | null> {
  const db = await getDb();
  if (!db) return null;
  const normalizedCompany = normalizeCompanyNameTs(companyName);
  const normalizedFullName = fullName.trim().toUpperCase();
  if (!normalizedCompany || !normalizedFullName) return null;
  try {
    const row = db
      .prepare(
        `SELECT full_name as fullName, company_name_raw as companyNameRaw, position, start_date as startDate, end_date as endDate, source_url as sourceUrl
         FROM fns_disqualified WHERE company_name_normalized = ? AND UPPER(full_name) = ? LIMIT 1`
      )
      .get(normalizedCompany, normalizedFullName) as unknown as DisqualifiedMatch | undefined;
    return row ?? null;
  } catch (err) {
    console.warn("[fnsRiskDb] ошибка чтения fns_disqualified:", err);
    return null;
  }
}

export interface SpecialRegimeRow {
  isEsxn: boolean;
  isUsn: boolean;
  isAusn: boolean;
  isSrp: boolean;
}

/** Применяемые спецрежимы налогообложения (датасет ФНС snr) — информационный признак, в risk-engine не используется. */
export async function getSpecialRegime(inn: string): Promise<SpecialRegimeRow | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const row = db
      .prepare(`SELECT is_esxn as isEsxn, is_usn as isUsn, is_ausn as isAusn, is_srp as isSrp FROM fns_special_regime WHERE inn = ?`)
      .get(inn) as unknown as { isEsxn: number; isUsn: number; isAusn: number; isSrp: number } | undefined;
    if (!row) return null;
    return { isEsxn: !!row.isEsxn, isUsn: !!row.isUsn, isAusn: !!row.isAusn, isSrp: !!row.isSrp };
  } catch (err) {
    console.warn("[fnsRiskDb] ошибка чтения fns_special_regime:", err);
    return null;
  }
}
