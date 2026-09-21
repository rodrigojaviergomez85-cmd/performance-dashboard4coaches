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

/**
 * Reemplaza la lista de coaches con la del archivo cargado.
 * Los coaches que ya no aparecen se eliminan. Las cuentas de
 * administración y revisión no se tocan.
 */
export const sincronizarCoaches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cargaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const porId = new Map<number, (typeof data.filas)[number]>();
    for (const fila of data.filas) porId.set(fila.coach_id, fila);

    const filas = [...porId.values()].map((f) => ({
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
      rol: "coach",
      activo: true,
    }));

    const { error: errorUpsert } = await supabaseAdmin
      .from("coaches")
      .upsert(filas, { onConflict: "coach_id" });
    if (errorUpsert) throw new Error(errorUpsert.message);

    const ids = filas.map((f) => f.coach_id);
    const { data: eliminados, error: errorDelete } = await supabaseAdmin
      .from("coaches")
      .delete()
      .eq("rol", "coach")
      .not("coach_id", "in", `(${ids.join(",")})`)
      .select("coach_id");
    if (errorDelete) throw new Error(errorDelete.message);

    await supabaseAdmin.from("auditoria").insert({
      actor_id: actor.id,
      accion: "carga_lista_coaches",
      detalle: { cargados: filas.length, eliminados: eliminados?.length ?? 0 },
    });

    return { cargados: filas.length, eliminados: eliminados?.length ?? 0 };
  });
