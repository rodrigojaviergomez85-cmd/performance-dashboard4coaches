import { entero, fecha, normalizarHorario, numero, texto } from "@/lib/hoja-calculo";

export type ClaveTabla = "qa" | "dsat" | "nl" | "abs" | "lateness";

export interface Columna {
  clave: string;
  etiqueta: string;
  alineacion?: "derecha";
}

export interface Extra {
  mes: string | null;
  token: string | null;
}

export interface ResultadoFila {
  registro?: Record<string, unknown>;
  problema?: string;
}

export interface ConfigPestana {
  clave: ClaveTabla;
  titulo: string;
  campoFecha: string;
  columnas: Columna[];
  filtros: { clave: string; etiqueta: string }[];
  busqueda: string[];
  applicable: boolean;
  aceptar: string;
  requiereMes?: boolean;
  requiereToken?: boolean;
  reemplazarRango?: boolean;
  /** Convierte una fila del archivo en un registro guardable. */
  mapear: (fila: Record<string, unknown>, extra: Extra) => ResultadoFila;
  /** Agrupa las filas ya mapeadas (solo lo usa Lateness). */
  agrupar?: (registros: Record<string, unknown>[]) => Record<string, unknown>[];
}

const primera = (fila: Record<string, unknown>, nombres: string[]) => {
  for (const n of nombres) if (fila[n] !== undefined && fila[n] !== null) return fila[n];
  return null;
};

