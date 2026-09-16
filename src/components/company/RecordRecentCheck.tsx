"use client";

import { useEffect } from "react";
import { addRecentCheck } from "@/lib/utils/recentChecksStorage";
import type { RiskLevel } from "@/types/common";

interface Props {
  query: string;
  inn: string;
  companyName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  checkedAt: string;
}

/** Невидимый компонент: фиксирует успешную проверку в localStorage для блока «Последние проверки» на главной. */
export default function RecordRecentCheck(props: Props) {
  useEffect(() => {
    addRecentCheck(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.inn, props.checkedAt]);

  return null;
}
