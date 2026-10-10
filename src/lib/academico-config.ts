import { entero, fecha, fechaDiaMes, invalido, leerHojaRetencion, leerHojasIncidencias, normalizarHorario, numero, texto } from "@/lib/hoja-calculo";
import { categoriaRetencion, cuentaIncidencia, idCoachBase, type OrigenIncidencia } from "@/lib/reglas";

/** Escalas observadas en los archivos reales: QA y CSAT van de 0 a 10. */
export const ESCALA_NOTA = { min: 0, max: 10 } as const;
const fueraDeEscala = (n: number | null) => n !== null && (n < ESCALA_NOTA.min || n > ESCALA_NOTA.max);

export type ClaveTabla = "qa" | "dsat" | "nl" | "abs" | "lateness" | "retention";

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
  encabezadosRequeridos?: string[];
  /** Convierte una fila del archivo en un registro guardable. */
  mapear: (fila: Record<string, unknown>, extra: Extra) => ResultadoFila;
  /** Lector propio del archivo (Incidencias lee dos hojas RAW). */
  leer?: (archivo: File) => Promise<Record<string, unknown>[]>;
  /** El rango a reemplazar sale de las fechas del archivo, no de Desde/Hasta. */
  rangoDesdeArchivo?: boolean;
  /** Agrupa las filas ya mapeadas (solo lo usa Lateness). */
  /** El mes se intenta detectar en el nombre del archivo. */
  detectarMes?: boolean;
  agrupar?: (registros: Record<string, unknown>[]) => Record<string, unknown>[];
}

const primera = (fila: Record<string, unknown>, nombres: string[]) => {
  for (const n of nombres) if (fila[n] !== undefined && fila[n] !== null) return fila[n];
  return null;
};

/** Busca una columna por un fragmento de su encabezado (para títulos largos). */
const porFragmento = (fila: Record<string, unknown>, fragmento: string) => {
  for (const [k, v] of Object.entries(fila)) if (k.includes(fragmento)) return v;
  return null;
};

