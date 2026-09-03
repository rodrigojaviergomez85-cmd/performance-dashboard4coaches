import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const emailSchema = z.object({ email: z.string().email().max(200) });
const codigoSchema = z.object({
  email: z.string().email().max(200),
  codigo: z.string().regex(/^\d{6}$/),
});

const MENSAJE_NEUTRO = "Si el correo está registrado, le enviamos un código.";
const LIMITE_POR_HORA = 5;
const VIGENCIA_MINUTOS = 10;

/**
 * Solicita el código de acceso. La respuesta es siempre idéntica, exista o no
 * el correo. Toda la verificación ocurre en el servidor.
 */
export const solicitarCodigo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => emailSchema.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Límite: 5 solicitudes por correo por hora.
    const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("otp_intentos")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("creado", desde);

    if ((count ?? 0) >= LIMITE_POR_HORA) {
      return { mensaje: MENSAJE_NEUTRO };
    }

    const { data: coach } = await supabaseAdmin
      .from("coaches")
      .select("id, email, activo")
      .eq("email", email)
      .eq("activo", true)
      .maybeSingle();

    if (!coach) {
      return { mensaje: MENSAJE_NEUTRO };
    }

    await supabaseAdmin.from("otp_intentos").insert({ email });

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
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const respuesta = await fetch(`${url}/auth/v1/otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ email, create_user: false }),
    });

    if (!respuesta.ok) {
      console.error("Error al enviar el código:", await respuesta.text());
    }

    await supabaseAdmin.from("auditoria").insert({
      actor_id: coach.id,
      accion: "codigo_solicitado",
      detalle: { email },
    });

    return { mensaje: MENSAJE_NEUTRO };
  });

/**
 * Verifica el código en el servidor y devuelve la sesión. Aplica una vigencia
 * propia de 10 minutos desde la solicitud.
 */
export const verificarCodigo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => codigoSchema.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: coach } = await supabaseAdmin
      .from("coaches")
      .select("id, nombre, activo")
      .eq("email", email)
      .eq("activo", true)
      .maybeSingle();

    if (!coach) {
      return { ok: false as const, error: "El código no es válido o ya expiró." };
    }

    const desde = new Date(Date.now() - VIGENCIA_MINUTOS * 60 * 1000).toISOString();
    const { data: intentos } = await supabaseAdmin
      .from("otp_intentos")
      .select("id")
      .eq("email", email)
      .gte("creado", desde)
      .limit(1);

    if (!intentos || intentos.length === 0) {
      return { ok: false as const, error: "El código no es válido o ya expiró." };
    }

    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const respuesta = await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ type: "email", email, token: data.codigo }),
    });

    if (!respuesta.ok) {
      return { ok: false as const, error: "El código no es válido o ya expiró." };
    }

    const sesion = (await respuesta.json()) as {
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
      accion: "inicio_sesion",
      detalle: { email },
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
