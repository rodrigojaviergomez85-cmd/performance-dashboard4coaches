import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function fraseQa(promedio: number | null): string | null {
  if (promedio === null) return null;
  if (promedio >= 10) return "Excellente Plus!";
  if (promedio >= 9) return "Excelent!";
  if (promedio >= 8) return "Great Job!";
  if (promedio >= 7) return "Almost There";
  return "Needs Improvement";
}

function rangoQa(promedio: number | null): number | null {
  if (promedio === null) return null;
  if (promedio >= 10) return 5;
  if (promedio >= 9) return 4;
  if (promedio >= 8) return 3;
  if (promedio >= 7) return 2;
  return 1;
}

function categoria(porcentaje: number | null, superstar: number, great: number): string | null {
  if (porcentaje === null) return null;
  if (porcentaje <= superstar) return "SUPERSTAR";
  if (porcentaje <= great) return "GREAT";
  return "BAD";
}

/** Lee todas las filas de una consulta, de 1000 en 1000. */
async function todasLasFilas<T>(construir: () => any): Promise<T[]> {
  const total: T[] = [];
  const tamano = 1000;
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await construir().range(desde, desde + tamano - 1);
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
    const dsat = await todasLasFilas<{ period_month: string; status: string; coach_score: number | null }>(
      () =>
        supabaseAdmin
          .from("dsat_evals")
          .select("period_month, status, coach_score")
          .eq("teacher_id", coachId)
          .gte("period_month", mesInicio(data.year, 1))
          .lt("period_month", mesInicio(data.year + 1, 1)),
    );

    const qa = await todasLasFilas<{ clase_date: string; score: number | null }>(() =>
      supabaseAdmin
        .from("qa_evals")
        .select("clase_date, score")
        .eq("coach_id", coachId)
        .eq("applicable", 1)
        .gte("clase_date", mesInicio(data.year, 1))
        .lt("clase_date", mesInicio(data.year + 1, 1)),
    );

    const abs = await todasLasFilas<{ fecha: string }>(() =>
      supabaseAdmin
        .from("abs_incidencias")
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

    const dsatDeMes = (mes: number) => {
      const filas = dsat.filter((d) => mesDe(d.period_month) === mes && d.status === "Te Cuenta");
      const denominador = filas.length;
      const numerador = filas.filter((d) => (d.coach_score ?? 99) <= 8).length;
      return {
        numerador,
        denominador,
        porcentaje: denominador === 0 ? null : Number(((numerador * 100) / denominador).toFixed(2)),
      };
    };

    const meses = [0, 1, 2].map((n) => {
      const mes = inicioMes + n;
      const r = dsatDeMes(mes);
      return {
        etiqueta: MESES[mes - 1]!,
        mes,
        ...r,
        categoria: categoria(r.porcentaje, superstar, great),
      };
    });

    const filasTrimestre = dsat.filter(
      (d) => enRango(d.period_month) && d.status === "Te Cuenta",
    );
    const denomTrimestre = filasTrimestre.length;
    const numTrimestre = filasTrimestre.filter((d) => (d.coach_score ?? 99) <= 8).length;
    const porcentajeTrimestre =
      denomTrimestre === 0 ? null : Number(((numTrimestre * 100) / denomTrimestre).toFixed(2));

    const promedio = (valores: number[]) =>
      valores.length === 0 ? null : valores.reduce((a, b) => a + b, 0) / valores.length;

    const qaTrimestre = promedio(
      qa.filter((q) => enRango(q.clase_date) && q.score != null).map((q) => Number(q.score)),
    );

    const incidencias = new Set(abs.filter((a) => enRango(a.fecha)).map((a) => a.fecha)).size;

    const nlTrimestre = nl.filter((n) => enRango(n.fecha));
    const evaluadas = nlTrimestre.filter((n) => (n.resultado ?? "") !== "Pending").length;
    const aprobadas = nlTrimestre.filter((n) => n.resultado === "Approved").length;
    const nlPorcentaje =
      evaluadas === 0 ? null : Number(((aprobadas * 100) / evaluadas).toFixed(2));

    const sumaTardanzas = tardanzas
      .filter((t) => enRango(t.fecha))
      .reduce((a, t) => a + (t.late_count ?? 0), 0);
    const tardanzasPrevias = tardanzas
      .filter((t) => t.fecha >= inicioPrevio && t.fecha < inicio)
      .reduce((a, t) => a + (t.late_count ?? 0), 0);

    const anual = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const d = dsatDeMes(mes);
      const q = promedio(
        qa.filter((x) => mesDe(x.clase_date) === mes && x.score != null).map((x) => Number(x.score)),
      );
      const filasNl = nl.filter((x) => mesDe(x.fecha) === mes);
      const ev = filasNl.filter((x) => (x.resultado ?? "") !== "Pending").length;
      const ap = filasNl.filter((x) => x.resultado === "Approved").length;
      return {
        mes,
        etiqueta: MESES[i]!,
        dsat: d.porcentaje,
        categoria: categoria(d.porcentaje, superstar, great),
        qaFrase: fraseQa(q),
        qaRango: rangoQa(q),
        incidencias: new Set(abs.filter((a) => mesDe(a.fecha) === mes).map((a) => a.fecha)).size,
        tardanzas: tardanzas
          .filter((t) => mesDe(t.fecha) === mes && t.fecha.startsWith(String(data.year)))
          .reduce((a, t) => a + (t.late_count ?? 0), 0),
        nl: ev === 0 ? null : Number(((ap * 100) / ev).toFixed(2)),
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
        porcentaje: porcentajeTrimestre,
        categoria: categoria(porcentajeTrimestre, superstar, great),
      },
      qa: {
        frase: fraseQa(qaTrimestre),
        rango: rangoQa(qaTrimestre),
        bloqueado: qaTrimestre !== null && qaTrimestre < 7.5,
        advertencia: qaTrimestre !== null && qaTrimestre >= 7.5 && qaTrimestre < 7.8,
      },
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
});

