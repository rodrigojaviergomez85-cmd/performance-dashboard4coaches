import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const accesoSchema = z.object({
  coachId: z.number().int().positive(),
  email: z.string().email().max(200),
});

const MENSAJE_ERROR = "Los datos no coinciden con un coach activo.";
const LIMITE_POR_HORA = 10;

/**
 * Acceso de coaches sin cuenta: se valida en el servidor que el par
 * coach_id + correo exista en la lista de coaches activos. Nunca se confía
 * en nada que envíe el navegador para determinar el rol.
 */
export const accesoCoach = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => accesoSchema.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("otp_intentos")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("creado", desde);

    if ((count ?? 0) >= LIMITE_POR_HORA) {
      return {
        ok: false as const,
        error: "Demasiados intentos. Espere una hora e intente de nuevo.",
      };
    }

    await supabaseAdmin.from("otp_intentos").insert({ email });

    const { data: coach } = await supabaseAdmin
      .from("coaches")
      .select("id, nombre, email, activo")
      .eq("email", email)
      .eq("coach_id", data.coachId)
      .eq("activo", true)
      .maybeSingle();

    if (!coach) {
      return { ok: false as const, error: MENSAJE_ERROR };
    }

    const url = process.env["SUPABASE_URL"]!;
    const servicio = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
    const publica = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

    // El usuario de autenticación se crea solo para coaches válidos.
    const { data: existentes } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const yaExiste = existentes?.users?.some((u) => u.email?.toLowerCase() === email);
    if (!yaExiste) {
      await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
    }

    const enlace = await fetch(`${url}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: servicio,
        Authorization: `Bearer ${servicio}`,
      },
      body: JSON.stringify({ type: "magiclink", email }),
    });

    if (!enlace.ok) {
      console.error("Error al generar el acceso:", await enlace.text());
      return { ok: false as const, error: MENSAJE_ERROR };
    }

    const { hashed_token } = (await enlace.json()) as { hashed_token: string };

    const verificacion = await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: publica },
      body: JSON.stringify({ type: "magiclink", token_hash: hashed_token }),
    });

    if (!verificacion.ok) {
      console.error("Error al abrir la sesión:", await verificacion.text());
      return { ok: false as const, error: MENSAJE_ERROR };
    }

    const sesion = (await verificacion.json()) as {
      access_token: string;
      refresh_token: string;
      user: { id: string };
    };

    await supabaseAdmin
      .from("coaches")
      .update({ auth_user_id: sesion.user.id })
      .eq("id", coach.id);

    await supabaseAdmin.from("auditoria").insert({
      actor_id: coach.id,
      accion: "inicio_sesion_coach",
      detalle: { email, coach_id: data.coachId },
    });

    return {
      ok: true as const,
      access_token: sesion.access_token,
      refresh_token: sesion.refresh_token,
    };
  });

/** Perfil del usuario autenticado. El rol se lee siempre en el servidor. */
export const obtenerPerfil = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("coaches")
      .select("id, nombre, rol, coordinador, tenure, activo")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data || !data.activo) throw new Error("Cuenta sin acceso.");

    return { nombre: data.nombre, rol: data.rol };
  });

/** Verifica en el servidor que el usuario autenticado sea administrador. */
export const verificarAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("coaches")
      .select("nombre, rol, activo")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (error || !data || !data.activo || data.rol !== "admin") {
      return { ok: false as const };
    }

    return { ok: true as const, nombre: data.nombre, rol: data.rol };
  });

/** Verifica en el servidor que el usuario autenticado sea un coach activo. */
export const verificarAcceso = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("coaches")
      .select("nombre, rol, activo")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (error || !data || !data.activo) return { ok: false as const };
    return { ok: true as const, nombre: data.nombre, rol: data.rol };
  });
