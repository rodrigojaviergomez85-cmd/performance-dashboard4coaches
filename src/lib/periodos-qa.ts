/** Períodos QA: reglas puras sobre fechas calendario (YYYY-MM-DD, sin zona horaria). */
export interface PeriodoQa {
  id: string;
  label: string;
  month: number;
  year: number;
  start_date: string;
  end_date: string;
}

/** Rangos inclusivos: se solapan si uno empieza antes o el mismo día en que termina el otro. */
export function seSolapan(a: { start_date: string; end_date: string }, b: { start_date: string; end_date: string }) {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

export function periodoDeFecha<T extends PeriodoQa>(periodos: T[], fecha: string): T | null {
  return periodos.find((p) => p.start_date <= fecha && fecha <= p.end_date) ?? null;
}

/** Ordena del más reciente al más antiguo. */
export function ordenarPeriodos<T extends PeriodoQa>(periodos: T[]): T[] {
  return [...periodos].sort((a, b) => b.start_date.localeCompare(a.start_date));
}

/** Período que contiene hoy; si no existe, el más reciente. */
export function periodoPorDefecto<T extends PeriodoQa>(periodos: T[], hoy: string): T | null {
  return periodoDeFecha(periodos, hoy) ?? ordenarPeriodos(periodos)[0] ?? null;
}

/** Fecha local de hoy como YYYY-MM-DD (evita el desfase de toISOString). */
export function hoyLocal(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Mes QA de una evaluación: el del período que contiene la fecha; sin período, el mes calendario. */
export function mesQaDeFecha(periodos: PeriodoQa[], fecha: string): { year: number; month: number } {
  const p = periodoDeFecha(periodos, fecha);
  return p ? { year: p.year, month: p.month } : { year: Number(fecha.slice(0, 4)), month: Number(fecha.slice(5, 7)) };
}
