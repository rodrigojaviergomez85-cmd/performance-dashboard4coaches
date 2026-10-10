import * as XLSX from "xlsx";

/** Encabezado comparable: sin acentos, sin espacios extra, en minúsculas. */
export const claveEncabezado = (t: string) =>
  String(t)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Lee la hoja que contiene los encabezados requeridos, o la primera si no se indican. */
export async function leerHoja(
  archivo: File,
  encabezadosRequeridos: string[] = [],
): Promise<Record<string, unknown>[]> {
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const libro = XLSX.read(datos, { type: "array", cellDates: true });

  const hoja = libro.SheetNames.map((nombre) => libro.Sheets[nombre]).find((candidata) => {
    if (!candidata) return false;
    if (!encabezadosRequeridos.length) return true;
    const primeraFila = XLSX.utils.sheet_to_json<unknown[]>(candidata, {
      header: 1,
      range: 0,
      blankrows: false,
    })[0];
    if (!primeraFila) return false;
    const disponibles = new Set(primeraFila.map((valor) => claveEncabezado(String(valor ?? ""))));
    return encabezadosRequeridos.every((encabezado) =>
      disponibles.has(claveEncabezado(encabezado)),
    );
  });

  if (!hoja) {
    throw new Error(
      `No se encontró una hoja con las columnas requeridas: ${encabezadosRequeridos.join(", ")}.`,
    );
  }

  // Algunos archivos declaran un rango incorrecto; se recalcula con las celdas reales.
  let maxFila = 0;
  let maxCol = 0;
  for (const direccion of Object.keys(hoja)) {
    if (direccion.startsWith("!")) continue;
    const celda = XLSX.utils.decode_cell(direccion);
    if (celda.r > maxFila) maxFila = celda.r;
    if (celda.c > maxCol) maxCol = celda.c;
  }
  hoja["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxFila, c: maxCol } });

  const crudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: null });

  return crudas.map((fila) => {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fila)) salida[claveEncabezado(k)] = v;
    return salida;
  });
}

export function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const limpio = String(valor).trim();
  return limpio === "" ? null : limpio;
}

/** Número real. Vacío o inválido devuelve null; el cero real se conserva. */
export function numero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const t = texto(valor);
  if (t === null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Entero. Vacío, inválido o con decimales devuelve null (nunca se trunca). */
export function entero(valor: unknown): number | null {
  const n = numero(valor);
  return n !== null && Number.isInteger(n) ? n : null;
}

/** El valor venía escrito pero no se pudo interpretar. */
export const invalido = (crudo: unknown, interpretado: unknown) =>
  texto(crudo) !== null && interpretado === null;

const dosDigitos = (n: number) => String(n).padStart(2, "0");

const ANIO_MIN = 2000;
const ANIO_MAX = 2100;

/** aaaa-mm-dd solo si la fecha existe en el calendario y el año es razonable. */
export function construirFecha(anio: number, mes: number, dia: number): string | null {
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || !Number.isInteger(dia)) return null;
  if (anio < ANIO_MIN || anio > ANIO_MAX || mes < 1 || mes > 12 || dia < 1) return null;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
}

function fechaNoTexto(valor: unknown): string | null | undefined {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return construirFecha(valor.getFullYear(), valor.getMonth() + 1, valor.getDate());
  }
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86400000);
    return construirFecha(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return undefined;
}

/**
 * Fechas de fuentes en formato mes/día/año (NL, Lateness, incidencias).
 * Acepta fechas de Excel, ISO y m/d/aaaa. No intercambia día y mes por suposición.
 */
export function fecha(valor: unknown): string | null {
  const directa = fechaNoTexto(valor);
  if (directa !== undefined) return directa;
  const t = texto(valor);
  if (t === null) return null;

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return construirFecha(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const local = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (local) return construirFecha(Number(local[3]), Number(local[1]), Number(local[2]));
  return null;
}

/** Un horario exactamente 00:00:00 significa las ocho de la mañana. */
export const normalizarHorario = (valor: unknown): string | null => {
  const t = texto(valor);
  if (t === null) return null;
  return t.replace(/(?<!\d)00:00:00(?!\d)/g, "08:00:00");
};

/** Primer y último día del mes en curso. */
export function rangoMesActual() {
  const d = new Date();
  const primero = new Date(d.getFullYear(), d.getMonth(), 1);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const f = (x: Date) => `${x.getFullYear()}-${dosDigitos(x.getMonth() + 1)}-${dosDigitos(x.getDate())}`;
  return { desde: f(primero), hasta: f(ultimo) };
}

const MESES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/**
 * Fechas de QA, escritas día/mes/año. Solo se intercambian día y mes cuando
 * la columna Month del mismo registro lo demuestra (Excel a veces guarda
 * 03/08/2026 como 3 de marzo); nunca por suposición.
 */
export function fechaDiaMes(valor: unknown, mesEsperado?: unknown): string | null {
  const esperado = MESES[String(mesEsperado ?? "").trim().toLowerCase()];
  let partes: { anio: number; mes: number; dia: number } | null = null;

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    partes = { anio: valor.getFullYear(), mes: valor.getMonth() + 1, dia: valor.getDate() };
  } else {
    const directa = fechaNoTexto(valor);
    if (directa !== undefined) return directa;
    const t = texto(valor);
    if (t === null) return null;
    const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return construirFecha(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    const local = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!local) return null;
    partes = { anio: Number(local[3]), mes: Number(local[2]), dia: Number(local[1]) };
  }

  if (esperado && partes.mes !== esperado && partes.dia === esperado) {
    return construirFecha(partes.anio, partes.dia, partes.mes);
  }
  return construirFecha(partes.anio, partes.mes, partes.dia);
}

