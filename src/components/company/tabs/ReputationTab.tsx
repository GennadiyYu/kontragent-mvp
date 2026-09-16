import type { ReputationInfo } from "@/types/dossier";
import { formatDate } from "@/lib/utils/format";
import { Card, EmptyState, SectionTitle, SourceFootnote, Stat, emptyStateText } from "../ui";

const SENTIMENT_STYLE: Record<string, string> = {
  positive: "border-emerald-200 bg-emerald-50",
  neutral: "border-slate-200 bg-white",
  negative: "border-red-200 bg-red-50",
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "Позитивное",
  neutral: "Нейтральное",
  negative: "Негативное",
};

export default function ReputationTab({ reputation }: { reputation: ReputationInfo }) {
  return (
    <Card>
      <SectionTitle>Репутационный фон</SectionTitle>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Упоминаний всего" value={String(reputation.mentions.length)} />
        <Stat label="Негативных" value={String(reputation.negativeMentionsCount)} />
      </div>

      {reputation.mentions.length === 0 ? (
        <EmptyState>{emptyStateText(reputation.meta.reliability, "Упоминания в открытых источниках не найдены.")}</EmptyState>
      ) : (
        <div className="space-y-2">
          {reputation.mentions.map((m, i) => (
            <div key={i} className={`rounded-lg border p-3 ${SENTIMENT_STYLE[m.sentiment]}`}>
              <p className="text-sm font-medium text-slate-800">{m.title}</p>
              <p className="mt-1 text-xs text-slate-400">
                {formatDate(m.date)} · {SENTIMENT_LABEL[m.sentiment]}
              </p>
            </div>
          ))}
        </div>
      )}

      <SourceFootnote label="Открытые источники / СМИ" url={reputation.meta.sourceUrl} />
    </Card>
  );
}
