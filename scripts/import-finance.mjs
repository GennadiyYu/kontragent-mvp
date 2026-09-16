#!/usr/bin/env node
// npm run import:finance
//
// ETL: официальный открытый датасет ФНС «Сведения о суммах доходов и
// расходов по данным бухгалтерской (финансовой) отчётности» → SQLite
// (data/kontragent.db, таблица finance_revexp) → читается
// src/lib/providers/financeDb.ts → FinanceProvider → CompanyDossier.
//
// ВАЖНО (см. README): этот датасет содержит ТОЛЬКО выручку и расходы —
// официальных бесплатных открытых данных с активами/обязательствами/
// капиталом не существует (полный ГИР БО закрыт анти-бот защитой bo.nalog.ru).
// «Прибыль» в приложении — расчётная (выручка − расходы), это не официальная
// строка формы 2, и помечается как таковая.
//
// Источник: https://www.nalog.gov.ru/opendata/7707329152-revexp/
// Файл:     https://file.nalog.ru/opendata/7707329152-revexp/data-20260825-structure-20180110.zip (~100 МБ)
//
// Скачивание НЕ входит в этот скрипт намеренно: файл нужно скачать вручную
// (см. README, "Импорт открытых данных") и положить в data/raw/revexp.zip —
// это большая ручная загрузка (~100 МБ), которую не стоит повторять при
// каждом запуске импорта.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { listZipEntries, readZipEntry } from "./lib/zip.mjs";
import { extractDocuments, extractTagAttrs, parseRuDate } from "./lib/xmlAttrs.mjs";
import { openDb, recordImportRun } from "./lib/db.mjs";

const SOURCE_URL = "https://www.nalog.gov.ru/opendata/7707329152-revexp/";
const ZIP_PATH = fileURLToPath(new URL("../data/raw/revexp.zip", import.meta.url));
const SAMPLE_LIMIT = process.argv.includes("--sample") ? 50_000 : Infinity;

function main() {
  if (!existsSync(ZIP_PATH)) {
    console.error(`Не найден файл ${ZIP_PATH}.`);
    console.error(`Скачайте его вручную: ${SOURCE_URL}`);
    process.exit(1);
  }

  const db = openDb();
  const upsert = db.prepare(
    `INSERT INTO finance_revexp (inn, report_year, revenue, expense, snapshot_date, imported_at, source_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(inn, report_year) DO UPDATE SET
       revenue = excluded.revenue, expense = excluded.expense,
       snapshot_date = excluded.snapshot_date, imported_at = excluded.imported_at`
  );

  const entries = listZipEntries(ZIP_PATH);
  console.log(`Найдено ${entries.length} XML-файлов в архиве.`);

  const importedAt = new Date().toISOString();
  let rowCount = 0;
  let skipped = 0;

  const runInTransaction = db.exec.bind(db);
  runInTransaction("BEGIN");
  try {
    outer: for (let i = 0; i < entries.length; i++) {
      const buf = readZipEntry(ZIP_PATH, entries[i]);
      const text = buf.toString("utf8");
      const documents = extractDocuments(text);

      for (const doc of documents) {
        const np = extractTagAttrs(doc, "СведНП");
        const dr = extractTagAttrs(doc, "СведДохРасх");
        if (!np?.ИННЮЛ || !dr) {
          skipped++;
          continue;
        }
        // ДатаСост — дата составления отчёта, её год используем как отчётный год.
        const dateMatch = doc.match(/ДатаСост="(\d{2}\.\d{2}\.\d{4})"/);
        const snapshotDate = dateMatch ? parseRuDate(dateMatch[1]) : null;
        const reportYear = snapshotDate ? Number(snapshotDate.slice(0, 4)) : new Date().getFullYear() - 1;

        upsert.run(
          np.ИННЮЛ,
          reportYear,
          dr.СумДоход ? Number(dr.СумДоход) : null,
          dr.СумРасход ? Number(dr.СумРасход) : null,
          snapshotDate,
          importedAt,
          SOURCE_URL
        );
        rowCount++;
        if (rowCount >= SAMPLE_LIMIT) break outer;
      }

      if ((i + 1) % 200 === 0) console.log(`  ...обработано ${i + 1}/${entries.length} файлов, строк: ${rowCount}`);
    }
    runInTransaction("COMMIT");
  } catch (err) {
    runInTransaction("ROLLBACK");
    throw err;
  }

  recordImportRun(db, "finance_revexp", rowCount, SOURCE_URL);
  db.close();
  console.log(`Готово: импортировано ${rowCount} строк (пропущено без данных: ${skipped}).`);
}

main();
