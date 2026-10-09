import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { mesQaDeFecha, type PeriodoQa } from "@/lib/periodos-qa";
import {
  QA_ADVERTENCIA,
  QA_BLOQUEO,
  alertasPanel,
  calcularDsat,
  categoriaDsat as categoria,
  fraseQa,
  promedioQa,
  rangoQa,
  redondear2,
} from "@/lib/reglas";

/**
 * Todo el cálculo del panel vive aquí, en el servidor. El navegador nunca
 * consulta las tablas académicas: pide un resumen ya calculado y solo recibe
 * los datos del coach que tiene permitido ver.
 */

type Contexto = { supabase: any; userId: string };

type Perfil = {
  id: string;
  nombre: string;
  rol: string;
  coach_id: number;
  tenure: string | null;
  categoria: string | null;
};

async function perfilActual(context: Contexto): Promise<Perfil> {
  const { data } = await context.supabase
    .from("coaches")
    .select("id, nombre, rol, coach_id, tenure, categoria, activo")
    .eq("auth_user_id", context.userId)
    .maybeSingle();

  if (!data || !data.activo) throw new Error("Cuenta sin acceso.");
  return data as Perfil;
}

const puedeElegirCoach = (rol: string) => rol === "admin" || rol === "revisor";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const mesInicio = (y: number, m: number) => iso(new Date(Date.UTC(y, m - 1, 1)));

