import type { CompanyIdentity } from "@/types/dossier";

/** Единые русские подписи статуса компании — используются и mock-генератором, и реальными адаптерами. */
export const COMPANY_STATUS_LABEL: Record<CompanyIdentity["status"], string> = {
  active: "Действующая",
  liquidating: "В процессе ликвидации",
  liquidated: "Ликвидирована",
  bankrupt: "Банкротство (конкурсное производство)",
  reorganizing: "В процессе реорганизации",
};
