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

import { cuentaIncidencia, idCoachBase, resumenIncidencias, semanaIso } from "./reglas";

describe("incidencias", () => {
  it("filtra categorías por origen, sin importar mayúsculas ni espacios", () => {
    expect(cuentaIncidencia("ONSITE", "  incapacidad ")).toBe(true);
    expect(cuentaIncidencia("ONLINE", "INCAPACIDAD")).toBe(true);
    expect(cuentaIncidencia("ONLINE", "FALLECIMIENTO DE FAMILIAR, PRIMER GRADO")).toBe(false);
    expect(cuentaIncidencia("ONLINE", "no internet")).toBe(true);
    expect(cuentaIncidencia("ONSITE", "NO INTERNET")).toBe(false);
    expect(cuentaIncidencia("ONSITE", "BAJA ASISTENCIA")).toBe(false);
  });
  it("ID con cuatro ceros extra vuelve al ID base", () => {
    expect(idCoachBase(12300000)).toBe(1230);
    expect(idCoachBase(1419)).toBe(1419);
  });
  it("4 incidencias en 11 y 12 de septiembre = 2 días", () => {
    const r = resumenIncidencias(["2026-09-11", "2026-09-11", "2026-09-12", "2026-09-12"]);
    expect(r).toEqual({ incidencias: 4, dias: 2, semanas: 1 });
  });
  it("una semana entre agosto y septiembre cuenta una vez en el trimestre", () => {
    expect(semanaIso("2026-08-31")).toBe(semanaIso("2026-09-02"));
    expect(resumenIncidencias(["2026-08-31", "2026-09-02"]).semanas).toBe(1);
  });
  it("sin datos devuelve NO DATA", () => {
    expect(resumenIncidencias([]).dias).toBeNull();
  });
});

import { categoriaRetencion, retencionTrimestre } from "./reglas";

describe("retention", () => {
  it("categorías por umbral", () => {
    expect(categoriaRetencion(79.99)).toBe("BAD");
    expect(categoriaRetencion(80)).toBe("GREAT");
    expect(categoriaRetencion(89.99)).toBe("GREAT");
    expect(categoriaRetencion(90)).toBe("SUPERSTAR");
    expect(categoriaRetencion(null)).toBeNull();
  });
  it("trimestre sobre población combinada, no promedio de porcentajes", () => {
    const r = retencionTrimestre([
      { do_count: 1, active_students: 10, fc_do: 1 },
      { do_count: 10, active_students: 100, fc_do: 10 },
      { do_count: null, active_students: null, fc_do: null },
    ]);
    expect(r.doPct).toBeCloseTo(10, 6);
    expect(r.retencion).toBeCloseTo(90, 6);
    expect(r.clv).toBe(10);
    expect(r.categoria).toBe("SUPERSTAR");
  });
  it("CLV redondea hacia arriba como el libro", () => {
    expect(retencionTrimestre([{ do_count: 8, active_students: 105.8333, fc_do: 8.8889 }]).clv).toBe(12);
  });
  it("sin datos es NO DATA, no 0%", () => {
    expect(retencionTrimestre([]).retencion).toBeNull();
  });
});

import { estadoCr2m, esHire2m, resumenHires } from "./reglas";

describe("hires", () => {
  const h = (student_id: number, es_2m = false, mes = "2026-10-01") => ({ tipo: "hire" as const, period_month: mes, student_id, es_2m, meta: null });
  const m = (meta: number, mes = "2026-10-01") => ({ tipo: "meta" as const, period_month: mes, student_id: null, es_2m: false, meta });

  it("Marvin octubre: 8 / 13, CR 61.54%, 3 2M+, CR 2M+ 23.08%", () => {
    const r = resumenHires([h(1, true), h(2, true), h(3, true), h(4), h(5), h(6), h(7), h(8), m(13)])!;
    expect(r.hires).toBe(8);
    expect(r.meta).toBe(13);
    expect(r.cr!.toFixed(2)).toBe("61.54");
    expect(r.hires2m).toBe(3);
    expect(r.cr2m!.toFixed(2)).toBe("23.08");
  });
  it("estudiante repetido cuenta una vez, también en el trimestre", () => {
    const r = resumenHires([h(1), h(1), h(1, false, "2026-11-01"), m(5), m(5, "2026-11-01")])!;
    expect(r.hires).toBe(1);
    expect(r.meta).toBe(10);
  });
  it("sin datos es null, no cero", () => {
    expect(resumenHires([])).toBeNull();
  });
  it("solo 2 MESES O MÁS cuenta como 2M+", () => {
    expect(esHire2m("2 MESES O MÁS")).toBe(true);
    expect(esHire2m("0-2 MESES")).toBe(false);
    expect(esHire2m("NA-DO")).toBe(false);
    expect(esHire2m("NA-INT HIRED")).toBe(false);
  });
  it("semáforo CR % 2M+", () => {
    expect(estadoCr2m(14.99)).toBe("rojo");
    expect(estadoCr2m(15)).toBe("amarillo");
    expect(estadoCr2m(29.99)).toBe("amarillo");
    expect(estadoCr2m(30)).toBe("verde");
  });
});

import { contarLlegadasTarde } from "./reglas";
describe("lateness desde incidencias", () => {
  const filas = [
    { fecha: "2026-09-16", otros_motivos: "LLEGADA TARDE" },
    { fecha: "2026-09-16", otros_motivos: "Llegada  tarde" },
    { fecha: "2026-10-06", otros_motivos: "LLEGADA TARDE" },
    { fecha: "2026-10-08", otros_motivos: "PERMISO PERSONAL AUTORIZADO" },
  ];
  it("cuenta cada evento, aunque sean el mismo día", () => {
    expect(contarLlegadasTarde(filas, "2026-09-01", "2026-10-01")).toBe(2);
  });
  it("ignora otras categorías y fechas fuera del rango", () => {
    expect(contarLlegadasTarde(filas, "2026-10-01", "2026-11-01")).toBe(1);
  });
});

import { grupoComentarioCsat, ordenarComentariosCsat, tonoNotaCsat } from "./reglas";

describe("comentarios CSAT", () => {
  it("8 es detractor", () => expect(grupoComentarioCsat(8)).toBe("detractor"));
  it("9 es positivo", () => expect(grupoComentarioCsat(9)).toBe("positivo"));
  it("6 rojo, 7 ámbar, 10 verde", () => {
    expect(tonoNotaCsat(6)).toBe("rojo");
    expect(tonoNotaCsat(7)).toBe("ambar");
    expect(tonoNotaCsat(10)).toBe("verde");
  });
  it("ordena de menor a mayor y reciente primero", () => {
    const r = ordenarComentariosCsat([
      { id: 1, coach_score: 9, period_month: "2026-07-01" },
      { id: 2, coach_score: 3, period_month: "2026-07-01" },
      { id: 3, coach_score: 3, period_month: "2026-09-01" },
    ]);
    expect(r.map((f) => f.id)).toEqual([3, 2, 1]);
  });
});

import { tendenciasQa } from "./reglas";
describe("tendenciasQa", () => {
  it("compara con la evaluación anterior por fecha de monitoreo, sin importar el orden de carga", () => {
    const r = tendenciasQa([
      { id: 3, fecha_monitoreo: "2026-10-08", nota_final: 8.5 },
      { id: 1, fecha_monitoreo: "2026-09-20", nota_final: 8 },
      { id: 2, fecha_monitoreo: "2026-10-20", nota_final: 7.5 },
    ]);
    expect(r.map((f) => f.tendencia)).toEqual([null, 0.5, -1]);
  });
});
