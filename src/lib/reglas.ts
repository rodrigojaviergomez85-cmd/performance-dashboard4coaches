/**
 * Reglas de cálculo del panel, sin consultas: se pueden probar por separado.
 * Los porcentajes se comparan sin redondear; solo se redondean al mostrarlos.
 */

export type Categoria = "SUPERSTAR" | "GREAT" | "BAD";

/** Valor numérico real o null (nunca convierte vacío en 0). */
export function notaValida(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Promedio de QA: excluye notas vacías. Sin notas válidas devuelve null ("Sin datos"). */
export function promedioQa(notas: unknown[]): number | null {
  const validas = notas.map(notaValida).filter((n): n is number => n !== null);
  if (!validas.length) return null;
  return validas.reduce((a, b) => a + b, 0) / validas.length;
}

export function fraseQa(promedio: number | null): string | null {
  if (promedio === null) return null;
  if (promedio >= 10) return "Excellente Plus!";
  if (promedio >= 9) return "Excelent!";
  if (promedio >= 8) return "Great Job!";
  if (promedio >= 7) return "Almost There";
  return "Needs Improvement";
}

export function rangoQa(promedio: number | null): number | null {
  if (promedio === null) return null;
  if (promedio >= 10) return 5;
  if (promedio >= 9) return 4;
  if (promedio >= 8) return 3;
  if (promedio >= 7) return 2;
  return 1;
}

/** Umbrales de QA (handoff C7): < 7.5 bloqueo, 7.5 a < 7.8 advertencia. */
export const QA_BLOQUEO = 7.5;
export const QA_ADVERTENCIA = 7.8;

export interface RespuestaDsat {
  aplica_coach: string | null;
  tenure_aplica: string | null;
  coach_score: unknown;
}

/** El coach lleva más de 1 semana en la clase ("Más de 1 Semana"). */
export const esMasDeUnaSemana = (t: string | null) =>
  (t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ") === "mas de 1 semana";

/**
 * Una encuesta cuenta para DSAT cuando "Aplica Coach" está en blanco, el coach
 * lleva más de 1 semana en la clase y tiene nota.
 */
export const cuentaDsat = (r: RespuestaDsat) =>
  !(r.aplica_coach ?? "").trim() &&
  esMasDeUnaSemana(r.tenure_aplica) &&
  notaValida(r.coach_score) !== null;

/** DSAT = encuestas que cuentan con nota <= 8 / encuestas que cuentan. */
export function calcularDsat(respuestas: RespuestaDsat[]) {
  const cuentan = respuestas.filter(cuentaDsat);
  const denominador = cuentan.length;
  const numerador = cuentan.filter((r) => (notaValida(r.coach_score) as number) <= 8).length;
  return {
    numerador,
    denominador,
    porcentaje: denominador === 0 ? null : (numerador * 100) / denominador,
  };
}

/** Categoría por DSAT. Umbrales en porcentaje (6 = 6%). */
export function categoriaDsat(
  porcentaje: number | null,
  superstar: number,
  great: number,
): Categoria | null {
  if (porcentaje === null) return null;
  if (porcentaje <= superstar) return "SUPERSTAR";
  if (porcentaje <= great) return "GREAT";
  return "BAD";
}

/** Redondeo solo para mostrar. */
export const redondear2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

/**
 * Regla única de incidencias para alertas y tarjetas (handoff del sitio
 * original): más de 3 días es crítico; exactamente 3 es advertencia.
 * Su efecto sobre el pago sigue pendiente de confirmación.
 */
export const INCIDENCIAS_LIMITE = 3;

export type Alerta = { tono: "critico" | "aviso" | "ok"; texto: string };

export function alertasPanel(entrada: {
  hayDatos: boolean;
  incidencias: number;
  qaBloqueado: boolean;
  qaAdvertencia: boolean;
}): Alerta[] {
  if (!entrada.hayDatos) return [{ tono: "aviso", texto: "No data for this quarter yet." }];
  const alertas: Alerta[] = [];
  if (entrada.incidencias > INCIDENCIAS_LIMITE)
    alertas.push({ tono: "critico", texto: `Incidencias: ${entrada.incidencias} days this quarter (limit is ${INCIDENCIAS_LIMITE}).` });
  else if (entrada.incidencias === INCIDENCIAS_LIMITE)
    alertas.push({ tono: "aviso", texto: `Incidencias: ${entrada.incidencias} days — at the limit.` });
  if (entrada.qaBloqueado) alertas.push({ tono: "critico", texto: "QA Results are below the required minimum." });
  else if (entrada.qaAdvertencia) alertas.push({ tono: "aviso", texto: "QA Results are close to the required minimum." });
  if (!alertas.length) alertas.push({ tono: "ok", texto: "All clear — great shape." });
  return alertas;
}

/* ---------------- Incidencias (archivo RAW ONSITE / ONLINE) ---------------- */

export type OrigenIncidencia = "ONSITE" | "ONLINE";

/** Categorías que cuentan como incidencia. Configuración: editar aquí sin tocar el cálculo. */
export const CATEGORIAS_INCIDENCIA: Record<OrigenIncidencia, string[]> = {
  ONSITE: [
    "PERMISO PERSONAL AUTORIZADO",
    "INCAPACIDAD",
    "ENFERMA/O, ACCIDIENTADO/A, VA CAMINO AL HOSPITAL",
    "PROBLEMA O EMERGENCIA PERSONAL",
    "CLASE IMPARTIDA POR COORDINADOR ACADEMICO",
    "EMERGENCIA FAMILIAR DE PRIMER GRADO",
    "CITA MEDICA AUTORIZADA CON ANTICIPACIÓN",
    "FALLECIMIENTO DE FAMILIAR, PRIMER GRADO",
    "RENUNCIA INMEDIATA",
    "DESPIDO INMEDIATO",
  ],
  ONLINE: [
    "PERMISO PERSONAL AUTORIZADO",
    "ENFERMA/O, ACCIDIENTADO/A, VA CAMINO AL HOSPITAL",
    "PROBLEMA O EMERGENCIA PERSONAL",
    "CLASE IMPARTIDA POR COORDINADOR ACADEMICO",
    "EMERGENCIA FAMILIAR DE PRIMER GRADO",
    "CITA MEDICA AUTORIZADA CON ANTICIPACIÓN",
    "RENUNCIA INMEDIATA",
    "DESPIDO INMEDIATO",
    "LLEGADA TARDE",
    "PROBLEMAS TECNICOS",
    "NO ELECTRICIDAD",
    "COMPUTER ISSUES",
    "NO INTERNET",
  ],
};

const normalizarCategoria = (t: unknown) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const CATEGORIAS_NORMALIZADAS: Record<OrigenIncidencia, Set<string>> = {
  ONSITE: new Set(CATEGORIAS_INCIDENCIA.ONSITE.map(normalizarCategoria)),
  ONLINE: new Set(CATEGORIAS_INCIDENCIA.ONLINE.map(normalizarCategoria)),
};

export function cuentaIncidencia(origen: OrigenIncidencia, categoria: unknown): boolean {
  const c = normalizarCategoria(categoria);
  return c !== "" && CATEGORIAS_NORMALIZADAS[origen].has(c);
}

/** El archivo usa el ID base ×10,000 para separar sucursales del mismo coach. */
export function idCoachBase(id: number): number {
  return id >= 10000 && id % 10000 === 0 ? id / 10000 : id;
}

/** Semana ISO (lunes a domingo) de una fecha aaaa-mm-dd, como "2026-W35". */
export function semanaIso(fecha: string): string {
  const [a, m, d] = fecha.slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(a!, m! - 1, d!));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const inicioAnio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((t.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

/** Días y semanas únicas de un conjunto de fechas. Sin fechas: null (NO DATA). */
export function resumenIncidencias(fechas: string[]) {
  if (!fechas.length) return { incidencias: 0, dias: null, semanas: null };
  const dias = new Set(fechas.map((f) => f.slice(0, 10)));
  return {
    incidencias: fechas.length,
    dias: dias.size,
    semanas: new Set([...dias].map(semanaIso)).size,
  };
}
