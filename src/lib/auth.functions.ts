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
 * Paso 1 del acceso de coaches: se valida en el servidor que el coach_id
 * exista y esté activo, y que el correo pertenezca a ese coach. Solo
 * entonces se envía un código de un solo uso al correo registrado.
 */
export const solicitarCodigoCoach = createServerFn({ method: "POST" })
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
        error: "Too many attempts. Please wait an hour and try again.",
      };
    }

    await supabaseAdmin.from("otp_intentos").insert({ email });

    // 1) El coach debe existir y estar activo.
    const { data: coach } = await supabaseAdmin
      .from("coaches")
      .select("id, nombre, email, activo")
      .eq("coach_id", data.coachId)
      .eq("activo", true)
      .maybeSingle();

    if (!coach) {
      return { ok: false as const, error: "Coach Id not found or inactive." };
    }

    // 2) El correo debe pertenecer a ese coach.
    if ((coach.email ?? "").trim().toLowerCase() !== email) {
      return { ok: false as const, error: MENSAJE_ERROR };
    }

    // El usuario de autenticación se crea solo para coaches válidos.
    const { data: existentes } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const yaExiste = existentes?.users?.some((u) => u.email?.toLowerCase() === email);
    if (!yaExiste) {
      await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
    }

    const url = process.env["SUPABASE_URL"]!;
    const publica = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

    const envio = await fetch(`${url}/auth/v1/otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: publica },
      body: JSON.stringify({ email, create_user: false }),
    });

    if (!envio.ok) {
      console.error("Error al enviar el código:", await envio.text());
      return {
        ok: false as const,
        error: "We could not send the code. Please try again.",
      };
    }

    return { ok: true as const };
  });

/**
 * Paso 2: tras verificar el código en el navegador, el servidor enlaza la
 * cuenta de autenticación con la fila del coach y registra el acceso.
 */
export const vincularCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = String(context.claims["email"] ?? "").trim().toLowerCase();

    if (!email) return { ok: false as const };

    const { data: coach } = await supabaseAdmin
      .from("coaches")
      .select("id, activo")
      .eq("email", email)
      .eq("activo", true)
      .maybeSingle();

    if (!coach) return { ok: false as const };

    await supabaseAdmin
      .from("coaches")
      .update({ auth_user_id: context.userId })
      .eq("id", coach.id);

    await supabaseAdmin.from("auditoria").insert({
      actor_id: coach.id,
      accion: "inicio_sesion_coach",
      detalle: { email },
    });

    return { ok: true as const };
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