/** Fecha con hora en formato ISO, para columnas de marca de tiempo. */
const marca = (valor: unknown): string | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString();
  const d = new Date(String(valor));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const CONFIGS: Record<ClaveTabla, ConfigPestana> = {
  qa: {
    clave: "qa",
    titulo: "QA",
    campoFecha: "fecha_monitoreo",
    aceptar: ".csv,.xls,.xlsx",
    applicable: true,
    reemplazarRango: true,
    encabezadosRequeridos: ["CLAVE", "Id Coach", "Nota Final", "Fecha Monitoreo", "Type QA"],
    columnas: [
      { clave: "fecha_monitoreo", etiqueta: "Fecha Monitoreo" },
      { clave: "month", etiqueta: "Month" },
      { clave: "week", etiqueta: "Week" },
      { clave: "clave", etiqueta: "Clave" },
      { clave: "pais", etiqueta: "País" },
      { clave: "sucursal", etiqueta: "Sucursal" },
      { clave: "quality_type", etiqueta: "Quality Type" },
      { clave: "gerente", etiqueta: "Gerente" },
      { clave: "coach_id", etiqueta: "Id Coach", alineacion: "derecha" },
      { clave: "coach", etiqueta: "Coach" },
      { clave: "nota_final", etiqueta: "Nota Final", alineacion: "derecha" },
      { clave: "level", etiqueta: "Level" },
      { clave: "horario", etiqueta: "Horario" },
      { clave: "fecha_ingresado", etiqueta: "Fecha Ingresado" },
      { clave: "type_monitoreo", etiqueta: "Type Monitoreo" },
      { clave: "evaluating_time", etiqueta: "Evaluating Time", alineacion: "derecha" },
      { clave: "area_mejora", etiqueta: "Área de mejora" },
      { clave: "type_qa", etiqueta: "Type QA" },
      { clave: "gerente2", etiqueta: "Gerente2" },
      { clave: "nota_suc", etiqueta: "Nota Suc", alineacion: "derecha" },
      { clave: "feedback_type", etiqueta: "Feedback Type" },
      { clave: "comentario", etiqueta: "Comentario" },
    ],
    filtros: [
      { clave: "pais", etiqueta: "País" },
      { clave: "sucursal", etiqueta: "Sucursal" },
      { clave: "level", etiqueta: "Level" },
      { clave: "horario", etiqueta: "Horario" },
      { clave: "type_qa", etiqueta: "Type QA" },
      { clave: "feedback_type", etiqueta: "Feedback Type" },
    ],
    busqueda: ["coach_id", "coach", "clave", "gerente"],
    mapear: (fila) => {
      const mesArchivo = fila["month"];
      const f = fechaDiaMes(
        primera(fila, ["fecha monitoreo", "fecha ingresado"]),
        mesArchivo,
      );
      if (!f) return { problema: "Fecha Monitoreo inválida" };
      const crudoCoach = primera(fila, ["id coach", "coach id"]);
      const coachId = entero(crudoCoach);
      if (coachId === null) return { problema: invalido(crudoCoach, coachId) ? "Id Coach inválido" : "Falta Id Coach" };
      const nota = numero(fila["nota final"]);
      if (invalido(fila["nota final"], nota) || fueraDeEscala(nota)) return { problema: "Nota Final inválida" };
      // Nota Suc no participa en el promedio de QA: texto como "NOTA SUC" o "N/A" se guarda vacío sin descartar la evaluación.
      const notaSuc = numero(fila["nota suc"]);
      return {
        registro: {
          month: texto(fila["month"]),
          week: texto(fila["week"]),
          clave: texto(fila["clave"]),
          pais: texto(primera(fila, ["pais", "país"])),
          sucursal: texto(fila["sucursal"]),
          quality_type: texto(fila["quality type"]),
          gerente: texto(fila["gerente"]),
          coach_id: coachId,
          coach: texto(fila["coach"]),
          nota_final: nota,
          level: texto(fila["level"]),
          horario: normalizarHorario(fila["horario"]),
          fecha_ingresado: fechaDiaMes(fila["fecha ingresado"], mesArchivo),
          type_monitoreo: texto(fila["type monitoreo"]),
          fecha_monitoreo: f,
          evaluating_time: numero(fila["evaluating time"]),
          area_mejora: texto(fila["area de mejora"]),
          type_qa: texto(fila["type qa"]),
          gerente2: texto(primera(fila, ["gerente2", "gerente.1", "gerente_1"])),
          nota_suc: notaSuc,
          feedback_type: texto(fila["feedback type"]),
          comentario: texto(fila["comentario"]),
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
    reemplazarRango: true,
    columnas: [
      { clave: "period_month", etiqueta: "Mes" },
      { clave: "submitted_at", etiqueta: "Submitted At" },
      { clave: "token", etiqueta: "Token" },
      { clave: "student_id", etiqueta: "Id Student", alineacion: "derecha" },
      { clave: "trainee_name", etiqueta: "Trainee Name" },
      { clave: "teacher_id", etiqueta: "Id Coach", alineacion: "derecha" },
      { clave: "evaluating_coach", etiqueta: "Evaluating Coach" },
      { clave: "tenure", etiqueta: "Tenure" },
      { clave: "coach_score", etiqueta: "CSAT Coach Score", alineacion: "derecha" },
      { clave: "coach_comment", etiqueta: "Coach Comment" },
      { clave: "aplica_coach", etiqueta: "Aplica Coach" },
      { clave: "bist_score", etiqueta: "BIST Score", alineacion: "derecha" },
      { clave: "instalaciones_score", etiqueta: "Instalaciones Score", alineacion: "derecha" },
      { clave: "experiencia_score", etiqueta: "Experiencia", alineacion: "derecha" },
      { clave: "experiencia_comment", etiqueta: "Razón de la nota" },
      { clave: "pais", etiqueta: "País" },
      { clave: "sucursal", etiqueta: "Sucursal" },
      { clave: "curso", etiqueta: "Curso" },
      { clave: "salon", etiqueta: "Salón" },
      { clave: "nivel", etiqueta: "Nivel" },
      { clave: "horario", etiqueta: "Horario" },
      { clave: "coach_asignado", etiqueta: "Coach Asignado" },
      { clave: "inscritos", etiqueta: "Inscritos", alineacion: "derecha" },
      { clave: "csat_type", etiqueta: "CSAT Type" },
      { clave: "coordinador", etiqueta: "Coordinador" },
      { clave: "linea_negocio", etiqueta: "Línea Negocio" },
    ],
    filtros: [
      { clave: "aplica_coach", etiqueta: "Aplica Coach" },
      { clave: "curso", etiqueta: "Curso" },
      { clave: "nivel", etiqueta: "Nivel" },
      { clave: "horario", etiqueta: "Horario" },
      { clave: "csat_type", etiqueta: "CSAT Type" },
      { clave: "linea_negocio", etiqueta: "Línea Negocio" },
    ],
    busqueda: ["teacher_id", "evaluating_coach", "trainee_name", "token"],
    mapear: (fila, extra) => {
      if (!extra.mes) return { problema: "Falta el mes" };
      const crudoTeacher = primera(fila, ["idcoach", "id coach", "coach id"]);
      const teacher = entero(crudoTeacher);
      if (teacher === null) return { problema: invalido(crudoTeacher, teacher) ? "IDCOACH inválido" : "Falta IDCOACH" };
      const score = numero(fila["csat coach score"]);
      if (invalido(fila["csat coach score"], score) || fueraDeEscala(score))
        return { problema: "CSAT Coach Score inválido" };
      if (invalido(fila["submitted at"], marca(fila["submitted at"]))) return { problema: "Submitted At inválido" };
      return {
        registro: {
          period_month: `${extra.mes}-01`,
          submitted_at: marca(fila["submitted at"]),
          coach_aplica: texto(fila["coach aplica"]),
          tenure_aplica: texto(fila["tenure aplica"]),
          student_id: entero(primera(fila, ["idstudent", "student id"])),
          evaluating_coach: texto(fila["evaluating coach"]),
          diferenciador_coach: texto(fila["diferenciador coach"]),
          tenure: texto(fila["tenure"]),
          coach_score: score,
          coach_comment: texto(fila["coach comment"]),
          categoria: texto(fila["categoria"]),
          sub_categoria: texto(fila["sub-categoria"]),
          razon_escalar: texto(fila["razon para escalar"]),
          comment_escalar: texto(fila["comment para escalar"]),
          aplica_coach: texto(primera(fila, ["aplica coach", "aplica o no coach"])),
          razon_no_aplica: texto(fila["razon no aplica a coach"]),
          bist_score: numero(fila["csat bist score"]),
          bist_comment: texto(fila["bist comment"]),
          instalaciones_score: numero(fila["csat instalaciones score"]),
          instalaciones_comment: texto(fila["instalaciones comment"]),
          experiencia_score: numero(porFragmento(fila, "como dirias que fue tu experiencia")),
          experiencia_comment: texto(porFragmento(fila, "cuentanos la razon de tu nota")),
          token: texto(fila["token"]),
          trainee_name: texto(fila["trainee name"]),
          idcontrol: entero(fila["idcontrol"]),
          pais: texto(primera(fila, ["pais sucursal", "pais"])),
          sucursal: texto(fila["sucursal"]),
          curso: texto(fila["curso"]),
          salon: texto(fila["salon"]),
          nivel: texto(fila["nivel"]),
          horario: normalizarHorario(fila["horario"]),
          coach_asignado: texto(
            primera(fila, [
              "coach asignado al salon (reporte clases)",
              "coach asignado al salon",
            ]),
          ),
          inscritos: entero(fila["inscritos"]),
          csat_type: texto(fila["csat type"]),
          teacher_id: teacher,
          coordinador: texto(fila["coordinador"]),
          linea_negocio: texto(fila["linea negocio"]),
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
      const crudoClase = primera(fila, ["class id", "clase", "clase id"]);
      const clase = entero(crudoClase);
      if (clase === null) return { problema: invalido(crudoClase, clase) ? "Class ID inválido" : "Falta Class ID" };
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
    reemplazarRango: true,
    columnas: [
      { clave: "fecha", etiqueta: "Fecha" },
      { clave: "curso", etiqueta: "Curso" },
      { clave: "sucursal", etiqueta: "Sucursal" },
      { clave: "pais", etiqueta: "Pais" },
      { clave: "anio", etiqueta: "Año", alineacion: "derecha" },
      { clave: "mes", etiqueta: "Mes" },
      { clave: "week", etiqueta: "Week", alineacion: "derecha" },
      { clave: "horarios", etiqueta: "Horarios" },
      { clave: "motivo", etiqueta: "Motivo" },
      { clave: "otros_motivos", etiqueta: "Otros Motivos" },
      { clave: "otros_motivos_2", etiqueta: "Otros Motivos 2" },
      { clave: "coordinador", etiqueta: "Coordinador" },
      { clave: "coach_id", etiqueta: "Id Coach", alineacion: "derecha" },
      { clave: "coach_asignado", etiqueta: "Coach Asignado" },
      { clave: "coach_cubre", etiqueta: "Coach que cubre" },
      { clave: "horas_asignadas", etiqueta: "Horas Asignadas", alineacion: "derecha" },
      { clave: "notas", etiqueta: "Notas" },
      { clave: "whodidit", etiqueta: "Whodidit" },
      { clave: "tipo", etiqueta: "Tipo" },
    ],
    filtros: [
      { clave: "pais", etiqueta: "Pais" },
      { clave: "sucursal", etiqueta: "Sucursal" },
      { clave: "curso", etiqueta: "Curso" },
      { clave: "motivo", etiqueta: "Motivo" },
      { clave: "tipo", etiqueta: "Tipo" },
    ],
    busqueda: ["coach_id", "coach_asignado", "coach_cubre", "coordinador"],
    leer: leerHojasIncidencias,
    rangoDesdeArchivo: true,
    mapear: (fila) => {
      const origen = (fila["__origen"] ?? "ONSITE") as OrigenIncidencia;
      const categoria = primera(fila, ["otros motivos", "otros motivos 2"]);
      // Solo se guardan las filas cuya categoría cuenta como incidencia; el resto se ignora.
      if (!cuentaIncidencia(origen, categoria) && !cuentaIncidencia(origen, fila["otros motivos 2"])) return {};
      const f = fecha(fila["fecha"]);
      if (!f) return { problema: "Fecha inválida (se omite)" };
      const crudoCoach = primera(fila, ["id coach", "coach id", "id"]);
      const id = entero(crudoCoach);
      if (id === null || id <= 0) return { problema: `Sin Id Coach válido (${texto(fila["coach asignado"]) ?? "sin nombre"}, se omite)` };
      const coachId = idCoachBase(id);
      return {
        registro: {
          curso: texto(fila["curso"]),
          sucursal: texto(fila["sucursal"]),
          pais: texto(primera(fila, ["pais", "país"])),
          anio: entero(primera(fila, ["ano", "año", "year"])),
          fecha: f,
          mes: texto(fila["mes"]),
          week: entero(fila["week"]),
          horarios: normalizarHorario(primera(fila, ["horarios", "horario"])),
          motivo: texto(fila["motivo"]),
          otros_motivos: texto(fila["otros motivos"]),
          otros_motivos_2: texto(fila["otros motivos 2"]),
          coordinador: texto(fila["coordinador"]),
          coach_id: coachId,
          coach_asignado: texto(fila["coach asignado"]),
          coach_cubre: texto(fila["coach que cubre"]),
          horas_asignadas: numero(fila["horas asignadas"]),
          notas: texto(fila["notas"]),
          whodidit: texto(fila["whodidit"]),
          fecha_ingreso: marca(fila["fecha ingreso"]),
          fecha_modificacion: marca(fila["fecha modificacion"]),
          tipo: texto(fila["tipo"]) ?? origen,
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
      const crudoTeacher = primera(fila, ["teacher id", "id coach", "coach id"]);
      const teacher = entero(crudoTeacher);
      if (teacher === null) return { problema: invalido(crudoTeacher, teacher) ? "Teacher ID inválido" : "Falta Teacher ID" };
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

  retention: {
    clave: "retention",
    titulo: "Retention",
    campoFecha: "period_month",
    aceptar: ".xls,.xlsx",
    applicable: false,
    reemplazarRango: true,
    requiereMes: true,
    detectarMes: true,
    rangoDesdeArchivo: true,
    leer: leerHojaRetencion,
    columnas: [
      { clave: "period_month", etiqueta: "Mes" },
      { clave: "country", etiqueta: "Country" },
      { clave: "sucursal", etiqueta: "Sucursal" },
      { clave: "coach_id", etiqueta: "Id Coach", alineacion: "derecha" },
      { clave: "coach", etiqueta: "Coach" },
      { clave: "do_count", etiqueta: "DO", alineacion: "derecha" },
      { clave: "active_students", etiqueta: "Active Student", alineacion: "derecha" },
      { clave: "do_pct", etiqueta: "DO %", alineacion: "derecha" },
      { clave: "retention_pct", etiqueta: "Retention %", alineacion: "derecha" },
      { clave: "clv", etiqueta: "CLV", alineacion: "derecha" },
      { clave: "category", etiqueta: "Category" },
    ],
    filtros: [
      { clave: "country", etiqueta: "Country" },
      { clave: "sucursal", etiqueta: "Sucursal" },
      { clave: "category", etiqueta: "Category" },
    ],
    busqueda: ["coach_id", "coach"],
    mapear: (fila, extra) => {
      const crudo = primera(fila, ["id coach", "coach id", "id_coach"]);
      if (crudo === null || crudo === "") return {};
      const id = entero(crudo);
      if (id === null || id <= 0) return { problema: `Id Coach inválido (${texto(fila["coach"]) ?? "sin nombre"})` };
      if (!extra.mes) return { problema: "Falta el mes del archivo" };
      // Porcentajes del libro vienen como fracción (0.8928) y se guardan en 0–100.
      const pct = (v: unknown) => {
        const n = numero(v);
        return n === null ? null : n * 100;
      };
      const retencion = pct(fila["retention"]);
      const categoria = texto(primera(fila, ["category", "categoria"]))?.toUpperCase() ?? categoriaRetencion(retencion);
      return {
        registro: {
          period_month: `${extra.mes}-01`,
          coach_id: id,
          coach: texto(fila["coach"]),
          country: texto(primera(fila, ["country", "pais"])),
          sucursal: texto(fila["sucursal"]),
          do_count: numero(fila["do"]),
          active_students: numero(primera(fila, ["active student", "active students"])),
          do_pct: pct(fila["do %"]),
          retention_pct: retencion,
          fc_do: numero(fila["fc do"]),
          fc_do_pct: pct(fila["fc do%"]),
          clv: numero(fila["clv"]),
          category: categoria,
        },
      };
    },
  },
};
