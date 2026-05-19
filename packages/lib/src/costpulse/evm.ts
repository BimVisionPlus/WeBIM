/**
 * Earned-Value Management primitives for CostPulse.
 *
 * Given a BoQ + cumulative-completed quantities + actual cost-to-date,
 * compute SPI / CPI / EAC / forecast finish — the same numbers Procore /
 * ACC charge enterprise rates for. Pure functions; no DB.
 */

export type BoQLineSnap = {
  qty: number;
  qtyCompleted: number;
  unitPriceVnd: bigint;
};

export type EvmInput = {
  lines: BoQLineSnap[];
  /** Actual cost incurred to date (AC). */
  actualCostVnd: bigint;
  /** Optional baseline schedule percent-complete 0..1 — used for SPI. */
  plannedPctComplete?: number;
};

export type EvmResult = {
  /** Budget at completion */
  bac: bigint;
  /** Earned value */
  ev: bigint;
  /** Planned value */
  pv: bigint;
  /** Actual cost */
  ac: bigint;
  /** Cost Performance Index — EV/AC. >1 good, <1 over-running. */
  cpi: number;
  /** Schedule Performance Index — EV/PV. */
  spi: number;
  /** Estimate at completion = BAC / CPI */
  eac: bigint;
  /** Variance at completion = BAC − EAC. Negative = expected loss. */
  vac: bigint;
  /** Cost variance EV − AC */
  cv: bigint;
};

export function computeEvm(input: EvmInput): EvmResult {
  let bac = 0n;
  let ev = 0n;
  for (const l of input.lines) {
    const lineBac = BigInt(Math.round(l.qty * 1000)) * l.unitPriceVnd / 1000n;
    bac += lineBac;
    const lineEv = BigInt(Math.round(l.qtyCompleted * 1000)) * l.unitPriceVnd / 1000n;
    ev += lineEv;
  }
  const ac = input.actualCostVnd;
  const pv =
    input.plannedPctComplete !== undefined
      ? BigInt(Math.round(input.plannedPctComplete * 1_000_000)) * bac / 1_000_000n
      : ev; // if no plan provided, SPI = 1 by construction
  const cpi = ac === 0n ? 1 : Number(ev * 1_000_000n / ac) / 1_000_000;
  const spi = pv === 0n ? 1 : Number(ev * 1_000_000n / pv) / 1_000_000;
  const eac = cpi > 0 ? BigInt(Math.round(Number(bac) / cpi)) : bac;
  const vac = bac - eac;
  const cv = ev - ac;
  return { bac, ev, pv, ac, cpi, spi, eac, vac, cv };
}

/** Translate EVM result into a severity hint usable by overrun detector. */
export function severityFromEvm(r: EvmResult): "WATCH" | "ALERT" | "CRITICAL" | null {
  if (r.cpi >= 0.95) return null;
  if (r.cpi >= 0.85) return "WATCH";
  if (r.cpi >= 0.75) return "ALERT";
  return "CRITICAL";
}
