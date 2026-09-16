import { NextResponse } from "next/server";
import { checkCompany } from "@/lib/checkCompany";
import { generateDossierPdf } from "@/lib/pdf/generateDossierPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // jsPDF и Buffer требуют Node.js runtime (не Edge)

/**
 * POST /api/pdf — формирует PDF-версию досье компании («Сформировать
 * досье PDF» на странице компании) и возвращает файл для скачивания.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректное тело запроса" }, { status: 400 });
  }

  const query = typeof body === "object" && body !== null && "query" in body ? (body as { query: unknown }).query : undefined;
  if (typeof query !== "string") {
    return NextResponse.json({ ok: false, error: "Поле query обязательно" }, { status: 400 });
  }

  const result = await checkCompany(query);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  try {
    const pdfBuffer = generateDossierPdf(result.dossier);
    const fileNameSafe = result.dossier.company.inn || "dossier";
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dossier-${fileNameSafe}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/pdf] Ошибка генерации PDF:", err);
    return NextResponse.json({ ok: false, error: "Не удалось сформировать PDF" }, { status: 500 });
  }
}