/**
 * Lee las hojas RAW de incidencias (ONSITE y ONLINE) del libro completo, ignorando
 * pivots y resúmenes. Cada fila lleva "__origen". Solo se procesan las filas con Fecha,
 * porque el libro declara rangos de ~1 millón de filas vacías.
 */
export async function leerHojasIncidencias(archivo: File): Promise<Record<string, unknown>[]> {
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const nombres = XLSX.read(datos, { type: "array", bookSheets: true }).SheetNames;
  const raw = nombres.filter((n) => /^raw incide?n?c?i?as/.test(claveEncabezado(n)) || /^raw incid/.test(claveEncabezado(n)));
  const online = raw.find((n) => claveEncabezado(n).includes("online"));
  const onsite = raw.find((n) => !claveEncabezado(n).includes("online"));
  if (!online || !onsite) {
    throw new Error("No se encontraron las hojas RAW INCIDENCIAS y RAW INCIDENCIAS ONLINE.");
  }
  const libro = XLSX.read(datos, { type: "array", cellDates: true, sheets: [onsite, online] });
  const salida: Record<string, unknown>[] = [];
  for (const [nombre, origen] of [[onsite, "ONSITE"], [online, "ONLINE"]] as const) {
    const hoja = libro.Sheets[nombre];
    if (!hoja) continue;
    let colFecha = -1;
    let maxCol = 0;
    for (const dir of Object.keys(hoja)) {
      if (dir.startsWith("!")) continue;
      const c = XLSX.utils.decode_cell(dir);
      if (c.r === 0) {
        if (c.c > maxCol) maxCol = c.c;
        if (claveEncabezado(String(hoja[dir]?.v ?? "")) === "fecha") colFecha = c.c;
      }
    }
    if (colFecha < 0) throw new Error(`La hoja ${nombre} no tiene la columna Fecha.`);
    let maxFila = 0;
    for (const dir of Object.keys(hoja)) {
      if (dir.startsWith("!")) continue;
      const c = XLSX.utils.decode_cell(dir);
      const v = hoja[dir]?.v;
      if (c.c === colFecha && c.r > maxFila && v !== null && v !== undefined && v !== "") maxFila = c.r;
    }
    hoja["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxFila, c: maxCol } });
    for (const fila of XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: null })) {
      const f: Record<string, unknown> = { __origen: origen };
      for (const [k, v] of Object.entries(fila)) f[claveEncabezado(k)] = v;
      salida.push(f);
    }
  }
  return salida;
}

/** Retention: lee la hoja "COACH GRAL" (o la que tenga sus encabezados). */
export async function leerHojaRetencion(archivo: File): Promise<Record<string, unknown>[]> {
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const nombres = XLSX.read(datos, { type: "array", bookSheets: true }).SheetNames;
  const nombre = nombres.find((n) => claveEncabezado(n) === "coach gral");
  if (!nombre) return leerHoja(archivo, ["ID COACH", "Active Student", "RETENTION", "CLV"]);
  const libro = XLSX.read(datos, { type: "array", sheets: [nombre] });
  const hoja = libro.Sheets[nombre]!;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: null }).map((fila) => {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fila)) salida[claveEncabezado(k)] = v;
    return salida;
  });
}

const MESES_NOMBRE: [RegExp, number][] = [
  [/\b(ene|enero|jan|january)\b/, 1], [/\b(feb|febrero|february)\b/, 2], [/\b(mar|marzo|march)\b/, 3],
  [/\b(abr|abril|apr|april)\b/, 4], [/\b(may|mayo)\b/, 5], [/\b(jun|junio|june)\b/, 6],
  [/\b(jul|julio|july)\b/, 7], [/\b(ago|agosto|aug|august)\b/, 8], [/\b(sep|sept|septiembre|setiembre|september)\b/, 9],
  [/\b(oct|octubre|october)\b/, 10], [/\b(nov|noviembre|november)\b/, 11], [/\b(dic|diciembre|dec|december)\b/, 12],
];

/** Mes "aaaa-mm" detectado en el nombre del archivo; el año sale del nombre o del respaldo. */
export function mesDesdeNombre(nombre: string, respaldo: string): string | null {
  const t = claveEncabezado(nombre).replace(/[_\-.]+/g, " ");
  const hallado = MESES_NOMBRE.find(([re]) => re.test(t));
  if (!hallado) return null;
  const anio = t.match(/\b(20\d{2})\b/)?.[1] ?? respaldo.slice(0, 4);
  return `${anio}-${String(hallado[1]).padStart(2, "0")}`;
}
