import { NextResponse } from "next/server";
import { checkCompany } from "@/lib/checkCompany";
import { computeDealAssessment } from "@/lib/risk-engine/dealRisk";
import type { DealInput } from "@/types/dossier";

export const dynamic = "force-dynamic";

interface DealRiskRequestBody {
  query: string;
  amount: number;
  prepaymentPercent: number;
  postpaymentDays: number;
  subject: string;
}

function isValidBody(body: unknown): body is DealRiskRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.query === "string" &&
    typeof b.amount === "number" &&
    Number.isFinite(b.amount) &&
    b.amount >= 0 &&
    typeof b.prepaymentPercent === "number" &&
    b.prepaymentPercent >= 0 &&
    b.prepaymentPercent <= 100 &&
    typeof b.postpaymentDays === "number" &&
    b.postpaymentDays >= 0 &&
    typeof b.subject === "string"
  );
}

/**
 * POST /api/deal-risk — оценка риска конкретной сделки с уже проверенным
 * контрагентом. Повторно вычисляет досье компании (дёшево — детерминированный
 * генератор без сети) и применяет risk-engine/dealRisk.ts поверх уже
 * рассчитанного общего риска контрагента.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректное тело запроса — ожидается JSON" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { ok: false, error: "Проверьте параметры сделки: query, amount, prepaymentPercent (0–100), postpaymentDays, subject" },
      { status: 400 }
    );
  }

  const companyResult = await checkCompany(body.query);
  if (!companyResult.ok) {
    return NextResponse.json({ ok: false, error: companyResult.error }, { status: 422 });
  }

  const dealInput: DealInput = {
    amount: body.amount,
    prepaymentPercent: body.prepaymentPercent,
    postpaymentDays: body.postpaymentDays,
    subject: body.subject.trim().slice(0, 300),
  };

  const dealAssessment = computeDealAssessment(companyResult.dossier.riskAssessment, companyResult.dossier.finance, dealInput);

  return NextResponse.json({ ok: true, dealAssessment }, { status: 200 });
}
