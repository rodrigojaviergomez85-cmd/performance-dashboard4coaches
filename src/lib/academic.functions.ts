import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Academic Performance: carga y mantenimiento de los archivos académicos.
 * Todo es exclusivo de administración y se valida en el servidor en cada
 * llamada. El navegador nunca consulta estas tablas directamente.
 */

const TABLAS = {
  qa: {
    nombre: "qa_evaluaciones",
    fecha: "fecha_monitoreo",
    clave: ["clave", "coach_id", "fecha_monitoreo", "type_qa"],
    columnas: [
      "month",
      "week",
      "clave",
      "pais",
      "sucursal",
      "quality_type",
      "gerente",
      "coach_id",
      "coach",
      "nota_final",
      "level",
      "horario",
      "fecha_ingresado",
      "type_monitoreo",
      "fecha_monitoreo",
      "evaluating_time",
      "area_mejora",
      "type_qa",
      "gerente2",
      "nota_suc",
      "feedback_type",
      "comentario",
      "applicable",
    ],
  },
  dsat: {
    nombre: "csat_respuestas",
    fecha: "period_month",
    clave: ["token", "student_id", "teacher_id", "period_month", "submitted_at"],
    columnas: [
      "period_month",
      "submitted_at",
      "coach_aplica",
      "tenure_aplica",
      "student_id",
      "evaluating_coach",
      "diferenciador_coach",
      "tenure",
      "coach_score",
      "coach_comment",
      "categoria",
      "sub_categoria",
      "razon_escalar",
      "comment_escalar",
      "aplica_coach",
      "razon_no_aplica",
      "bist_score",
      "bist_comment",
      "instalaciones_score",
      "instalaciones_comment",
      "experiencia_score",
      "experiencia_comment",
      "token",
      "trainee_name",
      "idcontrol",
      "pais",
      "sucursal",
      "curso",
      "salon",
      "nivel",
      "horario",
      "coach_asignado",
      "inscritos",
      "csat_type",
      "teacher_id",
      "coordinador",
      "linea_negocio",
    ],
  },
  nl: {
    nombre: "nl_evals",
    fecha: "fecha",
    clave: ["class_id", "fecha", "student_id", "evaluator"],
    columnas: [
      "fecha",
      "class_id",
      "syllabus",
      "coach_id",
      "coach",
      "horario",
      "level",
      "student_id",
      "student",
      "evaluator",
      "resultado",
    ],
  },
  abs: {
    nombre: "incidencias",
    fecha: "fecha",
    clave: ["fecha", "coach_id", "horarios", "curso", "tipo"],
    columnas: [
      "curso",
      "sucursal",
      "pais",
      "anio",
      "fecha",
      "mes",
      "week",
      "horarios",
      "motivo",
      "otros_motivos",
      "otros_motivos_2",
      "coordinador",
      "coach_id",
      "coach_asignado",
      "coach_cubre",
      "horas_asignadas",
      "notas",
      "whodidit",
      "fecha_ingreso",
      "fecha_modificacion",
      "tipo",
      "applicable",
    ],
  },
  lateness: {
    nombre: "lateness",
    fecha: "fecha",
    clave: ["teacher_id", "fecha"],
    columnas: ["fecha", "teacher_id", "teacher_name", "coordinator", "senior", "late_count"],
  },
} as const;

type ClaveTabla = keyof typeof TABLAS;

async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("coaches")
    .select("id, rol, activo")
    .eq("auth_user_id", context.userId)
    .maybeSingle();

  if (!data || !data.activo || data.rol !== "admin") {
    throw new Error("Acceso restringido a administración.");
  }
  return data as { id: string };
}

async function todasLasFilas<T>(construir: () => any): Promise<T[]> {
  const total: T[] = [];
  const tamano = 1000;
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await construir()
      .order("id", { ascending: true })
      .range(desde, desde + tamano - 1);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as T[];
    total.push(...lote);
    if (lote.length < tamano) break;
  }
  return total;
}

const tablaSchema = z.enum(["qa", "dsat", "nl", "abs", "lateness"]);

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nota = z.number().min(0).max(10).nullable();
const id = z.number().int().nullable();
const txt = z.string().max(4000).nullable();

