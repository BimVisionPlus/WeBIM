// Combining several IFC files into one table.
//
// Each discipline exports its own file with its own property sets, so the
// useful question — "give me every element that has Pset_WallCommon.IsExternal,
// across KT and KC" — cannot be answered inside one file. This unions the
// columns across models and leaves a cell blank where a model does not carry
// that property, rather than dropping the row or inventing a zero.

import type { LinkedElement } from "../ifc/parseIfc";

export interface IfcSource {
  name: string;
  elements: readonly LinkedElement[];
}

/** Columns every row has, before any property set is considered. */
export const BASE_COLUMNS = ["Model", "Tên", "IfcType", "GlobalId"] as const;

export type CellValue = string | number | boolean | undefined;
export type IfcRow = Record<string, CellValue>;

/**
 * Property columns present across the given models, sorted.
 *
 * Sorted rather than first-seen: the column order should not depend on which
 * file happened to be linked first, or a re-link would reshuffle a table
 * somebody was reading.
 */
export function propertyColumns(sources: readonly IfcSource[]): string[] {
  const columns = new Set<string>();
  for (const source of sources) {
    for (const element of source.elements) {
      for (const key of Object.keys(element.properties ?? {})) columns.add(key);
    }
  }
  return [...columns].sort((a, b) => a.localeCompare(b, "vi"));
}

export function buildRows(sources: readonly IfcSource[]): IfcRow[] {
  const rows: IfcRow[] = [];
  for (const source of sources) {
    for (const element of source.elements) {
      rows.push({
        Model: source.name,
        "Tên": element.name,
        IfcType: element.ifcType,
        GlobalId: element.globalId,
        ...(element.properties ?? {}),
      });
    }
  }
  return rows;
}

/** Substring match over every visible cell — a filter box, not a query language. */
export function filterRows(
  rows: readonly IfcRow[],
  columns: readonly string[],
  query: string,
): IfcRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter((row) =>
    columns.some((column) => String(row[column] ?? "").toLowerCase().includes(needle)),
  );
}

/** RFC 4180: quote when the value contains a comma, quote or newline. */
function csvCell(value: CellValue): string {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: readonly IfcRow[], columns: readonly string[]): string {
  const header = columns.map(csvCell).join(",");
  const body = rows.map((row) => columns.map((column) => csvCell(row[column])).join(","));
  return [header, ...body].join("\n");
}

export interface ColumnCoverage {
  column: string;
  /** How many rows actually carry the property — a mostly-empty column is noise. */
  filled: number;
  total: number;
}

/**
 * Which columns are worth showing. A federated model can carry hundreds of
 * property names, most present in a handful of elements; coverage lets the
 * table default to the ones that say something.
 */
export function columnCoverage(
  rows: readonly IfcRow[],
  columns: readonly string[],
): ColumnCoverage[] {
  return columns
    .map((column) => ({
      column,
      filled: rows.reduce(
        (count, row) => count + (row[column] === undefined || row[column] === "" ? 0 : 1),
        0,
      ),
      total: rows.length,
    }))
    .sort((a, b) => b.filled - a.filled || a.column.localeCompare(b.column, "vi"));
}
