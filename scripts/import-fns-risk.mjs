#!/usr/bin/env node
// npm run import:fns-risk
//
// ETL: четыре официальных открытых датасета ФНС → SQLite (data/kontragent.db):
//  1. Налоговая задолженность (debtam) → таблица fns_tax_debt → используется
//     RegistryFlags.taxDebtAmount → risk-engine правило tax.arrears.
//  2. Реестр дисквалифицированных лиц (registerdisqualified) → таблица
//     fns_disqualified → сопоставляется с текущим директором компании по
//     (ФИО + название компании) — см. providers/fns.ts. Специально НЕ по
//     одному ФИО, чтобы не давать ложных срабатываний на тёзок.
//  3. Уплаченные налоги и сборы (paytax) → таблица fns_tax_paid → показатель
//     МАСШТАБА деятельности (providers/fnsTaxPaid.ts), НЕ индикатор риска
//     сам по себе — см. providers/fnsTaxPaid.ts.
//  4. Среднесписочная численность (sshr) → таблица fns_employees →
//     информационный показатель (providers/fnsEmployees.ts), малое значение
//     НЕ считается негативным признаком.
//
// Источники:
//  https://www.nalog.gov.ru/opendata/7707329152-debtam/
//  https://www.nalog.gov.ru/opendata/7707329152-registerdisqualified/
//  https://www.nalog.gov.ru/opendata/7707329152-paytax/
//  https://www.nalog.gov.ru/opendata/7707329152-sshr2019/
//
// Файлы нужно скачать вручную в data/raw/ (см. README) — сами загрузки
// сюда намеренно не встроены.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { listZipEntries, readZipEntry } from "./lib/zip.mjs";
import { extractDocuments, extractTagAttrs, extractAllTagAttrs, parseRuDate } from "./lib/xmlAttrs.mjs";
import { openDb, recordImportRun, normalizeCompanyName } from "./lib/db.mjs";

const DEBTAM_SOURCE_URL = "https://www.nalog.gov.ru/opendata/7707329152-debtam/";
const DEBTAM_ZIP = fileURLToPath(new URL("../data/raw/debtam.zip", import.meta.url));

const DISQ_SOURCE_URL = "https://www.nalog.gov.ru/opendata/7707329152-registerdisqualified/";
const DISQ_CSV = fileURLToPath(new URL("../data/raw/registerdisqualified.csv", import.meta.url));

const PAYTAX_SOURCE_URL = "https://www.nalog.gov.ru/opendata/7707329152-paytax/";
const PAYTAX_ZIP = fileURLToPath(new URL("../data/raw/paytax.zip", import.meta.url));

const SSHR_SOURCE_URL = "https://www.nalog.gov.ru/opendata/7707329152-sshr2019/";
const SSHR_ZIP = fileURLToPath(new URL("../data/raw/sshr.zip", import.meta.url));

