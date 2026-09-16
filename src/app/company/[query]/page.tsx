import Link from "next/link";
import { checkCompany } from "@/lib/checkCompany";
import CompanyHeader from "@/components/company/CompanyHeader";
import CompanyTabs, { type TabItem } from "@/components/company/CompanyTabs";
import RecordRecentCheck from "@/components/company/RecordRecentCheck";
import OverviewTab from "@/components/company/tabs/OverviewTab";
import FinanceTab from "@/components/company/tabs/FinanceTab";
import ArbitrationTab from "@/components/company/tabs/ArbitrationTab";
import EnforcementTab from "@/components/company/tabs/EnforcementTab";
import OwnersTab from "@/components/company/tabs/OwnersTab";
import ProcurementTab from "@/components/company/tabs/ProcurementTab";
import BankruptcyTab from "@/components/company/tabs/BankruptcyTab";
import ReputationTab from "@/components/company/tabs/ReputationTab";
import SourcesTab from "@/components/company/tabs/SourcesTab";

export const dynamic = "force-dynamic";

export default async function CompanyPage(props: PageProps<"/company/[query]">) {
  const { query } = await props.params;
  const result = await checkCompany(query);

  if (!result.ok) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="mb-3 text-5xl">🔎</p>
        <h1 className="mb-2 text-xl font-semibold text-slate-900">Не удалось выполнить проверку</h1>
        <p className="mb-6 text-slate-500">{result.error}</p>
        <Link href="/" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          Вернуться на главную
        </Link>
      </div>
    );
  }

  const { dossier } = result;

  const tabs: TabItem[] = [
    { id: "overview", label: "Обзор", content: <OverviewTab dossier={dossier} /> },
    { id: "finance", label: "Финансы", content: <FinanceTab finance={dossier.finance} /> },
    { id: "arbitration", label: "Суды", content: <ArbitrationTab arbitration={dossier.arbitration} /> },
    { id: "enforcement", label: "ФССП", content: <EnforcementTab enforcement={dossier.enforcement} /> },
    {
      id: "owners",
      label: "Владельцы и связи",
      content: (
        <OwnersTab
          management={dossier.management}
          owners={dossier.owners}
          relatedCompanies={dossier.relatedCompanies}
          licenses={dossier.licenses}
        />
      ),
    },
    { id: "procurement", label: "Закупки", content: <ProcurementTab procurement={dossier.procurement} /> },
    { id: "bankruptcy", label: "Банкротство", content: <BankruptcyTab bankruptcy={dossier.bankruptcy} /> },
    { id: "reputation", label: "Репутация", content: <ReputationTab reputation={dossier.reputation} /> },
    { id: "sources", label: "Источники", content: <SourcesTab sources={dossier.sources} events={dossier.events} /> },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <RecordRecentCheck
        query={dossier.query}
        inn={dossier.company.inn}
        companyName={dossier.company.shortName}
        riskScore={dossier.riskAssessment.totalScore}
        riskLevel={dossier.riskAssessment.level}
        checkedAt={dossier.generatedAt}
      />
      <CompanyHeader dossier={dossier} />
      <div className="mt-6">
        <CompanyTabs tabs={tabs} />
      </div>
    </div>
  );
}
