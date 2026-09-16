import { jsPDF } from "jspdf";
import type { CompanyDossier } from "@/types/dossier";
import { RISK_CATEGORY_LABEL, RISK_LEVEL_LABEL, type RiskLevel } from "@/types/common";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils/format";
import { recommendationForRiskLevel } from "@/lib/risk-engine";
import { PT_SANS_REGULAR_BASE64 } from "./fonts/pt-sans-regular";
import { PT_SANS_BOLD_BASE64 } from "./fonts/pt-sans-bold";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  brand: [15, 23, 42] as const, // slate-900 — шапка отчёта
  brandAccent: [37, 99, 235] as const, // blue-600
  text: [30, 41, 59] as const, // slate-800
  muted: [100, 116, 139] as const, // slate-500
  line: [226, 232, 240] as const, // slate-200
  panel: [248, 250, 252] as const, // slate-50
};

const RISK_COLOR: Record<RiskLevel, readonly [number, number, number]> = {
  low: [22, 163, 74],
  moderate: [217, 119, 6],
  high: [234, 88, 12],
  critical: [220, 38, 38],
};

/** Тонкая обёртка над jsPDF с курсором Y, переносом страниц и кириллическим шрифтом PT Sans. */
class PdfWriter {
  doc: jsPDF;
  y = MARGIN;
  private pageNumber = 1;
  private companyLabel: string;

  constructor(companyLabel: string) {
    this.doc = new jsPDF({ unit: "mm", format: "a4" });
    this.companyLabel = companyLabel;
    this.doc.addFileToVFS("PTSans-Regular.ttf", PT_SANS_REGULAR_BASE64);
    this.doc.addFont("PTSans-Regular.ttf", "PTSans", "normal");
    this.doc.addFileToVFS("PTSans-Bold.ttf", PT_SANS_BOLD_BASE64);
    this.doc.addFont("PTSans-Bold.ttf", "PTSans", "bold");
    this.doc.setFont("PTSans", "normal");
  }

