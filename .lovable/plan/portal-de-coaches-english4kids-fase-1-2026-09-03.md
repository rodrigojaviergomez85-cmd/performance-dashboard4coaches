# Portal de Coaches English4Kids — Fase 1

Base de datos, políticas de seguridad, login por código de 6 dígitos y pantalla inicial "Hola, {nombre}".

## Alcance de esta fase

- Backend (Lovable Cloud) con las 5 tablas y RLS activo en todas.
- Login sin contraseña: correo -> código de 6 dígitos válido 10 minutos.
- Pantalla protegida con el saludo y botón "Salir".
- Español, modo claro y oscuro, sin emojis.

Todavía no: listados de encuestas, revisión de notas bajas, carga mensual ni edición de parámetros.

## Nota sobre la regla de seguridad

Se respeta íntegra: el navegador nunca consulta `encuestas`, la política de SELECT es `false`, la clave de servicio vive solo en variables de entorno del servidor y el rol siempre se lee en el servidor desde `coaches`.

Un ajuste técnico: en este stack la capa de servidor no son Edge Functions de Supabase sino funciones de servidor del propio framework (mismo aislamiento, mismo modelo: se ejecutan fuera del navegador, identifican al usuario por su sesión y son el único camino hacia los datos de encuestas). Toda lectura de encuestas pasará por ahí.

## Base de datos

Tablas según lo especificado: `coaches`, `encuestas`, `revisiones`, `parametros` (fila única con 0.06 / 0.12 / 20 / trimestre activo), `auditoria`. Índices en `encuestas(coach_id, periodo)` y `coaches(email)`, email forzado a minúsculas.

Políticas RLS:

- `encuestas`: SELECT con `using (false)`; sin acceso desde el cliente.
- `coaches`: cada quien ve su fila (`auth_user_id = auth.uid()`); revisor y admin ven todas.
- `revisiones`: lectura y escritura solo revisor/admin.
- `parametros`: lectura revisor/admin, escritura solo admin.
- `auditoria`: lectura solo admin; escritura desde el servidor.

El rol se evalúa con una función `security definer` (`tiene_rol`) para evitar recursión en las políticas. Cada tabla recibe sus GRANT explícitos según el rol que la política permite.

## Autenticación

- Pantalla `/auth`: campo de correo -> campo de 6 dígitos.
- El envío del código pasa por una función de servidor que: normaliza el correo, verifica que exista en `coaches` con `activo = true`, aplica el límite de 5 solicitudes por correo por hora y solo entonces dispara el OTP. La respuesta es siempre idéntica: "Si el correo está registrado, le enviamos un código".
- Registro público desactivado; el OTP no crea usuarios nuevos.
- Al verificar el código, el servidor enlaza `coaches.auth_user_id` con el usuario autenticado y registra el evento en `auditoria`.

## Pantalla inicial

Ruta protegida (`/inicio`) bajo el guardián de sesión: obtiene nombre y rol desde el servidor, muestra "Hola, {nombre}" y un botón "Salir" que cierra sesión, limpia la caché y vuelve a `/auth`.

## Detalles técnicos

- Migración SQL única: tablas + GRANT + RLS + políticas + función `tiene_rol` + fila de `parametros`.
- `solicitarCodigo`, `verificarCodigo` y `obtenerPerfil` como funciones de servidor; las dos primeras usan la clave de servicio solo dentro del handler.
- Control de tasa persistido en tabla auxiliar `otp_intentos` (los workers no tienen estado en memoria).
- Tokens de diseño en `src/styles.css` con paleta propia (nada de morado genérico), alternador claro/oscuro en la cabecera.
- Metadatos de página (título y descripción en español) por ruta.

## Datos iniciales

Para poder entrar hace falta al menos un coach cargado. La migración insertará una fila de administrador con el correo que indiques; si no lo indicas, la dejo con un correo de ejemplo que luego habrá que actualizar.
