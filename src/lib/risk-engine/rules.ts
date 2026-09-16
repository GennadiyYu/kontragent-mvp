import { formatMoney } from "@/lib/utils/format";
import { yearsSince } from "@/lib/utils/format";
import type { RuleContribution } from "@/types/dossier";
import type { RiskRule } from "./types";

/**
 * Правила скоринга контрагента. Каждое правило — чистая функция от фактов
 * досье к списку вкладов в итоговую оценку (RuleContribution). Правила
 * НИКОГДА не вызывают ИИ и не зависят от него — весь расчёт детерминирован
 * и воспроизводим, что и позволяет объяснить пользователю «почему получился
 * именно такой балл» (см. RiskAssessment.contributions).
 *
 * Знак points: положительные значения повышают риск, отрицательные —
 * снижают (позитивный фактор). Величины подобраны так, чтобы после
 * взвешивания категорий (см. index.ts) итоговая шкала укладывалась в 0–100
 * согласно градации ТЗ: 0–30 низкий / 31–60 умеренный / 61–80 высокий /
 * 81–100 критический.
 */
export const RISK_RULES: RiskRule[] = [
  // ---------------------------------------------------------------- CORPORATE
  {
    id: "corporate.company_age",
    category: "corporate",
    evaluate: (input) => {
      const age = yearsSince(input.company.registrationDate);
      if (age < 1) {
        return [{ ruleId: "corporate.company_age", category: "corporate", points: 10, description: "Компания зарегистрирована менее года назад — отсутствует история деятельности" }];
      }
      if (age < 2) {
        return [{ ruleId: "corporate.company_age", category: "corporate", points: 5, description: "Компания зарегистрирована менее двух лет назад" }];
      }
      if (age >= 10) {
        return [{ ruleId: "corporate.company_age", category: "corporate", points: -8, description: `Компания работает на рынке ${age} лет — длительная деловая история` }];
      }
      return [];
    },
  },
  {
    id: "corporate.unreliable_data_mark",
    category: "corporate",
    evaluate: (input) =>
      input.identity.hasUnreliableDataMark
        ? [{ ruleId: "corporate.unreliable_data_mark", category: "corporate", points: 20, description: "В ЕГРЮЛ внесена запись о недостоверности сведений о компании" }]
        : [],
  },
  {
    id: "corporate.mass_address",
    category: "corporate",
    evaluate: (input) =>
      input.identity.addressIsMassRegistration
        ? [{ ruleId: "corporate.mass_address", category: "corporate", points: 8, description: "Юридический адрес относится к адресам массовой регистрации" }]
        : [],
  },
  {
    id: "corporate.mass_or_disqualified_director",
    category: "corporate",
    evaluate: (input) => {
      const out: RuleContribution[] = [];
      if (input.management.director.isDisqualified) {
        out.push({ ruleId: "corporate.disqualified_director", category: "corporate" as const, points: 25, description: "Руководитель компании дисквалифицирован" });
      } else if (input.management.director.isMassDirector) {
        out.push({ ruleId: "corporate.mass_director", category: "corporate" as const, points: 12, description: "Руководитель числится директором в большом числе организаций («массовый руководитель»)" });
      }
      return out;
    },
  },
  {
    id: "corporate.minimal_capital",
    category: "corporate",
    evaluate: (input) =>
      typeof input.company.authorizedCapital === "number" && input.company.authorizedCapital <= 10_000
        ? [{ ruleId: "corporate.minimal_capital", category: "corporate", points: 4, description: "Уставный капитал находится на минимально допустимом уровне" }]
        : [],
  },
  {
    id: "corporate.related_companies_trouble",
    category: "corporate",
    evaluate: (input) => {
      const troubled = input.relatedCompanies.items.filter((c) => c.status === "liquidated" || c.status === "bankrupt");
      if (troubled.length === 0) return [];
      const points = Math.min(20, troubled.length * 7);
      return [{
        ruleId: "corporate.related_companies_trouble",
        category: "corporate",
        points,
        description: `Среди связанных организаций (${troubled.length}) есть ликвидированные или проходящие процедуру банкротства`,
      }];
    },
  },
  {
    id: "corporate.license_problem",
    category: "corporate",
    evaluate: (input) => {
      const problem = input.licenses.items.some((l) => l.status === "revoked" || l.status === "suspended");
      if (problem) {
        return [{ ruleId: "corporate.license_problem", category: "corporate", points: 22, description: "Лицензия, необходимая для основного вида деятельности, приостановлена или отозвана" }];
      }
      return [];
    },
  },
  {
    id: "corporate.cbr_warning_list",
    category: "corporate",
    evaluate: (input) => {
      if (!input.licenses.warningListEntry) return [];
      return [{
        ruleId: "corporate.cbr_warning_list",
        category: "corporate",
        points: 30,
        description: `Банк России включил компанию в предупредительный список с признаками нелегальной деятельности на финансовом рынке: «${input.licenses.warningListEntry.sign}»`,
      }];
    },
  },

  // ---------------------------------------------------------------- FINANCIAL
  {
    id: "financial.trend",
    category: "financial",
    evaluate: (input) => {
      if (input.finance.years.length === 0) return [];
      if (input.finance.trend === "decline") {
        return [{ ruleId: "financial.trend_decline", category: "financial", points: 26, description: "Устойчивое снижение выручки на протяжении нескольких отчётных периодов" }];
      }
      if (input.finance.trend === "growth") {
        return [{ ruleId: "financial.trend_growth", category: "financial", points: -12, description: "Устойчивый рост выручки на протяжении нескольких отчётных периодов" }];
      }
      return [];
    },
  },
  {
    id: "financial.profit_loss",
    category: "financial",
    evaluate: (input) => {
      const last = input.finance.years[0];
      if (!last) return [];
      if (last.netProfit < 0) {
        return [{ ruleId: "financial.net_loss", category: "financial", points: 24, description: `Чистый убыток по итогам ${last.year} года (${formatMoney(last.netProfit)})` }];
      }
      if (last.revenue > 0 && last.netProfit / last.revenue > 0.08) {
        return [{ ruleId: "financial.healthy_margin", category: "financial", points: -8, description: `Устойчивая положительная рентабельность по итогам ${last.year} года` }];
      }
      return [];
    },
  },
  {
    id: "financial.negative_equity",
    category: "financial",
    evaluate: (input) => {
      const last = input.finance.years[0];
      if (!last) return [];
      if (last.capital < 0) {
        return [{ ruleId: "financial.negative_equity", category: "financial", points: 34, description: `Отрицательные чистые активы (капитал и резервы) по итогам ${last.year} года` }];
      }
      return [];
    },
  },
  {
    id: "financial.debt_load",
    category: "financial",
    evaluate: (input) => {
      const last = input.finance.years[0];
      if (!last || last.revenue <= 0) return [];
      const ratio = last.accountsPayable / last.revenue;
      if (ratio > 0.5) {
        return [{ ruleId: "financial.high_debt_load", category: "financial", points: 22, description: `Кредиторская задолженность превышает 50% годовой выручки (${formatMoney(last.accountsPayable)})` }];
      }
      return [];
    },
  },

  // ---------------------------------------------------------------- JUDICIAL
  {
    id: "judicial.defendant_case_count",
    category: "judicial",
    evaluate: (input) => {
      const n = input.arbitration.totalCasesAsDefendant;
      if (n === 0) return [];
      let points = 0;
      if (n <= 2) points = 18;
      else if (n <= 5) points = 38;
      else if (n <= 10) points = 58;
      else points = 78;
      return [{
        ruleId: "judicial.defendant_case_count",
        category: "judicial",
        points,
        description: `Компания выступает ответчиком в ${n} арбитражных делах`,
      }];
    },
  },
  {
    id: "judicial.claim_amount_ratio",
    category: "judicial",
    evaluate: (input) => {
      const last = input.finance.years[0];
      if (!last || last.revenue <= 0) return [];
      const ratio = input.arbitration.totalClaimAmountAsDefendant / last.revenue;
      if (ratio > 0.3) {
        return [{
          ruleId: "judicial.claim_amount_ratio",
          category: "judicial",
          points: 25,
          description: `Совокупная сумма исковых требований к компании (${formatMoney(input.arbitration.totalClaimAmountAsDefendant)}) превышает 30% годовой выручки`,
        }];
      }
      return [];
    },
  },
  {
    id: "judicial.pending_cases",
    category: "judicial",
    evaluate: (input) => {
      const pending = input.arbitration.cases.filter((c) => c.role === "defendant" && c.status === "pending").length;
      if (pending === 0) return [];
      return [{ ruleId: "judicial.pending_cases", category: "judicial", points: 10, description: `${pending} судебных спора(ов) с участием компании в статусе «ответчик» ещё не рассмотрены` }];
    },
  },

  // -------------------------------------------------------------- ENFORCEMENT
  {
    id: "enforcement.active_count",
    category: "enforcement",
    evaluate: (input) => {
      const n = input.enforcement.activeCount;
      if (n === 0) return [];
      let points = 0;
      if (n <= 2) points = 28;
      else if (n <= 5) points = 50;
      else points = 72;
      return [{
        ruleId: "enforcement.active_count",
        category: "enforcement",
        points,
        description: `${n} действующих исполнительных производства на сумму ${formatMoney(input.enforcement.activeAmount)}`,
      }];
    },
  },
  {
    id: "enforcement.tax_related",
    category: "tax",
    evaluate: (input) => {
      const taxProceedings = input.enforcement.proceedings.filter((p) => p.status === "active" && p.subject.includes("налог"));
      if (taxProceedings.length === 0) return [];
      return [{
        ruleId: "enforcement.tax_related",
        category: "tax",
        points: 32,
        description: `Обнаружены исполнительные производства по взысканию налоговой задолженности (${taxProceedings.length})`,
      }];
    },
  },

  // -------------------------------------------------------------- BANKRUPTCY
  {
    id: "bankruptcy.active_case",
    category: "bankruptcy",
    evaluate: (input) => {
      if (!input.bankruptcy.hasActiveCase) return [];
      const severeStage = input.bankruptcy.stage === "receivership";
      return [{
        ruleId: "bankruptcy.active_case",
        category: "bankruptcy",
        points: severeStage ? 55 : 42,
        description: `Открыта процедура банкротства: «${input.bankruptcy.stageLabel ?? "процедура банкротства"}»`,
      }];
    },
  },
  {
    id: "bankruptcy.warning_publication",
    category: "bankruptcy",
    evaluate: (input) => {
      if (input.bankruptcy.hasActiveCase || input.bankruptcy.publications.length === 0) return [];
      return [{
        ruleId: "bankruptcy.warning_publication",
        category: "bankruptcy",
        points: 18,
        description: "Опубликовано сообщение о намерении кредитора подать заявление о банкротстве компании",
      }];
    },
  },

  // ------------------------------------------------------------- PROCUREMENT
  {
    id: "procurement.rnp",
    category: "procurement",
    evaluate: (input) =>
      input.procurement.isInUnreliableSuppliersRegistry
        ? [{ ruleId: "procurement.rnp", category: "procurement", points: 45, description: "Компания включена в реестр недобросовестных поставщиков (РНП)" }]
        : [],
  },
  {
    id: "procurement.terminated_contracts",
    category: "procurement",
    evaluate: (input) => {
      const terminated = input.procurement.contracts.filter((c) => c.status === "terminated").length;
      if (terminated === 0) return [];
      return [{
        ruleId: "procurement.terminated_contracts",
        category: "procurement",
        points: Math.min(20, terminated * 10),
        description: `Расторгнуто государственных контрактов по вине поставщика: ${terminated}`,
      }];
    },
  },
  {
    id: "procurement.stable_history",
    category: "procurement",
    evaluate: (input) => {
      const terminated = input.procurement.contracts.some((c) => c.status === "terminated");
      if (input.procurement.isInUnreliableSuppliersRegistry || terminated) return [];
      if (input.procurement.asSupplierContractsCount >= 5) {
        return [{
          ruleId: "procurement.stable_history",
          category: "procurement",
          points: -12,
          description: `Устойчивая история исполнения государственных контрактов (${input.procurement.asSupplierContractsCount}) без нарушений`,
        }];
      }
      return [];
    },
  },

  // ------------------------------------------------------------ REPUTATIONAL
  {
    id: "reputational.negative_mentions",
    category: "reputational",
    evaluate: (input) => {
      const n = input.reputation.negativeMentionsCount;
      if (n === 0) return [];
      let points = 0;
      if (n === 1) points = 12;
      else if (n <= 3) points = 28;
      else points = 45;
      return [{ ruleId: "reputational.negative_mentions", category: "reputational", points, description: `Негативные упоминания в открытых источниках: ${n}` }];
    },
  },
  {
    id: "reputational.positive_only",
    category: "reputational",
    evaluate: (input) => {
      const hasPositive = input.reputation.mentions.some((m) => m.sentiment === "positive");
      if (hasPositive && input.reputation.negativeMentionsCount === 0) {
        return [{ ruleId: "reputational.positive_only", category: "reputational", points: -5, description: "В открытых источниках отсутствуют негативные упоминания" }];
      }
      return [];
    },
  },
];