/** Esquemas por tabla: campos requeridos, IDs, fechas y escalas (0 a 10). */
const ESQUEMAS = {
  qa: z.object({
    fecha_monitoreo: fechaIso,
    fecha_ingresado: fechaIso.nullable(),
    coach_id: z.number().int(),
    nota_final: nota,
    nota_suc: z.number().nullable(),
    evaluating_time: z.number().nullable(),
    applicable: z.union([z.literal(0), z.literal(1)]),
  }).catchall(txt),
  dsat: z.object({
    period_month: fechaIso,
    teacher_id: z.number().int(),
    coach_score: nota,
    bist_score: nota,
    instalaciones_score: nota,
    experiencia_score: nota,
    student_id: id,
    idcontrol: id,
    inscritos: id,
  }).catchall(txt),
  nl: z.object({
    fecha: fechaIso,
    class_id: z.number().int(),
    coach_id: id,
    student_id: id,
  }).catchall(txt),
  abs: z.object({
    fecha: fechaIso,
    coach_id: z.number().int(),
    anio: id,
    week: id,
    horas_asignadas: z.number().nullable(),
    applicable: z.union([z.literal(0), z.literal(1)]),
  }).catchall(txt),
  lateness: z.object({
    fecha: fechaIso,
    teacher_id: z.number().int(),
    late_count: z.number().int().min(1),
  }).catchall(txt),
} as const;

const entradaLista = z.object({
  tabla: tablaSchema,
  desde: fechaIso,
  hasta: fechaIso,
  busqueda: z.string().max(120).default(""),
  filtros: z.record(z.string().max(60), z.array(z.string().max(300)).max(200)).default({}),
  pagina: z.number().int().min(0).max(100000).default(0),
  porPagina: z.number().int().min(10).max(200).default(50),
});

/** Columnas por las que se puede filtrar y buscar en cada tabla. */
const FILTRABLES: Record<ClaveTabla, { filtros: string[]; texto: string[]; numero: string[] }> = {
  qa: { filtros: ["pais", "sucursal", "level", "horario", "type_qa", "feedback_type"], texto: ["coach", "clave", "gerente"], numero: ["coach_id"] },
  dsat: { filtros: ["aplica_coach", "curso", "nivel", "horario", "csat_type", "linea_negocio"], texto: ["evaluating_coach", "trainee_name", "token"], numero: ["teacher_id"] },
  nl: { filtros: ["syllabus", "level", "horario", "resultado"], texto: ["coach"], numero: ["coach_id"] },
  abs: { filtros: ["pais", "sucursal", "curso", "motivo", "tipo"], texto: ["coach_asignado", "coach_cubre", "coordinador"], numero: ["coach_id"] },
  lateness: { filtros: ["coordinator", "senior"], texto: ["teacher_name", "coordinator", "senior"], numero: ["teacher_id"] },
};

const paraIlike = (t: string) => t.replace(/[%_\\,()."*]/g, " ").trim();

export const listarAcademico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaLista.parse(input))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tabla = data.tabla as ClaveTabla;
    const cfg = TABLAS[tabla];
    const permitidos = FILTRABLES[tabla];

    let consulta: any = supabaseAdmin
      .from(cfg.nombre)
      .select("*", { count: "exact" })
      .gte(cfg.fecha, data.desde)
      .lte(cfg.fecha, data.hasta);

    for (const [columna, valores] of Object.entries(data.filtros)) {
      if (!valores.length || !permitidos.filtros.includes(columna)) continue;
      const conVacio = valores.includes("");
      const llenos = valores.filter((v) => v !== "");
      if (conVacio && llenos.length) consulta = consulta.or(`${columna}.is.null,${columna}.in.(${llenos.map((v) => `"${v.replace(/"/g, "")}"`).join(",")})`);
      else if (conVacio) consulta = consulta.is(columna, null);
      else consulta = consulta.in(columna, llenos);
    }

    const texto = paraIlike(data.busqueda);
    if (texto) {
      const partes = permitidos.texto.map((c) => `${c}.ilike.*${texto}*`);
      if (/^\d+$/.test(texto)) partes.push(...permitidos.numero.map((c) => `${c}.eq.${texto}`));
      consulta = consulta.or(partes.join(","));
    }

    const desde = data.pagina * data.porPagina;
    const { data: filas, count, error } = await consulta
      .order(cfg.fecha, { ascending: false })
      .order("id", { ascending: true })
      .range(desde, desde + data.porPagina - 1);
    if (error) throw new Error(error.message);

    return {
      filas: (filas ?? []) as Record<string, string | number | null>[],
      total: Number(count ?? 0),
    };
  });

const entradaOpciones = z.object({ tabla: tablaSchema, desde: fechaIso, hasta: fechaIso });

/** Valores distintos de las columnas filtrables del periodo (solo esas columnas). */
export const opcionesAcademico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaOpciones.parse(input))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tabla = data.tabla as ClaveTabla;
    const cfg = TABLAS[tabla];
    const columnas = FILTRABLES[tabla].filtros;
    const filas = await todasLasFilas<Record<string, unknown>>(() =>
      supabaseAdmin
        .from(cfg.nombre)
        .select(columnas.join(", "))
        .gte(cfg.fecha, data.desde)
        .lte(cfg.fecha, data.hasta),
    );
    const salida: Record<string, string[]> = {};
    for (const c of columnas) {
      salida[c] = [...new Set(filas.map((f) => f[c]).filter((v) => v != null && v !== "").map(String))].sort();
    }
    return salida;
  });

