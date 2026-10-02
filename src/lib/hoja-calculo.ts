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

export function entero(valor: unknown): number | null {
  const n = Number(texto(valor));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function numero(valor: unknown): number | null {
  const n = Number(texto(valor));
  return Number.isFinite(n) ? n : null;
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/** Convierte fechas de Excel, ISO o dd/mm/aaaa a aaaa-mm-dd. */
export function fecha(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${valor.getFullYear()}-${dosDigitos(valor.getMonth() + 1)}-${dosDigitos(valor.getDate())}`;
  }

  if (typeof valor === "number" && Number.isFinite(valor)) {
    const base = Date.UTC(1899, 11, 30);
    const d = new Date(base + Math.round(valor) * 86400000);
    return `${d.getUTCFullYear()}-${dosDigitos(d.getUTCMonth() + 1)}-${dosDigitos(d.getUTCDate())}`;
  }

  const t = String(valor).trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Los archivos usan mes/día/año; si el primer número pasa de 12 es día/mes/año.
  const local = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (local) {
    const a = Number(local[1]);
    const b = Number(local[2]);
    const [mes, dia] = a > 12 ? [b, a] : [a, b];
    return `${local[3]}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
  }

  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
  }
  return null;
}

/** Un horario exactamente 00:00:00 significa las ocho de la mañana. */
export const normalizarHorario = (valor: unknown): string | null => {
  const t = texto(valor);
  if (t === null) return null;
  return t.replace(/(?<!\d)00:00:00(?!\d)/g, "08:00:00");
};

const dosDig = dosDigitos;

/** Primer y último día del mes en curso. */
export function rangoMesActual() {
  const d = new Date();
  const primero = new Date(d.getFullYear(), d.getMonth(), 1);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const f = (x: Date) => `${x.getFullYear()}-${dosDig(x.getMonth() + 1)}-${dosDig(x.getDate())}`;
  return { desde: f(primero), hasta: f(ultimo) };
}

/**
 * Fechas de archivos que se escriben día/mes/año. Excel a veces las guarda
 * invertidas (03/08/2026 como 3 de marzo); cuando el día cabe en un mes se
 * intercambian para recuperar la fecha real.
 */
const MESES: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

export function fechaDiaMes(valor: unknown, mesEsperado?: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const dia = valor.getDate();
    const mes = valor.getMonth() + 1;
    const esperado = MESES[String(mesEsperado ?? "").trim().toLowerCase()];
    if (esperado && mes !== esperado && dia === esperado && mes <= 12) {
      return `${valor.getFullYear()}-${dosDigitos(dia)}-${dosDigitos(mes)}`;
    }
    return fecha(valor);
  }
  const t = texto(valor);
  if (t === null) return null;
  const local = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (local) {
    const a = Number(local[1]);
    const b = Number(local[2]);
    // Día primero, salvo que el segundo número no pueda ser un mes.
    const [dia, mes] = b > 12 ? [b, a] : [a, b];
    return `${local[3]}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
  }
  return fecha(t);
}
