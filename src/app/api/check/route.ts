import { NextResponse } from "next/server";
import { checkCompany } from "@/lib/checkCompany";

export const dynamic = "force-dynamic";

/**
 * POST /api/check — основной эндпоинт проверки контрагента.
 * Вход: { query: string } — ИНН, ОГРН или название компании.
 * Выход: { ok: true, dossier: CompanyDossier } либо { ok: false, error }.
 *
 * Недоступность отдельного внешнего источника НЕ приводит к ошибке этого
 * эндпоинта — соответствующий раздел досье просто помечается статусом
 * источника "unavailable" (см. sources[] в ответе).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректное тело запроса — ожидается JSON" }, { status: 400 });
  }

  const query = typeof body === "object" && body !== null && "query" in body ? (body as { query: unknown }).query : undefined;

  if (typeof query !== "string") {
    return NextResponse.json({ ok: false, error: "Поле query обязательно и должно быть строкой" }, { status: 400 });
  }

  try {
    const result = await checkCompany(query);
    if (!result.ok) {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[api/check] Непредвиденная ошибка проверки:", err);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервиса при проверке контрагента. Попробуйте ещё раз." },
      { status: 500 }
    );
  }
}