export const CONFIGS: Record<ClaveTabla, ConfigPestana> = {
  qa: {
    clave: "qa",
    titulo: "QA",
    campoFecha: "clase_date",
    aceptar: ".csv,.xls,.xlsx",
    applicable: true,
    columnas: [
      { clave: "clase_date", etiqueta: "Date" },
      { clave: "clase", etiqueta: "Class ID" },
      { clave: "level", etiqueta: "Level" },
      { clave: "syllabus", etiqueta: "Syllabus" },
      { clave: "schedule", etiqueta: "Schedule" },
      { clave: "coach_id", etiqueta: "Coach ID", alineacion: "derecha" },
      { clave: "coach", etiqueta: "Coach Name" },
      { clave: "eval_id", etiqueta: "Eval ID", alineacion: "derecha" },
      { clave: "score", etiqueta: "Score", alineacion: "derecha" },
    ],
    filtros: [
      { clave: "syllabus", etiqueta: "Syllabus" },
      { clave: "level", etiqueta: "Level" },
      { clave: "schedule", etiqueta: "Schedule" },
    ],
    busqueda: ["coach_id", "coach"],
    mapear: (fila) => {
      const evalId = entero(primera(fila, ["eval id", "evaluation id", "eval_id"]));
      if (evalId === null) return { problema: "Falta Eval ID" };
      const f = fecha(primera(fila, ["clase date", "class date", "date", "fecha"]));
      if (!f) return { problema: "Fecha inválida" };
      return {
        registro: {
          eval_id: evalId,
          clase: texto(primera(fila, ["clase", "class id", "class"])),
          clase_date: f,
          schedule: normalizarHorario(primera(fila, ["schedule", "horario"])),
          eval_by: texto(primera(fila, ["eval by", "evaluator", "evaluado por"])),
          coach_id: entero(primera(fila, ["coach id", "id coach", "teacher id"])),
          coach: texto(primera(fila, ["coach", "coach name", "teacher name"])),
          syllabus: texto(fila["syllabus"]),
          level: texto(fila["level"]),
          week: entero(fila["week"]),
          score: numero(primera(fila, ["score", "nota"])),
          comments: texto(primera(fila, ["comments", "comentarios"])),
          applicable: 1,
        },
      };
    },
  },

  dsat: {
    clave: "dsat",
    titulo: "DSAT",
    campoFecha: "period_month",
    aceptar: ".xls,.xlsx",
    applicable: false,
    requiereMes: true,
    requiereToken: true,
    columnas: [
      { clave: "period_month", etiqueta: "Date" },
      { clave: "class_id", etiqueta: "Class ID", alineacion: "derecha" },
      { clave: "level", etiqueta: "Level" },
      { clave: "syllabus", etiqueta: "Syllabus" },
      { clave: "schedule", etiqueta: "Schedule" },
      { clave: "teacher_id", etiqueta: "Teacher ID", alineacion: "derecha" },
      { clave: "teacher_name", etiqueta: "Teacher Name" },
      { clave: "status", etiqueta: "Status" },
      { clave: "coach_score", etiqueta: "Coach Score", alineacion: "derecha" },
      { clave: "experience_comment", etiqueta: "Experience Comments" },
      { clave: "coach_comment", etiqueta: "Coach Comments" },
      { clave: "razon_no_cuenta", etiqueta: "Non-Count Reason" },
    ],
    filtros: [
      { clave: "syllabus", etiqueta: "Syllabus" },
      { clave: "level", etiqueta: "Level" },
      { clave: "schedule", etiqueta: "Schedule" },
      { clave: "status", etiqueta: "Status" },
    ],
    busqueda: ["teacher_id", "teacher_name"],
    mapear: (fila, extra) => {
      if (!extra.mes) return { problema: "Falta el mes" };
      if (!extra.token) return { problema: "Falta el token" };
      const teacher = entero(primera(fila, ["teacher id", "id coach", "coach id"]));
      if (teacher === null) return { problema: "Falta Teacher ID" };
      return {
        registro: {
          token: extra.token,
          period_month: `${extra.mes}-01`,
          class_id: entero(primera(fila, ["class id", "clase", "clase id"])),
          teacher_id: teacher,
          teacher_name: texto(primera(fila, ["teacher name", "coach", "coach name"])),
          syllabus: texto(fila["syllabus"]),
          level: texto(fila["level"]),
          schedule: normalizarHorario(primera(fila, ["schedule", "horario"])),
          status: texto(fila["status"]),
          razon_no_cuenta: texto(
            primera(fila, ["non count reason", "non-count reason", "razon no cuenta"]),
          ),
          experience_comment: texto(
            primera(fila, ["experience comments", "experience comment"]),
          ),
          coach_score: numero(primera(fila, ["coach score", "score"])),
          coach_comment: texto(primera(fila, ["coach comments", "coach comment"])),
          applicable: 1,
        },
      };
    },
  },

  nl: {
    clave: "nl",
    titulo: "NL",
    campoFecha: "fecha",
    aceptar: ".csv,.xls,.xlsx",
    applicable: false,
    columnas: [
      { clave: "fecha", etiqueta: "Date" },
      { clave: "class_id", etiqueta: "Class ID", alineacion: "derecha" },
      { clave: "student_id", etiqueta: "Student ID", alineacion: "derecha" },
      { clave: "level", etiqueta: "Level" },
      { clave: "syllabus", etiqueta: "Syllabus" },
      { clave: "horario", etiqueta: "Schedule" },
      { clave: "evaluator", etiqueta: "Evaluator" },
      { clave: "resultado", etiqueta: "Result" },
    ],
    filtros: [
      { clave: "syllabus", etiqueta: "Syllabus" },
      { clave: "level", etiqueta: "Level" },
      { clave: "horario", etiqueta: "Schedule" },
      { clave: "resultado", etiqueta: "Result" },
    ],
    busqueda: ["coach_id", "coach"],
    mapear: (fila) => {
      const f = fecha(primera(fila, ["fecha", "date", "class date"]));
      if (!f) return { problema: "Fecha inválida" };
      const clase = entero(primera(fila, ["class id", "clase", "clase id"]));
      if (clase === null) return { problema: "Falta Class ID" };
      const resultado = texto(primera(fila, ["resultado", "result", "status"]));
      return {
        registro: {
          fecha: f,
          class_id: clase,
          syllabus: texto(fila["syllabus"]),
          coach_id: entero(primera(fila, ["coach id", "id coach", "teacher id"])),
          coach: texto(primera(fila, ["coach", "coach name"])),
          horario: normalizarHorario(primera(fila, ["horario", "schedule"])),
          level: texto(fila["level"]),
          student_id: entero(primera(fila, ["student id", "id student"])),
          student: texto(primera(fila, ["student", "student name"])),
          evaluator: texto(primera(fila, ["evaluator", "evaluado por"])),
          resultado: resultado
            ? resultado.charAt(0).toUpperCase() + resultado.slice(1).toLowerCase()
            : null,
        },
      };
    },
  },

  abs: {
    clave: "abs",
    titulo: "Abs",
    campoFecha: "fecha",
    aceptar: ".xls,.xlsx",
    applicable: true,
    columnas: [
      { clave: "fecha", etiqueta: "Date" },
      { clave: "class_id", etiqueta: "Class ID", alineacion: "derecha" },
      { clave: "syllabus", etiqueta: "Syllabus" },
      { clave: "coach_id", etiqueta: "Coach ID", alineacion: "derecha" },
      { clave: "coach", etiqueta: "Coach Name" },
    ],
    filtros: [{ clave: "syllabus", etiqueta: "Syllabus" }],
    busqueda: ["coach_id", "coach"],
    mapear: (fila) => {
      const f = fecha(primera(fila, ["fecha", "date"]));
      if (!f) return { problema: "Fecha inválida" };
      const clase = entero(primera(fila, ["class id", "clase", "clase id"]));
      if (clase === null) return { problema: "Falta Class ID" };
      return {
        registro: {
          fecha: f,
          class_id: clase,
          syllabus: texto(fila["syllabus"]),
          horario: normalizarHorario(primera(fila, ["horario", "schedule"])),
          level: texto(fila["level"]),
          coach_id: entero(primera(fila, ["coach id", "id coach", "teacher id"])),
          coach: texto(primera(fila, ["coach", "coach name"])),
          applicable: 1,
        },
      };
    },
  },

  lateness: {
    clave: "lateness",
    titulo: "Lateness",
    campoFecha: "fecha",
    aceptar: ".csv,.xls,.xlsx",
    applicable: false,
    reemplazarRango: true,
    columnas: [
      { clave: "fecha", etiqueta: "Date" },
      { clave: "teacher_name", etiqueta: "Teacher" },
      { clave: "coordinator", etiqueta: "Coordinator" },
      { clave: "senior", etiqueta: "Senior" },
      { clave: "teacher_id", etiqueta: "Teacher ID", alineacion: "derecha" },
      { clave: "late_count", etiqueta: "Late Count", alineacion: "derecha" },
    ],
    filtros: [
      { clave: "coordinator", etiqueta: "Coordinator" },
      { clave: "senior", etiqueta: "Senior" },
    ],
    busqueda: ["teacher_id", "teacher_name", "coordinator", "senior"],
    mapear: (fila) => {
      const f = fecha(primera(fila, ["fecha", "date"]));
      if (!f) return { problema: "Fecha inválida" };
      const teacher = entero(primera(fila, ["teacher id", "id coach", "coach id"]));
      if (teacher === null) return { problema: "Falta Teacher ID" };
      return {
        registro: {
          fecha: f,
          teacher_id: teacher,
          teacher_name: texto(primera(fila, ["teacher", "teacher name", "coach"])),
          coordinator: texto(primera(fila, ["coordinator", "coordinador"])),
          senior: texto(primera(fila, ["senior", "level2 leader"])),
          late_count: 1,
        },
      };
    },
    agrupar: (registros) => {
      const mapa = new Map<string, Record<string, unknown>>();
      for (const r of registros) {
        const k = `${r["teacher_id"]}|${r["fecha"]}`;
        const previo = mapa.get(k);
        if (previo) previo["late_count"] = (previo["late_count"] as number) + 1;
        else mapa.set(k, { ...r });
      }
      return [...mapa.values()];
    },
  },
};
