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

const entradaLista = z.object({
  tabla: tablaSchema,
  desde: z.string().max(10),
  hasta: z.string().max(10),
});

export const listarAcademico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaLista.parse(input))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cfg = TABLAS[data.tabla as ClaveTabla];

    const filas = await todasLasFilas<any>(() =>
      supabaseAdmin
        .from(cfg.nombre)
        .select("*")
        .gte(cfg.fecha, data.desde)
        .lte(cfg.fecha, data.hasta)
        .order(cfg.fecha, { ascending: false }),
    );

    return filas;
  });

const entradaCarga = z.object({
  tabla: tablaSchema,
  filas: z.array(z.record(z.string(), z.any())).min(1).max(20000),
  reemplazarRango: z.boolean().optional(),
  desde: z.string().max(10).optional(),
  hasta: z.string().max(10).optional(),
});

const claveDe = (fila: any, campos: readonly string[]) =>
  campos.map((c) => String(fila[c] ?? "")).join("|");

export const cargarAcademico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaCarga.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cfg = TABLAS[data.tabla as ClaveTabla];

    // Solo se guardan las columnas conocidas de cada tabla.
    const limpias = data.filas.map((f) => {
      const salida: Record<string, unknown> = {};
      for (const col of cfg.columnas) if (f[col] !== undefined) salida[col] = f[col];
      return salida;
    });

    // Duplicados dentro del mismo archivo.
    const vistas = new Set<string>();
    const unicas = limpias.filter((f) => {
      const k = claveDe(f, cfg.clave);
      if (vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });

    let omitidas = limpias.length - unicas.length;

    if (data.reemplazarRango && data.desde && data.hasta) {
      const { error } = await supabaseAdmin
        .from(cfg.nombre)
        .delete()
        .gte(cfg.fecha, data.desde)
        .lte(cfg.fecha, data.hasta);
      if (error) throw new Error(error.message);
    } else {
      // Duplicados contra lo que ya está guardado.
      const fechas = unicas.map((f) => String(f[cfg.fecha] ?? "")).filter(Boolean).sort();
      if (fechas.length) {
        const existentes = await todasLasFilas<any>(() =>
          supabaseAdmin
            .from(cfg.nombre)
            .select(cfg.clave.join(", "))
            .gte(cfg.fecha, fechas[0])
            .lte(cfg.fecha, fechas[fechas.length - 1]),
        );
        const conocidas = new Set(existentes.map((f) => claveDe(f, cfg.clave)));
        const antes = unicas.length;
        for (let i = unicas.length - 1; i >= 0; i--) {
          if (conocidas.has(claveDe(unicas[i], cfg.clave))) unicas.splice(i, 1);
        }
        omitidas += antes - unicas.length;
      }
    }

    let insertadas = 0;
    for (let i = 0; i < unicas.length; i += 500) {
      const lote = unicas.slice(i, i + 500);
      const { error } = await (supabaseAdmin.from(cfg.nombre) as any).insert(lote);
      if (error) throw new Error(error.message);
      insertadas += lote.length;
    }

    await supabaseAdmin.from("auditoria").insert({
      actor_id: actor.id,
      accion: "carga_academica",
      detalle: { tabla: cfg.nombre, insertadas, omitidas },
    });

    return { insertadas, omitidas };
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