// QA se agrupa por período QA (no por mes calendario); se leen ~45 días extra a cada lado.
const qaDesde = (y: number) => `${y - 1}-11-15`;
const qaHasta = (y: number) => `${y + 1}-02-15`;
async function leerPeriodosQa(admin: any): Promise<PeriodoQa[]> {
  const { data, error } = await admin
    .from("qa_periods")
    .select("id, label, month, year, start_date, end_date")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return data ?? [];
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Lee todas las filas de una consulta, de 1000 en 1000. */
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

const entradaPanel = z.object({
  coachId: z.number().int().nullable().optional(),
  year: z.number().int().min(2000).max(2100),
  quarter: z.number().int().min(1).max(4),
});

/** Coach que se va a mostrar, según el rol. Un coach solo puede verse a sí mismo. */
async function coachObjetivo(context: Contexto, solicitado: number | null | undefined) {
  const perfil = await perfilActual(context);
  if (!puedeElegirCoach(perfil.rol) || solicitado == null || solicitado === perfil.coach_id) {
    return { perfil, coachId: perfil.coach_id, esPropio: true };
  }
  return { perfil, coachId: solicitado, esPropio: false };
}

export const panelDesempeno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaPanel.parse(input))
  .handler(async ({ data, context }) => {
    const { perfil, coachId } = await coachObjetivo(context, data.coachId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: parametros } = await supabaseAdmin
      .from("parametros")
      .select("umbral_superstar, umbral_great")
      .maybeSingle();

    const superstar = Number(parametros?.umbral_superstar ?? 0.06) * 100;
    const great = Number(parametros?.umbral_great ?? 0.12) * 100;

    const { data: coach } = await supabaseAdmin
      .from("coaches")
      .select("coach_id, nombre, tenure, categoria")
      .eq("coach_id", coachId)
      .maybeSingle();

    const inicioMes = (data.quarter - 1) * 3 + 1;
    const inicio = mesInicio(data.year, inicioMes);
    const fin = mesInicio(data.year, inicioMes + 3 > 12 ? 1 : inicioMes + 3);
    const finReal = inicioMes + 3 > 12 ? mesInicio(data.year + 1, 1) : fin;
    const inicioPrevio =
      inicioMes - 3 < 1 ? mesInicio(data.year - 1, inicioMes + 9) : mesInicio(data.year, inicioMes - 3);

    // DSAT del año completo: sirve para el trimestre y para la vista anual.
    const dsat = await todasLasFilas<{
      period_month: string;
      aplica_coach: string | null;
      tenure_aplica: string | null;
      coach_score: number | null;
    }>(
      () =>
        supabaseAdmin
          .from("csat_respuestas")
          .select("id, period_month, aplica_coach, tenure_aplica, coach_score")
          .eq("teacher_id", coachId)
          .gte("period_month", mesInicio(data.year, 1))
          .lt("period_month", mesInicio(data.year + 1, 1)),
    );

    const qa = await todasLasFilas<{ fecha_monitoreo: string; nota_final: number | null }>(() =>
      supabaseAdmin
        .from("qa_evaluaciones")
        .select("fecha_monitoreo, nota_final")
        .eq("coach_id", coachId)
        .eq("applicable", 1)
        .gte("fecha_monitoreo", qaDesde(data.year))
        .lt("fecha_monitoreo", qaHasta(data.year)),
    );
    const periodosQa = await leerPeriodosQa(supabaseAdmin);
    const qaMes = (f: string) => {
      const m = mesQaDeFecha(periodosQa, f);
      return m.year === data.year ? m.month : 0;
    };

    const abs = await todasLasFilas<{ fecha: string }>(() =>
      supabaseAdmin
        .from("incidencias")
        .select("fecha")
        .eq("coach_id", coachId)
        .eq("applicable", 1)
        .gte("fecha", mesInicio(data.year, 1))
        .lt("fecha", mesInicio(data.year + 1, 1)),
    );

    const nl = await todasLasFilas<{ fecha: string; resultado: string | null }>(() =>
      supabaseAdmin
        .from("nl_evals")
        .select("fecha, resultado")
        .eq("coach_id", coachId)
        .gte("fecha", mesInicio(data.year, 1))
        .lt("fecha", mesInicio(data.year + 1, 1)),
    );

    const tardanzas = await todasLasFilas<{ fecha: string; late_count: number }>(() =>
      supabaseAdmin
        .from("lateness")
        .select("fecha, late_count")
        .eq("teacher_id", coachId)
        .gte("fecha", inicioPrevio)
        .lt("fecha", finReal),
    );

    const mesDe = (f: string | null) => (f ? Number(f.slice(5, 7)) : 0);
    const enRango = (f: string | null) => !!f && f >= inicio && f < finReal;

    const dsatDeMes = (mes: number) => calcularDsat(dsat.filter((d) => mesDe(d.period_month) === mes));

    const meses = [0, 1, 2].map((n) => {
      const mes = inicioMes + n;
      const r = dsatDeMes(mes);
      return {
        etiqueta: MESES[mes - 1]!,
        mes,
        numerador: r.numerador,
        denominador: r.denominador,
        porcentaje: redondear2(r.porcentaje),
        categoria: categoria(r.porcentaje, superstar, great),
      };
    });

    const dsatTrimestre = calcularDsat(dsat.filter((d) => enRango(d.period_month)));
    const numTrimestre = dsatTrimestre.numerador;
    const denomTrimestre = dsatTrimestre.denominador;

    const qaTrimestre = promedioQa(
      qa
        .filter((q) => {
          const m = qaMes(q.fecha_monitoreo);
          return m >= inicioMes && m < inicioMes + 3;
        })
        .map((q) => q.nota_final),
    );

    const incidencias = new Set(abs.filter((a) => enRango(a.fecha)).map((a) => a.fecha)).size;

    const nlTrimestre = nl.filter((n) => enRango(n.fecha));
    const evaluadas = nlTrimestre.filter((n) => (n.resultado ?? "") !== "Pending").length;
    const aprobadas = nlTrimestre.filter((n) => n.resultado === "Approved").length;
    const nlPorcentaje = evaluadas === 0 ? null : redondear2((aprobadas * 100) / evaluadas);

    const sumaTardanzas = tardanzas
      .filter((t) => enRango(t.fecha))
      .reduce((a, t) => a + (t.late_count ?? 0), 0);
    const tardanzasPrevias = tardanzas
      .filter((t) => t.fecha >= inicioPrevio && t.fecha < inicio)
      .reduce((a, t) => a + (t.late_count ?? 0), 0);

    const anual = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const d = dsatDeMes(mes);
      const q = promedioQa(qa.filter((x) => qaMes(x.fecha_monitoreo) === mes).map((x) => x.nota_final));
      const filasNl = nl.filter((x) => mesDe(x.fecha) === mes);
      const ev = filasNl.filter((x) => (x.resultado ?? "") !== "Pending").length;
      const ap = filasNl.filter((x) => x.resultado === "Approved").length;
      return {
        mes,
        etiqueta: MESES[i]!,
        dsat: redondear2(d.porcentaje),
        categoria: categoria(d.porcentaje, superstar, great),
        qaFrase: fraseQa(q),
        qaRango: rangoQa(q),
        incidencias: new Set(abs.filter((a) => mesDe(a.fecha) === mes).map((a) => a.fecha)).size,
        tardanzas: tardanzas
          .filter((t) => mesDe(t.fecha) === mes && t.fecha.startsWith(String(data.year)))
          .reduce((a, t) => a + (t.late_count ?? 0), 0),
        nl: ev === 0 ? null : redondear2((ap * 100) / ev),
      };
    });

    return {
      puedeElegirCoach: puedeElegirCoach(perfil.rol),
      coach: {
        coach_id: coachId,
        nombre: coach?.nombre ?? "—",
        tenure: coach?.tenure ?? null,
        categoria: coach?.categoria ?? null,
      },
      year: data.year,
      quarter: data.quarter,
      umbrales: { superstar, great },
      meses,
      trimestre: {
        numerador: numTrimestre,
        denominador: denomTrimestre,
        porcentaje: redondear2(dsatTrimestre.porcentaje),
        // Categoría solo por DSAT. La elegibilidad de pago y la categoría final
        // (bloqueos, NL, mínimo de encuestas) siguen pendientes de confirmación.
        categoria: categoria(dsatTrimestre.porcentaje, superstar, great),
      },
      qa: {
        frase: fraseQa(qaTrimestre),
        rango: rangoQa(qaTrimestre),
        bloqueado: qaTrimestre !== null && qaTrimestre < QA_BLOQUEO,
        advertencia: qaTrimestre !== null && qaTrimestre >= QA_BLOQUEO && qaTrimestre < QA_ADVERTENCIA,
      },
      alertas: alertasPanel({
        hayDatos: denomTrimestre > 0 || qaTrimestre !== null || incidencias > 0 || nlTrimestre.length > 0,
        incidencias,
        qaBloqueado: qaTrimestre !== null && qaTrimestre < QA_BLOQUEO,
        qaAdvertencia: qaTrimestre !== null && qaTrimestre >= QA_BLOQUEO && qaTrimestre < QA_ADVERTENCIA,
      }),
      incidencias,
      tardanzas: sumaTardanzas,
      tardanzasPrevias,
      nl: nlPorcentaje,
      anual,
    };
  });

