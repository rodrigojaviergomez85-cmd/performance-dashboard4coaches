import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Confirma en el servidor que el usuario autenticado es administrador activo. */
async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("coaches")
    .select("id, rol, activo")
    .eq("auth_user_id", context.userId)
    .maybeSingle();

  if (!data || !data.activo || data.rol !== "admin") {
    throw new Error("Acceso restringido a administración.");
  }
  return data as { id: string; rol: string; activo: boolean };
}

export const listarCoaches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("coaches")
      .select("id, coach_id, nombre, email, pais, sucursal, coordinador, estado, categoria, tenure, activo, rol")
      .eq("rol", "coach")
      .order("nombre", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

const filaSchema = z.object({
  coach_id: z.number().int(),
  nombre: z.string().min(1).max(200),
  email: z.string().max(200),
  pais: z.string().max(120).nullable(),
  sucursal: z.string().max(120).nullable(),
  id_coordinador: z.number().int().nullable(),
  coordinador: z.string().max(200).nullable(),
  estado: z.string().max(60).nullable(),
  categoria: z.string().max(60).nullable(),
  tenure: z.string().max(60).nullable(),
});

const cargaSchema = z.object({
  filas: z.array(filaSchema).min(1).max(5000),
});

const sincronizarSchema = cargaSchema.extend({ desactivarAusentes: z.boolean() });

function normalizar(filas: z.infer<typeof filaSchema>[]) {
  const porId = new Map<number, z.infer<typeof filaSchema>>();
  for (const fila of filas) porId.set(fila.coach_id, fila);
  return [...porId.values()].map((f) => ({
    coach_id: f.coach_id,
    nombre: f.nombre.trim(),
    email: (f.email || `sin-correo-${f.coach_id}@e4cc.local`).trim().toLowerCase(),
    pais: f.pais,
    sucursal: f.sucursal,
    id_coordinador: f.id_coordinador,
    coordinador: f.coordinador,
    estado: f.estado,
    categoria: f.categoria,
    tenure: f.tenure,
  }));
}

/** Impacto de la sincronización, sin modificar nada. */
export const previsualizarCoaches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cargaSchema.parse(input))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const filas = normalizar(data.filas);
    const { data: actuales, error } = await supabaseAdmin
      .from("coaches")
      .select("coach_id, rol, activo");
    if (error) throw new Error(error.message);

    const enArchivo = new Set(filas.map((f) => f.coach_id));
    const porId = new Map((actuales ?? []).map((c) => [c.coach_id, c]));
    let nuevos = 0, actualizados = 0, protegidos = 0, inactivosEnArchivo = 0;
    for (const f of filas) {
      const c = porId.get(f.coach_id);
      if (!c) nuevos++;
      else if (c.rol !== "coach") protegidos++;
      else {
        actualizados++;
        if (!c.activo) inactivosEnArchivo++;
      }
    }
    const activos = (actuales ?? []).filter((c) => c.rol === "coach" && c.activo);
    const ausentes = activos.filter((c) => !enArchivo.has(c.coach_id)).length;
    return { enArchivo: filas.length, nuevos, actualizados, protegidos, inactivosEnArchivo, ausentes, activos: activos.length };
  });

/**
 * Sincroniza el directorio en una sola transacción. No cambia roles, no
 * reactiva cuentas desactivadas y nunca borra: los ausentes se desactivan
 * solo si el administrador lo confirma. Los vínculos de acceso se conservan.
 */
export const sincronizarCoaches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sincronizarSchema.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await (supabaseAdmin as any).rpc("sincronizar_coaches", {
      _filas: normalizar(data.filas),
      _desactivar: data.desactivarAusentes,
      _actor: actor.id,
    });
    if (error) throw new Error(`No se aplicó ningún cambio: ${error.message}`);
    return r as { nuevos: number; actualizados: number; desactivados: number };
  });

const estadoSchema = z.object({ id: z.string().uuid(), activo: z.boolean() });

/** Activación o desactivación manual de un coach (no aplica a admin ni revisión). */
export const cambiarEstadoCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => estadoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: fila, error } = await supabaseAdmin
      .from("coaches")
      .update({ activo: data.activo })
      .eq("id", data.id)
      .eq("rol", "coach")
      .select("coach_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!fila) throw new Error("Coach no encontrado.");
    const { error: errorAud } = await supabaseAdmin.from("auditoria").insert({
      actor_id: actor.id,
      accion: data.activo ? "reactivar_coach" : "desactivar_coach",
      detalle: { coach_id: fila.coach_id },
    });
    if (errorAud) throw new Error(errorAud.message);
    return { ok: true as const };
  });
