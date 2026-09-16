"use client";

import Link from "next/link";
import { useRecentChecks } from "@/lib/utils/recentChecksStorage";
import { RiskBadge } from "@/components/RiskBadge";
import { formatDateTime } from "@/lib/utils/format";

export default function RecentChecks() {
  const entries = useRecentChecks();

  if (entries.length === 0) {
    return (
      <section className="w-full max-w-4xl">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Последние проверки</h2>
        <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-slate-500">
          Здесь появятся ваши последние проверки контрагентов. Начните с примера выше или введите ИНН.
        </p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-4xl">
      <h2 className="mb-3 text-sm font-semibold text-slate-500">Последние проверки</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entries.map((e) => (
          <Link
            key={e.inn}
            href={`/company/${encodeURIComponent(e.inn)}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{e.companyName}</p>
              <p className="text-xs text-slate-500">
                ИНН {e.inn} · {formatDateTime(e.checkedAt)}
              </p>
            </div>
            <RiskBadge level={e.riskLevel} score={e.riskScore} size="sm" />
          </Link>
        ))}
      </div>
    </section>
  );
}