function importDebtam(db) {
  if (!existsSync(DEBTAM_ZIP)) {
    console.log(`[debtam] файл не найден (${DEBTAM_ZIP}) — пропуск. Скачайте: ${DEBTAM_SOURCE_URL}`);
    return;
  }
  const upsert = db.prepare(
    `INSERT INTO fns_tax_debt (inn, total_amount, snapshot_date, imported_at, source_url) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(inn) DO UPDATE SET total_amount = excluded.total_amount, snapshot_date = excluded.snapshot_date, imported_at = excluded.imported_at`
  );
  const entries = listZipEntries(DEBTAM_ZIP);
  const importedAt = new Date().toISOString();
  let rowCount = 0;
  db.exec("BEGIN");
  try {
    for (const entry of entries) {
      const text = readZipEntry(DEBTAM_ZIP, entry).toString("utf8");
      for (const doc of extractDocuments(text)) {
        const np = extractTagAttrs(doc, "СведНП");
        if (!np?.ИННЮЛ) continue;
        const debts = extractAllTagAttrs(doc, "СведНедоим");
        const total = debts.reduce((sum, d) => sum + (Number(d.ОбщСумНедоим) || 0), 0);
        if (total <= 0) continue; // не засоряем таблицу нулевыми записями
        const dateMatch = doc.match(/ДатаСост="(\d{2}\.\d{2}\.\d{4})"/);
        const snapshotDate = dateMatch ? parseRuDate(dateMatch[1]) : null;
        upsert.run(np.ИННЮЛ, total, snapshotDate, importedAt, DEBTAM_SOURCE_URL);
        rowCount++;
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  recordImportRun(db, "fns_tax_debt", rowCount, DEBTAM_SOURCE_URL);
  console.log(`[debtam] импортировано ${rowCount} компаний с задолженностью.`);
}

// CSV-парсер под конкретный формат этого датасета (кавычки вокруг каждого поля, запятая-разделитель,
// без переносов строк внутри полей — упрощает разбор без библиотеки).
function parseCsvLine(line) {
  return line
    .split(",")
    .map((cell) => cell.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
}

function importDisqualified(db) {
  if (!existsSync(DISQ_CSV)) {
    console.log(`[registerdisqualified] файл не найден (${DISQ_CSV}) — пропуск. Скачайте: ${DISQ_SOURCE_URL}`);
    return;
  }
  db.exec("DELETE FROM fns_disqualified"); // маленький датасет (~10 тыс. строк) — проще перезалить целиком
  const insert = db.prepare(
    `INSERT INTO fns_disqualified (full_name, birth_date, company_name_raw, company_name_normalized, position, start_date, end_date, imported_at, source_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const lines = readFileSync(DISQ_CSV, "utf8").split(/\r?\n/).filter(Boolean);
  const importedAt = new Date().toISOString();
  let rowCount = 0;
  db.exec("BEGIN");
  try {
    // Первая строка — заголовок вида G1,G2,...
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      // G1 id, G2 ФИО, G3 дата рождения, G4 город, G5 организация, G7 должность, G12 срок, G13 начало, G14 конец
      const [, fullName, birthDate, , companyRaw, , position, , , , , , startDate, endDate] = cols;
      if (!fullName || !companyRaw) continue;
      insert.run(
        fullName,
        parseRuDate(birthDate) ?? birthDate ?? null,
        companyRaw,
        normalizeCompanyName(companyRaw),
        position ?? null,
        parseRuDate(startDate) ?? startDate ?? null,
        parseRuDate(endDate) ?? endDate ?? null,
        importedAt,
        DISQ_SOURCE_URL
      );
      rowCount++;
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  recordImportRun(db, "fns_disqualified", rowCount, DISQ_SOURCE_URL);
  console.log(`[registerdisqualified] импортировано ${rowCount} записей.`);
}

function importPaytax(db) {
  if (!existsSync(PAYTAX_ZIP)) {
    console.log(`[paytax] файл не найден (${PAYTAX_ZIP}) — пропуск. Скачайте: ${PAYTAX_SOURCE_URL}`);
    return;
  }
  const upsert = db.prepare(
    `INSERT INTO fns_tax_paid (inn, total_amount, period_year, snapshot_date, imported_at, source_url) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(inn) DO UPDATE SET total_amount = excluded.total_amount, period_year = excluded.period_year, snapshot_date = excluded.snapshot_date, imported_at = excluded.imported_at`
  );
  const entries = listZipEntries(PAYTAX_ZIP);
  const importedAt = new Date().toISOString();
  let rowCount = 0;
  db.exec("BEGIN");
  try {
    for (const entry of entries) {
      const text = readZipEntry(PAYTAX_ZIP, entry).toString("utf8");
      for (const doc of extractDocuments(text)) {
        const np = extractTagAttrs(doc, "СведНП");
        if (!np?.ИННЮЛ) continue;
        const payments = extractAllTagAttrs(doc, "СвУплСумНал");
        const total = payments.reduce((sum, p) => sum + (Number(p.СумУплНал) || 0), 0);
        if (total <= 0) continue;
        const dateMatch = doc.match(/ДатаСост="(\d{2}\.\d{2}\.\d{4})"/);
        const snapshotDate = dateMatch ? parseRuDate(dateMatch[1]) : null;
        const periodYear = snapshotDate ? Number(snapshotDate.slice(0, 4)) : null;
        upsert.run(np.ИННЮЛ, total, periodYear, snapshotDate, importedAt, PAYTAX_SOURCE_URL);
        rowCount++;
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  recordImportRun(db, "fns_tax_paid", rowCount, PAYTAX_SOURCE_URL);
  console.log(`[paytax] импортировано ${rowCount} компаний.`);
}

function importEmployees(db) {
  if (!existsSync(SSHR_ZIP)) {
    console.log(`[sshr] файл не найден (${SSHR_ZIP}) — пропуск. Скачайте: ${SSHR_SOURCE_URL}`);
    return;
  }
  const upsert = db.prepare(
    `INSERT INTO fns_employees (inn, employees_count, period_year, snapshot_date, imported_at, source_url) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(inn) DO UPDATE SET employees_count = excluded.employees_count, period_year = excluded.period_year, snapshot_date = excluded.snapshot_date, imported_at = excluded.imported_at`
  );
  const entries = listZipEntries(SSHR_ZIP);
  const importedAt = new Date().toISOString();
  let rowCount = 0;
  db.exec("BEGIN");
  try {
    for (const entry of entries) {
      const text = readZipEntry(SSHR_ZIP, entry).toString("utf8");
      for (const doc of extractDocuments(text)) {
        const np = extractTagAttrs(doc, "СведНП");
        const sshr = extractTagAttrs(doc, "СведССЧР");
        if (!np?.ИННЮЛ || !sshr || sshr.КолРаб === undefined) continue;
        const dateMatch = doc.match(/ДатаСост="(\d{2}\.\d{2}\.\d{4})"/);
        const snapshotDate = dateMatch ? parseRuDate(dateMatch[1]) : null;
        const periodYear = snapshotDate ? Number(snapshotDate.slice(0, 4)) : null;
        upsert.run(np.ИННЮЛ, Number(sshr.КолРаб), periodYear, snapshotDate, importedAt, SSHR_SOURCE_URL);
        rowCount++;
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  recordImportRun(db, "fns_employees", rowCount, SSHR_SOURCE_URL);
  console.log(`[sshr] импортировано ${rowCount} компаний.`);
}

function main() {
  const db = openDb();
  importDebtam(db);
  importDisqualified(db);
  importPaytax(db);
  importEmployees(db);
  db.close();
}

main();