export const comentariosCsat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entradaComentarios.parse(input))
  .handler(async ({ data, context }) => {
    const { coachId } = await coachObjetivo(context, data.coachId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const inicioMes = (data.quarter - 1) * 3 + 1;
    const inicio = mesInicio(data.year, inicioMes);
    const fin = inicioMes + 3 > 12 ? mesInicio(data.year + 1, 1) : mesInicio(data.year, inicioMes + 3);

    const filas = await todasLasFilas<any>(() =>
      supabaseAdmin
        .from("dsat_evals")
        .select(
          "id, period_month, syllabus, class_id, experience_comment, coach_comment, coach_score, status, razon_no_cuenta",
        )
        .eq("teacher_id", coachId)
        .gte("period_month", inicio)
        .lt("period_month", fin),
    );

    const texto = (data.texto ?? "").trim().toLowerCase();

    const filtradas = filas
      .filter((f) => (f.experience_comment || f.coach_comment))
      .filter((f) => (data.mes ? Number(String(f.period_month).slice(5, 7)) === data.mes : true))
      .filter((f) => (data.syllabus ? f.syllabus === data.syllabus : true))
      .filter((f) => (data.clase ? String(f.class_id) === data.clase : true))
      .filter((f) =>
        texto
          ? `${f.experience_comment ?? ""} ${f.coach_comment ?? ""}`.toLowerCase().includes(texto)
          : true,
      )
      .slice(0, 500);

    const syllabi = [...new Set(filas.map((f) => f.syllabus).filter(Boolean))].sort();
    const clases = [...new Set(filas.map((f) => f.class_id).filter((c) => c != null))]
      .map(String)
      .sort();

    return { filas: filtradas, syllabi, clases, total: filas.length };
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
    const inicio = mesInicio(data.year, inicioMes);
    const fin = inicioMes + 3 > 12 ? mesInicio(data.year + 1, 1) : mesInicio(data.year, inicioMes + 3);

    const filas = await todasLasFilas<any>(() =>
      supabaseAdmin
        .from("qa_evals")
        .select("id, clase_date, clase, syllabus, level, schedule, eval_by, score, applicable")
        .eq("coach_id", coachId)
        .eq("applicable", 1)
        .gte("clase_date", inicio)
        .lt("clase_date", fin)
        .order("clase_date", { ascending: false }),
    );

    const notas = filas.map((f) => Number(f.score)).filter((n) => !Number.isNaN(n));
    const prom = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

    return {
      resumen: { frase: fraseQa(prom), rango: rangoQa(prom), registros: filas.length },
      filas: filas.map((f) => ({
        id: f.id,
        fecha: f.clase_date,
        clase: f.clase,
        syllabus: f.syllabus,
        level: f.level,
        schedule: f.schedule,
        evaluador: f.eval_by,
        frase: fraseQa(f.score == null ? null : Number(f.score)),
      })),
      syllabi: [...new Set(filas.map((f) => f.syllabus).filter(Boolean))].sort(),
      niveles: [...new Set(filas.map((f) => f.level).filter(Boolean))].sort(),
    };
  });
