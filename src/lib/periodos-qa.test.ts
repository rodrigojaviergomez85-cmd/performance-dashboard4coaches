import { describe, expect, it } from "vitest";
import { periodoDeFecha, periodoPorDefecto, seSolapan } from "./periodos-qa";

const sep = { id: "s", label: "Septiembre 2026", month: 9, year: 2026, start_date: "2026-09-01", end_date: "2026-10-04" };
const oct = { id: "o", label: "Octubre 2026", month: 10, year: 2026, start_date: "2026-10-05", end_date: "2026-11-01" };

describe("períodos QA", () => {
  it("TEST 1: fechas del 15/09 al 04/10 pertenecen a Septiembre", () => {
    for (const f of ["2026-09-15", "2026-09-30", "2026-10-01", "2026-10-03", "2026-10-04"])
      expect(periodoDeFecha([sep, oct], f)?.id).toBe("s");
  });
  it("TEST 2: 05/10 pertenece solo a Octubre", () => {
    expect(periodoDeFecha([sep, oct], "2026-10-05")?.id).toBe("o");
  });
  it("TEST 4: Septiembre y un Octubre desde 01/10 se solapan", () => {
    expect(seSolapan(sep, { start_date: "2026-10-01", end_date: "2026-10-31" })).toBe(true);
  });
  it("Septiembre y Octubre desde 05/10 no se solapan", () => {
    expect(seSolapan(sep, oct)).toBe(false);
  });
  it("por defecto elige el período que contiene hoy", () => {
    expect(periodoPorDefecto([oct, sep], "2026-10-03")?.id).toBe("s");
  });
  it("sin período que contenga hoy elige el más reciente", () => {
    expect(periodoPorDefecto([sep, oct], "2027-01-10")?.id).toBe("o");
  });
});
