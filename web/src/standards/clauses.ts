// Điều khoản mức-câu-chữ cho Q&A quy chuẩn — sinh bởi scripts/import-clauses.mjs
// từ repo plancheck (building code as machine-readable rules).

import type { StandardClause } from "../application/standardsQa";
import clausesData from "./clauses.json";

export const CLAUSES: StandardClause[] = clausesData.clauses;

export const CLAUSES_PROVENANCE = {
  source: clausesData.source,
  revision: clausesData.revision,
  importedAt: clausesData.importedAt,
};
