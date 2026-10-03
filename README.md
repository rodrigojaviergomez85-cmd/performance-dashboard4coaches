# Performance Dashboard - E4CC

Construye una aplicación web interna en español llamada "Portal de Coaches English4Kids". Es para que cada coach vea sus encuestas de satisfacción y su categoría de pago, y para que el equipo administrativo revise las notas bajas.

REGLA DE SEGURIDAD NO NEGOCIABLE

El navegador NUNCA debe consultar la tabla de encuestas directamente. Toda lectura de datos de encuestas pasa por Edge Functions de Supabase que identifican al usuario a partir de su sesión. La clave pública (anon key) no debe servir para leer ninguna encuesta. La clave de servicio (service role) va solo en variables de entorno del servidor, jamás en el código del cliente. Activa Row Level Security en TODAS las tablas.

AUTENTICACIÓN

Supabase Auth con OTP por correo: el usuario escribe su correo y recibe un código de 6 dígitos válido 10 minutos. Sin contraseñas y sin registro público. Solo pueden entrar correos que ya existan en la tabla "coaches" con activo = true. Al pedir el código, la pantalla debe decir siempre lo mismo exista o no el correo: "Si el correo está registrado, le enviamos un código". Límite de 5 solicitudes por correo por hora.

TABLAS

coaches: id uuid pk, coach_id int único, nombre text, email text único en minúsculas, coordinador text, tenure text, rol text (coach|revisor|admin), activo bool, auth_user_id uuid

encuestas: id uuid pk, coach_id int, periodo text ("2026-08"), score int 1..10, comentario text, curso text, primera_semana bool, origen text, creado timestamptz

revisiones: encuesta_id uuid único fk encuestas.id, cuenta bool, motivo text, revisor_id uuid fk coaches.id, actualizado timestamptz

parametros: fila única con umbral_superstar numeric 0.06, umbral_great numeric 0.12, min_encuestas int 20, trimestre_activo text

auditoria: id uuid, actor_id uuid, accion text, detalle jsonb, creado timestamptz

POLÍTICAS RLS

- encuestas: "create policy sin_lectura_directa on encuestas for select using (false)" — nadie lee esta tabla desde el cliente.

- coaches: cada usuario ve solo su fila (auth_user_id = auth.uid()); quienes tengan rol revisor o admin ven todas.

- revisiones: solo revisor y admin pueden leer y escribir.

- parametros: leen revisor y admin; escribe solo admin.

- auditoria: solo admin lee; se escribe desde el servidor.

ROLES

coach ve únicamente lo suyo. revisor ve a todos y marca las notas bajas. admin hace todo eso más cargar el archivo mensual y editar parámetros. El rol se lee siempre de la tabla coaches en el servidor, nunca de algo que mande el navegador.

Por ahora crea solo la base de datos, las políticas, el login y una pantalla vacía que diga "Hola, {nombre}" con el nombre del coach que inició sesión y un botón de salir. Idioma español, modo claro y oscuro, sin emojis.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://performance-dashboard4coaches.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/62acb041-83a9-4baf-9f52-2f934b220068).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