const entradaCarga = z.object({
  tabla: tablaSchema,
  filas: z.array(z.record(z.string(), z.any())).min(1).max(20000),
  reemplazarRango: z.boolean().optional(),
  desde: fechaIso,
  hasta: fechaIso,
});

const claveDe = (fila: any, campos: readonly string[]) =>
  campos.map((c) => String(fila[c] ?? "")).join("|");

export const cargarAcademico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaCarga.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await exigirAdmin(context);
    const tabla = data.tabla as ClaveTabla;
    const cfg = TABLAS[tabla];

    if (data.desde > data.hasta) {
      return { ok: false as const, errores: ["La fecha Desde debe ser anterior o igual a Hasta."] };
    }

    // Solo se guardan las columnas conocidas de cada tabla; faltantes = null.
    const limpias = data.filas.map((f) => {
      const salida: Record<string, unknown> = {};
      for (const col of cfg.columnas) salida[col] = f[col] === undefined ? null : f[col];
      return salida;
    });

    // Validación completa antes de tocar datos: errores por fila.
    const errores: string[] = [];
    const esquema = ESQUEMAS[tabla];
    limpias.forEach((fila, i) => {
      if (errores.length >= 50) return;
      const r = esquema.safeParse(fila);
      if (!r.success) {
        const p = r.error.issues[0]!;
        errores.push(`Fila ${i + 1}: ${p.path.join(".") || "registro"} — ${p.message}`);
        return;
      }
      const f = String(fila[cfg.fecha]);
      if (f < data.desde || f > data.hasta) {
        errores.push(`Fila ${i + 1}: la fecha ${f} está fuera del rango ${data.desde} a ${data.hasta}.`);
      }
    });
    if (errores.length) return { ok: false as const, errores };

    // Duplicados dentro del mismo archivo.
    const vistas = new Set<string>();
    const unicas = limpias.filter((f) => {
      const k = claveDe(f, cfg.clave);
      if (vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });

    // Lotes para no superar el tiempo máximo por instrucción; solo el primero reemplaza el rango.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const LOTE = 1000;
    const tot = { insertadas: 0, omitidas: 0, borradas: 0 };
    for (let i = 0; i === 0 || i < unicas.length; i += LOTE) {
      const { data: r, error } = await (supabaseAdmin as any).rpc("cargar_academico", {
        _tabla: tabla,
        _filas: unicas.slice(i, i + LOTE),
        _reemplazar: i === 0 ? (data.reemplazarRango ?? false) : false,
        _desde: data.desde,
        _hasta: data.hasta,
        _actor: actor.id,
      });
      if (error) {
        throw new Error(
          i === 0
            ? `No se guardó nada: ${error.message}`
            : `Carga incompleta (${tot.insertadas} filas guardadas). Vuelva a subir el archivo con "reemplazar": ${error.message}`,
        );
      }
      const res = r as { insertadas: number; omitidas: number; borradas: number };
      tot.insertadas += res.insertadas;
      tot.omitidas += res.omitidas;
      tot.borradas += res.borradas;
    }

    return {
      ok: true as const,
      insertadas: tot.insertadas,
      omitidas: tot.omitidas + (limpias.length - unicas.length),
      borradas: tot.borradas,
    };
  });

const entradaEliminar = z.object({ tabla: tablaSchema, id: z.string().uuid() });

export const eliminarAcademico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaEliminar.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cfg = TABLAS[data.tabla as ClaveTabla];

    const { error } = await supabaseAdmin.from(cfg.nombre).delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("auditoria").insert({
      actor_id: actor.id,
      accion: "eliminar_registro_academico",
      detalle: { tabla: cfg.nombre, id: data.id },
    });

    return { ok: true as const };
  });

const entradaApplicable = z.object({
  tabla: z.enum(["qa", "abs"]),
  id: z.string().uuid(),
  valor: z.number().int().min(0).max(1),
});

export const actualizarApplicable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaApplicable.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cfg = TABLAS[data.tabla as ClaveTabla];

    const { error } = await (supabaseAdmin.from(cfg.nombre) as any)
      .update({ applicable: data.valor })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("auditoria").insert({
      actor_id: actor.id,
      accion: "editar_applicable",
      detalle: { tabla: cfg.nombre, id: data.id, valor: data.valor },
    });

    return { ok: true as const };
  });
