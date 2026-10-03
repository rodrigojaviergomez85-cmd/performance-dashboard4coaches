import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const accesoSchema = z.object({
  coachId: z.number().int().positive(),
  email: z.string().email().max(200),
});

const LIMITE_POR_HORA = 10;

/**
 * Mismo resultado para cualquier combinación de Coach Id y correo, para no
 * revelar qué datos están registrados.
 */
const RESPUESTA_UNIFORME = { ok: true as const };

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

    // Registro y conteo atómicos: dos solicitudes simultáneas no superan el límite.
    const { data: permitido, error: errorLimite } = await (supabaseAdmin as any).rpc(
      "registrar_intento_otp",
      { _email: email, _limite: LIMITE_POR_HORA },
    );
    if (errorLimite) {
      console.error("Error al registrar el intento:", errorLimite.message);
      return { ok: false as const, error: "We could not process the request. Please try again." };
    }
    if (!permitido) {
      return { ok: false as const, error: "Too many attempts. Please wait an hour and try again." };
    }

    const { data: coach, error: errorCoach } = await supabaseAdmin
      .from("coaches")
      .select("id, email, activo")
      .eq("coach_id", data.coachId)
      .eq("activo", true)
      .maybeSingle();
    if (errorCoach) {
      console.error("Error al buscar el coach:", errorCoach.message);
      return { ok: false as const, error: "We could not process the request. Please try again." };
    }

    // Coach inexistente, inactivo o correo ajeno: misma respuesta, sin enviar nada.
    if (!coach || (coach.email ?? "").trim().toLowerCase() !== email) return RESPUESTA_UNIFORME;

    // Crea el usuario si falta; "ya existe" no es un error. No depende de listar usuarios.
    const { error: errorCrear } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
    if (errorCrear && !/already|registered|exists/i.test(errorCrear.message) && (errorCrear as any).code !== "email_exists") {
      console.error("Error al crear el usuario:", errorCrear.message);
      return { ok: false as const, error: "We could not process the request. Please try again." };
    }

    const url = process.env["SUPABASE_URL"]!;
    const publica = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const envio = await fetch(`${url}/auth/v1/otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: publica },
      body: JSON.stringify({ email, create_user: false }),
    });
    if (!envio.ok) {
      console.error("Error al enviar el código:", envio.status, await envio.text());
      return { ok: false as const, error: "We could not process the request. Please try again." };
    }

    return RESPUESTA_UNIFORME;
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

    const { data: coach, error: errorCoach } = await supabaseAdmin
      .from("coaches")
      .select("id, activo")
      .eq("email", email)
      .eq("activo", true)
      .maybeSingle();
    if (errorCoach || !coach) return { ok: false as const };

    const { error: errorVinculo } = await supabaseAdmin
      .from("coaches")
      .update({ auth_user_id: context.userId })
      .eq("id", coach.id);
    if (errorVinculo) {
      console.error("Error al vincular la cuenta:", errorVinculo.message);
      return { ok: false as const };
    }

    const { error: errorAud } = await supabaseAdmin.from("auditoria").insert({
      actor_id: coach.id,
      accion: "inicio_sesion_coach",
      detalle: { email },
    });
    if (errorAud) console.error("Error al registrar la auditoría:", errorAud.message);

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
