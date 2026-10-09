import { describe, expect, it } from "vitest";
import { alertasPanel, calcularDsat, categoriaDsat, fraseQa, promedioQa } from "./reglas";
import { construirFecha, entero, fecha, fechaDiaMes, numero } from "./hoja-calculo";

describe("numero / entero", () => {
  it("vacíos devuelven null, nunca 0", () => {
    for (const v of [null, undefined, "", "   "]) {
      expect(numero(v)).toBeNull();
      expect(entero(v)).toBeNull();
    }
  });
  it("conserva ceros reales", () => {
    expect(numero(0)).toBe(0);
    expect(numero("0")).toBe(0);
    expect(entero("0")).toBe(0);
  });
  it("rechaza inválidos y no trunca decimales", () => {
    expect(numero("abc")).toBeNull();
    expect(entero("12.7")).toBeNull();
    expect(entero(12.5)).toBeNull();
    expect(entero("42")).toBe(42);
  });
});

describe("fechas", () => {
  it("rechaza fechas inexistentes o fuera de rango", () => {
    expect(construirFecha(2026, 2, 30)).toBeNull();
    expect(construirFecha(206, 5, 1)).toBeNull();
    expect(fecha("2026-13-01")).toBeNull();
    expect(fecha("basura")).toBeNull();
  });
  it("fecha() usa mes/día/año sin intercambiar por suposición", () => {
    expect(fecha("08/03/2026")).toBe("2026-08-03");
    expect(fecha("29/07/2026")).toBeNull();
  });
  it("QA usa día/mes/año y solo corrige con la columna Month", () => {
    expect(fechaDiaMes("03/08/2026")).toBe("2026-08-03");
    expect(fechaDiaMes("7/29/2026", "July")).toBe("2026-07-29");
    expect(fechaDiaMes("7/29/2026")).toBeNull();
  });
});

describe("QA", () => {
  it("una nota de 9 y una vacía promedian 9", () => {
    expect(promedioQa([9, null])).toBe(9);
    expect(promedioQa([9, ""])).toBe(9);
  });
  it("sin notas válidas no hay datos", () => {
    expect(promedioQa([null, undefined])).toBeNull();
    expect(fraseQa(promedioQa([]))).toBeNull();
  });
  it("un cero real cuenta", () => {
    expect(promedioQa([0, 10])).toBe(5);
  });
});

describe("DSAT", () => {
  it("cuenta solo Aplica Coach en blanco y con nota", () => {
    const t = "Más de 1 Semana";
    const r = calcularDsat([
      { aplica_coach: null, tenure_aplica: t, coach_score: 8 },
      { aplica_coach: "", tenure_aplica: t, coach_score: 10 },
      { aplica_coach: "NO APLICA COACH", tenure_aplica: t, coach_score: 1 },
      { aplica_coach: null, tenure_aplica: t, coach_score: null },
    ]);
    expect(r).toEqual({ numerador: 1, denominador: 2, porcentaje: 50 });
  });
  it("cuenta solo encuestas de más de 1 semana", () => {
    const r = calcularDsat([
      { aplica_coach: null, tenure_aplica: "Más de 1 Semana", coach_score: 5 },
      { aplica_coach: null, tenure_aplica: "Menos de 1 Semana", coach_score: 1 },
      { aplica_coach: null, tenure_aplica: "TENURE NO ENCONTRADO", coach_score: 1 },
      { aplica_coach: null, tenure_aplica: null, coach_score: 1 },
      { aplica_coach: null, tenure_aplica: "MAS DE 1 SEMANA", coach_score: 10 },
    ]);
    expect(r).toEqual({ numerador: 1, denominador: 2, porcentaje: 50 });
  });
  it("sin encuestas válidas no hay porcentaje", () => {
    expect(calcularDsat([]).porcentaje).toBeNull();
  });
  it("compara sin redondear en los límites", () => {
    expect(categoriaDsat(6, 6, 12)).toBe("SUPERSTAR");
    expect(categoriaDsat(6.004, 6, 12)).toBe("GREAT");
    expect(categoriaDsat(12, 6, 12)).toBe("GREAT");
    expect(categoriaDsat(12.0001, 6, 12)).toBe("BAD");
    expect(categoriaDsat(null, 6, 12)).toBeNull();
  });
});

describe("alertas", () => {
  const base = { hayDatos: true, qaBloqueado: false, qaAdvertencia: false };
  it("sin datos no es All clear", () => {
    expect(alertasPanel({ ...base, hayDatos: false, incidencias: 0 })[0]!.texto).not.toMatch(/All clear/);
  });
  it("exactamente 3 incidencias es aviso; 4 es crítico", () => {
    expect(alertasPanel({ ...base, incidencias: 3 })[0]!.tono).toBe("aviso");
    expect(alertasPanel({ ...base, incidencias: 4 })[0]!.tono).toBe("critico");
    expect(alertasPanel({ ...base, incidencias: 2 })[0]!.tono).toBe("ok");
  });
});