/** Lista de coaches para el selector. Solo administración y revisión. */
export const directorioCoaches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const perfil = await perfilActual(context);
    if (!puedeElegirCoach(perfil.rol)) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("coaches")
      .select("coach_id, nombre")
      .eq("activo", true)
      .eq("rol", "coach")
      .order("nombre", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as { coach_id: number; nombre: string }[];
  });

const entradaComentarios = z.object({
  coachId: z.number().int().nullable().optional(),
  year: z.number().int().min(2000).max(2100),
  quarter: z.number().int().min(1).max(4),
  mes: z.number().int().min(1).max(12).nullable().optional(),
  syllabus: z.string().max(120).nullable().optional(),
  clase: z.string().max(60).nullable().optional(),
  texto: z.string().max(200).nullable().optional(),
  pagina: z.number().int().min(0).max(10000).default(0),
  porPagina: z.number().int().min(10).max(100).default(25),
});

/** Escapa un texto para usarlo dentro de un filtro ilike de PostgREST. */
const paraIlike = (t: string) => t.replace(/[%_\\,()."]/g, " ").trim();

export const comentariosCsat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaComentarios.parse(input))
  .handler(async ({ data, context }) => {
    const { coachId } = await coachObjetivo(context, data.coachId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const inicioMes = (data.quarter - 1) * 3 + 1;
    const inicio = data.mes ? mesInicio(data.year, data.mes) : mesInicio(data.year, inicioMes);
    const ultimo = data.mes ?? inicioMes + 2;
    const fin = ultimo + 1 > 12 ? mesInicio(data.year + 1, 1) : mesInicio(data.year, ultimo + 1);

    // Opciones de filtro: solo dos columnas del trimestre completo.
    const trimestreFin =
      inicioMes + 3 > 12 ? mesInicio(data.year + 1, 1) : mesInicio(data.year, inicioMes + 3);
    const opciones = await todasLasFilas<{ curso: string | null; salon: string | null }>(() =>
      supabaseAdmin
        .from("csat_respuestas")
        .select("curso, salon")
        .eq("teacher_id", coachId)
        .gte("period_month", mesInicio(data.year, inicioMes))
        .lt("period_month", trimestreFin),
    );

    let consulta = supabaseAdmin
      .from("csat_respuestas")
      .select(
        "id, period_month, curso, salon, experiencia_comment, coach_comment, coach_score, aplica_coach, tenure_aplica, razon_no_aplica",
        { count: "exact" },
      )
      .eq("teacher_id", coachId)
      .gte("period_month", inicio)
      .lt("period_month", fin)
      .or("experiencia_comment.not.is.null,coach_comment.not.is.null");
    if (data.syllabus) consulta = consulta.eq("curso", data.syllabus);
    if (data.clase) consulta = consulta.eq("salon", data.clase);
    const texto = paraIlike(data.texto ?? "");
    if (texto) consulta = consulta.or(`experiencia_comment.ilike.*${texto}*,coach_comment.ilike.*${texto}*`);

    const desde = data.pagina * data.porPagina;
    const { data: filas, count, error } = await consulta
      .order("period_month", { ascending: false })
      .order("id", { ascending: true })
      .range(desde, desde + data.porPagina - 1);
    if (error) throw new Error(error.message);

    return {
      filas: (filas ?? []).map((f: any) => ({
        id: f.id,
        period_month: f.period_month,
        syllabus: f.curso,
        class_id: f.salon,
        experience_comment: f.experiencia_comment,
        coach_comment: f.coach_comment,
        coach_score: f.coach_score,
        cuenta: cuentaDsat(f),
        razon_no_cuenta:
          f.razon_no_aplica ??
          ((f.aplica_coach ?? "").trim() ? f.aplica_coach : !esMasDeUnaSemana(f.tenure_aplica) ? (f.tenure_aplica ?? "Sin tenure") : null),
      })),
      total: count ?? 0,
      pagina: data.pagina,
      porPagina: data.porPagina,
      syllabi: [...new Set(opciones.map((f) => f.curso).filter(Boolean) as string[])].sort(),
      clases: [...new Set(opciones.map((f) => f.salon).filter(Boolean) as string[])].sort(),
    };
  });

const entradaQa = z.object({
  coachId: z.number().int().nullable().optional(),
  year: z.number().int().min(2000).max(2100),
  quarter: z.number().int().min(1).max(4),
});

/** Detalle de QA: solo frases, nunca la nota numérica por registro. */
export const detalleQa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaQa.parse(input))
  .handler(async ({ data, context }) => {
    const { coachId } = await coachObjetivo(context, data.coachId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const inicioMes = (data.quarter - 1) * 3 + 1;

    const filas = await todasLasFilas<any>(() =>
      supabaseAdmin
        .from("qa_evaluaciones")
        .select(
          "id, fecha_monitoreo, clave, quality_type, level, horario, gerente, nota_final, area_mejora, applicable",
        )
        .eq("coach_id", coachId)
        .eq("applicable", 1)
        .gte("fecha_monitoreo", qaDesde(data.year))
        .lt("fecha_monitoreo", qaHasta(data.year))
        .order("fecha_monitoreo", { ascending: false })
        .order("id", { ascending: true }),
    ).then(async (todas) => {
      const periodosQa = await leerPeriodosQa(supabaseAdmin);
      return todas.filter((f: any) => {
        const m = mesQaDeFecha(periodosQa, f.fecha_monitoreo);
        return m.year === data.year && m.month >= inicioMes && m.month < inicioMes + 3;
      });
    });

    // Misma función que el panel: excluye notas vacías.
    const prom = promedioQa(filas.map((f) => f.nota_final));

    return {
      resumen: { frase: fraseQa(prom), rango: rangoQa(prom), registros: filas.length },
      filas: filas.map((f) => ({
        id: f.id,
        fecha: f.fecha_monitoreo,
        clase: f.clave,
        syllabus: f.quality_type,
        level: f.level,
        schedule: f.horario,
        evaluador: f.gerente,
        area: f.area_mejora,
        frase: fraseQa(promedioQa([f.nota_final])),
      })),
      syllabi: [...new Set(filas.map((f) => f.quality_type).filter(Boolean))].sort(),
      niveles: [...new Set(filas.map((f) => f.level).filter(Boolean))].sort(),
    };
  });
