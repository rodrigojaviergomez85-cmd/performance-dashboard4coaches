import { describe, expect, it } from "vitest";
import { mesDesdeNombre } from "./hoja-calculo";

describe("mes desde el nombre del archivo", () => {
  it("detecta Sept con año de respaldo", () => {
    expect(mesDesdeNombre("RETENTION_Sept_01_-_Sept_27_REGIONAL_1.xlsx", "2026-10")).toBe("2026-09");
  });
  it("usa el año del nombre si viene", () => {
    expect(mesDesdeNombre("RETENTION JULIO 2025.xlsx", "2026-10")).toBe("2025-07");
  });
  it("sin mes devuelve null", () => {
    expect(mesDesdeNombre("reporte.xlsx", "2026-10")).toBeNull();
  });
});