  private drawFooter() {
    const d = this.doc;
    d.setDrawColor(...COLORS.line);
    d.line(MARGIN, PAGE_HEIGHT - 14, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 14);
    d.setFont("PTSans", "normal");
    d.setFontSize(8);
    d.setTextColor(...COLORS.muted);
    d.text(`«Контрагент» — аналитическое досье · ${this.companyLabel}`, MARGIN, PAGE_HEIGHT - 9);
    d.text(`Стр. ${this.pageNumber}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 9, { align: "right" });
  }

  newPage() {
    this.drawFooter();
    this.doc.addPage();
    this.pageNumber++;
    this.y = MARGIN;
  }

  ensureSpace(height: number) {
    if (this.y + height > PAGE_HEIGHT - 20) this.newPage();
  }

  sectionHeading(number: number, title: string) {
    this.ensureSpace(14);
    const d = this.doc;
    d.setFillColor(...COLORS.brand);
    d.rect(MARGIN, this.y, CONTENT_WIDTH, 9, "F");
    d.setFont("PTSans", "bold");
    d.setFontSize(11);
    d.setTextColor(255, 255, 255);
    d.text(`${number}. ${title}`, MARGIN + 3, this.y + 6.3);
    this.y += 9 + 5;
    d.setTextColor(...COLORS.text);
  }

  subheading(text: string) {
    this.ensureSpace(9);
    const d = this.doc;
    d.setFont("PTSans", "bold");
    d.setFontSize(10.5);
    d.setTextColor(...COLORS.brandAccent);
    d.text(text, MARGIN, this.y);
    this.y += 6;
    d.setTextColor(...COLORS.text);
  }

  paragraph(text: string, opts: { size?: number; color?: readonly [number, number, number]; bold?: boolean } = {}) {
    const d = this.doc;
    d.setFont("PTSans", opts.bold ? "bold" : "normal");
    d.setFontSize(opts.size ?? 10);
    d.setTextColor(...(opts.color ?? COLORS.text));
    const lines: string[] = d.splitTextToSize(text, CONTENT_WIDTH);
    for (const line of lines) {
      this.ensureSpace(6);
      d.text(line, MARGIN, this.y);
      this.y += 5.2;
    }
    this.y += 1.5;
  }

  bulletList(items: string[], opts: { color?: readonly [number, number, number] } = {}) {
    const d = this.doc;
    d.setFont("PTSans", "normal");
    d.setFontSize(9.5);
    d.setTextColor(...(opts.color ?? COLORS.text));
    for (const item of items) {
      const lines: string[] = d.splitTextToSize(item, CONTENT_WIDTH - 5);
      this.ensureSpace(lines.length * 5 + 1);
      d.text("–", MARGIN, this.y);
      d.text(lines, MARGIN + 4, this.y);
      this.y += lines.length * 5 + 1;
    }
    this.y += 2;
  }

  keyValueGrid(rows: Array<[string, string]>) {
    const d = this.doc;
    const colWidth = CONTENT_WIDTH / 2 - 3;
    for (let i = 0; i < rows.length; i += 2) {
      const rowItems = [rows[i], rows[i + 1]].filter(Boolean) as Array<[string, string]>;
      const heights = rowItems.map(([, v]) => d.splitTextToSize(v, colWidth - 30).length);
      const rowHeight = Math.max(...heights, 1) * 4.6 + 3;
      this.ensureSpace(rowHeight);
      rowItems.forEach(([label, value], idx) => {
        const x = MARGIN + idx * (colWidth + 6);
        d.setFont("PTSans", "normal");
        d.setFontSize(8.3);
        d.setTextColor(...COLORS.muted);
        d.text(label, x, this.y);
        d.setFont("PTSans", "bold");
        d.setFontSize(9.5);
        d.setTextColor(...COLORS.text);
        const lines: string[] = d.splitTextToSize(value, colWidth);
        d.text(lines, x, this.y + 4.4);
      });
      this.y += rowHeight;
    }
    this.y += 2;
  }

  divider() {
    this.ensureSpace(4);
    this.doc.setDrawColor(...COLORS.line);
    this.doc.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y);
    this.y += 5;
  }

  finish(): Buffer {
    this.drawFooter();
    const arrayBuffer = this.doc.output("arraybuffer") as ArrayBuffer;
    return Buffer.from(arrayBuffer);
  }
}

function riskBadgeBlock(w: PdfWriter, score: number, level: RiskLevel) {
  const d = w.doc;
  const color = RISK_COLOR[level];
  const boxW = 56;
  const boxH = 26;
  const x = PAGE_WIDTH - MARGIN - boxW;
  const y = w.y;
  d.setFillColor(...color);
  d.roundedRect(x, y, boxW, boxH, 2, 2, "F");
  d.setFont("PTSans", "bold");
  d.setFontSize(20);
  d.setTextColor(255, 255, 255);
  d.text(String(score), x + boxW / 2, y + 13, { align: "center" });
  d.setFont("PTSans", "normal");
  d.setFontSize(8.5);
  d.text(`из 100 · ${RISK_LEVEL_LABEL[level]}`, x + boxW / 2, y + 20, { align: "center" });
}

/**
 * Формирует PDF-досье в стиле отчёта службы безопасности. Использует шрифт
 * PT Sans (поддерживает кириллицу), встроенный в проект как base64 —
 * стандартные шрифты jsPDF кириллицу не поддерживают. Работает полностью
 * на сервере (Node), не требует браузера/Puppeteer.
 */
export function generateDossierPdf(dossier: CompanyDossier): Buffer {
  const w = new PdfWriter(dossier.company.shortName);
  const d = w.doc;

  // --- Титульная часть ---
  d.setFillColor(...COLORS.brand);
  d.rect(0, 0, PAGE_WIDTH, 34, "F");
  d.setFont("PTSans", "bold");
  d.setFontSize(18);
  d.setTextColor(255, 255, 255);
  d.text("АНАЛИТИЧЕСКОЕ ДОСЬЕ", MARGIN, 15);
  d.setFont("PTSans", "normal");
  d.setFontSize(9.5);
  d.text('Сервис проверки контрагентов «Контрагент»', MARGIN, 22);
  d.setFontSize(8.5);
  d.setTextColor(203, 213, 225);
  d.text(`Демонстрационные данные · сформировано ${formatDateTime(dossier.generatedAt)}`, MARGIN, 28);
  w.y = 42;

  w.paragraph(`ОБЪЕКТ: ${dossier.company.fullName}`, { bold: true, size: 12.5 });
  w.paragraph(`ИНН ${dossier.company.inn} · ОГРН ${dossier.company.ogrn} · Дата отчёта: ${formatDate(dossier.generatedAt)}`, {
    size: 9.5,
    color: COLORS.muted,
  });

  w.ensureSpace(30);
  const scoreY = w.y;
  d.setFont("PTSans", "bold");
  d.setFontSize(10);
  d.setTextColor(...COLORS.text);
  d.text("ОБЩИЙ РИСК", MARGIN, scoreY + 15);
  riskBadgeBlock(w, dossier.riskAssessment.totalScore, dossier.riskAssessment.level);
  w.y = scoreY + 30;
  w.divider();

  // --- 1. Главное резюме ---
  w.sectionHeading(1, "ГЛАВНОЕ РЕЗЮМЕ И АНАЛИТИЧЕСКАЯ ОЦЕНКА");
  if (dossier.aiSummary) {
    w.paragraph(dossier.aiSummary.summaryText);
    w.subheading("Ключевые положительные факторы");
    w.bulletList(dossier.aiSummary.keyPositives.length ? dossier.aiSummary.keyPositives : ["Не выявлены"]);
    w.subheading("Факторы риска");
    w.bulletList(dossier.aiSummary.keyRisks.length ? dossier.aiSummary.keyRisks : ["Не выявлены"]);
    w.subheading("Рекомендация по сотрудничеству");
    w.paragraph(dossier.aiSummary.recommendation, { bold: true });
    w.paragraph(dossier.aiSummary.disclaimer, { size: 7.8, color: COLORS.muted });
    w.paragraph(
      dossier.aiSummary.generatedBy === "gemini" ? "Резюме сформировано ИИ (Google Gemini) на основе фактов и расчёта Risk Engine." : "Резюме сформировано по шаблону без использования ИИ (Risk Engine — обычный код).",
      { size: 7.8, color: COLORS.muted }
    );
  } else {
    w.paragraph(recommendationForRiskLevel(dossier.riskAssessment.level), { bold: true });
  }

  // --- 2. Установочные данные ---
  w.sectionHeading(2, "УСТАНОВОЧНЫЕ ДАННЫЕ");
  w.keyValueGrid([
    ["Полное наименование", dossier.company.fullName],
    ["Статус", dossier.company.statusLabel],
    ["ИНН", dossier.company.inn],
    ["ОГРН", dossier.company.ogrn],
    ["КПП", dossier.company.kpp ?? "—"],
    ["Дата регистрации", formatDate(dossier.company.registrationDate)],
    ["Основной ОКВЭД", `${dossier.company.okvedCode} — ${dossier.company.okvedName}`],
    ["Уставный капитал", dossier.company.authorizedCapital ? formatMoney(dossier.company.authorizedCapital) : "—"],
    ["Юридический адрес", dossier.company.legalAddress],
    ["Адрес массовой регистрации", dossier.identity.addressIsMassRegistration ? "Да" : "Нет"],
    ["Отметка о недостоверности сведений", dossier.identity.hasUnreliableDataMark ? "Есть" : "Нет"],
  ]);

  // --- 3. Руководство и собственники ---
  w.sectionHeading(3, "РУКОВОДСТВО И СОБСТВЕННИКИ");
  w.subheading("Руководитель");
  w.paragraph(
    `${dossier.management.director.fullName} — ${dossier.management.director.position}` +
      (dossier.management.director.isMassDirector ? " (массовый руководитель)" : "") +
      (dossier.management.director.isDisqualified ? " (ДИСКВАЛИФИЦИРОВАН)" : "")
  );
  w.subheading("Учредители");
  w.bulletList(
    dossier.owners.founders.map(
      (f) => `${f.name} — доля ${f.sharePercent}%${f.inn ? `, ИНН ${f.inn}` : ""}`
    )
  );

  // --- 4. Финансовое состояние ---
  w.sectionHeading(4, "ФИНАНСОВОЕ СОСТОЯНИЕ");
  if (dossier.finance.years.length === 0) {
    w.paragraph("Данные бухгалтерской отчётности не найдены.");
  } else {
    w.bulletList(
      dossier.finance.years.map(
        (y) =>
          `${y.year} год: выручка ${formatMoney(y.revenue)}, чистая прибыль/убыток ${formatMoney(y.netProfit)}, капитал ${formatMoney(y.capital)}, кредиторская задолженность ${formatMoney(y.accountsPayable)}`
      )
    );
  }

  // --- 5. Арбитраж ---
  w.sectionHeading(5, "АРБИТРАЖ");
  w.paragraph(
    `Дел в роли ответчика: ${dossier.arbitration.totalCasesAsDefendant} (на сумму ${formatMoney(dossier.arbitration.totalClaimAmountAsDefendant)}). Дел в роли истца: ${dossier.arbitration.totalCasesAsPlaintiff}.`
  );
  if (dossier.arbitration.cases.length > 0) {
    w.bulletList(
      dossier.arbitration.cases
        .slice(0, 8)
        .map((c) => `№ ${c.caseNumber} от ${formatDate(c.date)} — ${c.roleLabel}, ${c.subject}, ${formatMoney(c.claimAmount)}, статус: ${c.statusLabel}`)
    );
  }

  // --- 6. Исполнительные производства ---
  w.sectionHeading(6, "ИСПОЛНИТЕЛЬНЫЕ ПРОИЗВОДСТВА");
  w.paragraph(`Действующих производств: ${dossier.enforcement.activeCount} на сумму ${formatMoney(dossier.enforcement.activeAmount)}.`);
  if (dossier.enforcement.proceedings.length > 0) {
    w.bulletList(
      dossier.enforcement.proceedings.slice(0, 8).map((p) => `№ ${p.number} от ${formatDate(p.date)} — ${p.subject}, ${formatMoney(p.amount)}, статус: ${p.statusLabel}`)
    );
  }

  // --- 7. Банкротные факторы ---
  w.sectionHeading(7, "БАНКРОТНЫЕ ФАКТОРЫ");
  w.paragraph(dossier.bankruptcy.hasActiveCase ? `Открыта процедура банкротства: ${dossier.bankruptcy.stageLabel ?? ""}.` : "Активная процедура банкротства не выявлена.");
  if (dossier.bankruptcy.publications.length > 0) {
    w.bulletList(dossier.bankruptcy.publications.map((p) => `${formatDate(p.date)} — ${p.type}: ${p.description}`));
  }

  // --- 8. Госзакупки ---
  w.sectionHeading(8, "ГОСЗАКУПКИ");
  w.paragraph(
    `Контрактов в роли поставщика: ${dossier.procurement.asSupplierContractsCount} на сумму ${formatMoney(dossier.procurement.asSupplierTotalAmount)}. В реестре недобросовестных поставщиков (РНП): ${dossier.procurement.isInUnreliableSuppliersRegistry ? "ДА" : "нет"}.`
  );

  // --- 9. Связанные организации ---
  w.sectionHeading(9, "СВЯЗАННЫЕ ОРГАНИЗАЦИИ");
  if (dossier.relatedCompanies.items.length === 0) {
    w.paragraph("Связанные организации не выявлены.");
  } else {
    w.bulletList(dossier.relatedCompanies.items.map((c) => `${c.name} (ИНН ${c.inn}) — ${c.relationType}, статус: ${c.statusLabel}`));
  }

  // --- 10. Репутационный фон ---
  w.sectionHeading(10, "РЕПУТАЦИОННЫЙ ФОН");
  w.paragraph(`Негативных упоминаний в открытых источниках: ${dossier.reputation.negativeMentionsCount}.`);
  if (dossier.reputation.mentions.length > 0) {
    w.bulletList(dossier.reputation.mentions.slice(0, 8).map((m) => `${formatDate(m.date)} — ${m.title}`));
  }

  // --- 11. Сводная матрица рисков ---
  w.sectionHeading(11, "СВОДНАЯ МАТРИЦА РИСКОВ");
  for (const cat of dossier.riskAssessment.categories) {
    w.ensureSpace(10);
    const color = RISK_COLOR[cat.level];
    d.setFillColor(...color);
    d.circle(MARGIN + 1.5, w.y - 1.5, 1.5, "F");
    d.setFont("PTSans", "bold");
    d.setFontSize(9.5);
    d.setTextColor(...COLORS.text);
    d.text(`${RISK_CATEGORY_LABEL[cat.category]} — ${cat.score}/100 (${RISK_LEVEL_LABEL[cat.level]})`, MARGIN + 5, w.y);
    w.y += 5;
    w.bulletList(cat.facts);
    w.paragraph(`Возможные последствия: ${cat.consequences.join(" ")}`, { size: 8.5, color: COLORS.muted });
  }

  // --- 12. Рекомендации по сделке ---
  w.sectionHeading(12, "РЕКОМЕНДАЦИИ ПО СДЕЛКЕ");
  w.paragraph(recommendationForRiskLevel(dossier.riskAssessment.level), { bold: true });
  w.paragraph("Для оценки условий конкретной сделки (сумма, предоплата, отсрочка) используйте блок «Оценить конкретную сделку» на странице компании в сервисе.", {
    size: 8.5,
    color: COLORS.muted,
  });

  // --- 13. Источники ---
  w.sectionHeading(13, "ИСТОЧНИКИ");
  w.bulletList(
    dossier.sources.map((s) => `${s.label} — статус: ${s.note} (получено: ${formatDateTime(s.retrievedAt)})`)
  );
  w.paragraph(
    "Все данные в этом отчёте являются ДЕМОНСТРАЦИОННЫМИ и сгенерированы автоматически для целей MVP. Отчёт не является официальной справкой и не может использоваться как юридически значимый документ.",
    { size: 8, color: COLORS.muted, bold: true }
  );

  return w.finish();
}
