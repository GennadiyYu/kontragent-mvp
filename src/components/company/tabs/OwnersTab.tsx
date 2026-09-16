import type { LicensesInfo, ManagementInfo, OwnersInfo, RelatedCompaniesInfo } from "@/types/dossier";
import { formatDate } from "@/lib/utils/format";
import { Card, EmptyState, SectionTitle, SourceFootnote } from "../ui";

const RELATED_STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  liquidated: "bg-slate-200 text-slate-700",
  bankrupt: "bg-red-100 text-red-700",
  liquidating: "bg-amber-100 text-amber-700",
  reorganizing: "bg-amber-100 text-amber-700",
};

export default function OwnersTab({
  management,
  owners,
  relatedCompanies,
  licenses,
}: {
  management: ManagementInfo;
  owners: OwnersInfo;
  relatedCompanies: RelatedCompaniesInfo;
  licenses: LicensesInfo;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <SectionTitle>Руководство</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-800">
            {management.director.fullName} — {management.director.position}
          </p>
          {management.director.isMassDirector && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              Массовый руководитель
            </span>
          )}
          {management.director.isDisqualified && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Дисквалифицирован</span>
          )}
        </div>
        {management.registryFlags.hasUnreliableDataMark && (
          <p className="mt-2 text-sm text-red-600">⚠ В ЕГРЮЛ внесена отметка о недостоверности сведений</p>
        )}
        {management.registryFlags.addressIsMassRegistration && (
          <p className="mt-1 text-sm text-orange-600">⚠ Юридический адрес относится к адресам массовой регистрации</p>
        )}
        <SourceFootnote label="ФНС России — ЕГРЮЛ" url={management.director.meta.sourceUrl} />
      </Card>

      <Card>
        <SectionTitle>Учредители</SectionTitle>
        {owners.founders.length === 0 ? (
          <EmptyState>Сведения об учредителях не найдены.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {owners.founders.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{f.name}</p>
                  <p className="text-xs text-slate-400">{f.type === "individual" ? "Физическое лицо" : "Юридическое лицо"}{f.inn ? ` · ИНН ${f.inn}` : ""}</p>
                </div>
                <span className="font-semibold text-slate-700">{f.sharePercent}%</span>
              </li>
            ))}
          </ul>
        )}
        <SourceFootnote label="ФНС России — ЕГРЮЛ" url={owners.meta.sourceUrl} />
      </Card>

      <Card>
        <SectionTitle>Связанные организации</SectionTitle>
        {relatedCompanies.items.length === 0 ? (
          <EmptyState>Связанные организации не выявлены.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {relatedCompanies.items.map((c) => (
              <li key={c.inn} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400">ИНН {c.inn} · {c.relationType}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RELATED_STATUS_COLOR[c.status]}`}>{c.statusLabel}</span>
              </li>
            ))}
          </ul>
        )}
        <SourceFootnote label="ФНС России — ЕГРЮЛ" url={relatedCompanies.meta.sourceUrl} />
      </Card>

      {licenses.warningListEntry && (
        <Card>
          <SectionTitle>Предупредительный список Банка России</SectionTitle>
          <p className="text-sm text-red-600">
            ⚠ Компания включена ЦБ РФ в список с признаками нелегальной деятельности на финансовом рынке:{" "}
            <strong>{licenses.warningListEntry.sign}</strong> (внесено: {formatDate(licenses.warningListEntry.addedDate)})
          </p>
          <SourceFootnote label="Банк России — предупредительный список" url="https://www.cbr.ru/inside/warning-list/" />
        </Card>
      )}

      {licenses.items.length > 0 && (
        <Card>
          <SectionTitle>Лицензии</SectionTitle>
          <ul className="space-y-2">
            {licenses.items.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{l.type}</p>
                  <p className="text-xs text-slate-400">
                    № {l.number} · выдана: {l.issuedBy} ({formatDate(l.issuedDate)})
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    l.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : l.status === "expired"
                        ? "bg-slate-200 text-slate-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {l.statusLabel}
                </span>
              </li>
            ))}
          </ul>
          <SourceFootnote label="Банк России" url={licenses.meta.sourceUrl} />
        </Card>
      )}
    </div>
  );
}
