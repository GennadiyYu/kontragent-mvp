import { getDb } from "@/lib/db/sqlite";

/**
 * FnsTaxPaidProvider — читает реальную сумму уплаченных налогов и сборов
 * (официальный открытый датасет ФНС «paytax», см. scripts/import-fns-risk.mjs)
 * из локальной БД.
 *
 * СЕМАНТИКА ОТСУТСТВИЯ ЗАПИСИ: датасет публикует суммы, фактически уплаченные
 * компанией в бюджет за период по каждому виду налога/сбора. Отсутствие
 * записи означает ТОЛЬКО «в проверенном наборе ФНС по этому ИНН нет данных
 * об уплаченных суммах за опубликованный период» — это НЕ означает, что
 * компания не платит налоги (могла не попасть в выгрузку, быть слишком
 * молодой, работать на режиме без учитываемых здесь платежей и т.д.).
 *
 * НАЗНАЧЕНИЕ: показатель МАСШТАБА деятельности компании, а не индикатор
 * риска — большая или маленькая сумма сама по себе не должна автоматически
 * трактоваться как хороший или плохой признак (см. risk-engine/rules.ts —
 * используется только как знаменатель в правиле tax.arrears_ratio, не как
 * самостоятельное правило).
 */
export interface TaxPaidRecord {
  amount: number;
  periodYear: number | null;
  snapshotDate: string | null;
  sourceUrl: string;
}

/** null — компания проверена в датасете paytax, записи нет (см. семантику выше). */
export async function getTaxPaid(inn: string): Promise<TaxPaidRecord | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const row = db
      .prepare(
        `SELECT total_amount as amount, period_year as periodYear, snapshot_date as snapshotDate, source_url as sourceUrl
         FROM fns_tax_paid WHERE inn = ?`
      )
      .get(inn) as unknown as TaxPaidRecord | undefined;
    return row ?? null;
  } catch (err) {
    console.warn("[fnsTaxPaid] ошибка чтения fns_tax_paid:", err);
    return null;
  }
}
