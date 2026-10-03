# Performance Dashboard — Portal de Coaches E4CC

Aplicación interna para que cada coach vea su scorecard trimestral y para que administración cargue los archivos académicos, mantenga la lista de coaches y publique materiales de Mejora Continua.

## Arquitectura

- TanStack Start (React 19 + Vite) con funciones de servidor (`createServerFn`) en `src/lib/*.functions.ts`.
- Lovable Cloud (Postgres, Auth, Storage). RLS activo en todas las tablas.
- Las tablas académicas (`qa_evaluaciones`, `csat_respuestas`, `incidencias`, `nl_evals`, `lateness`) no tienen lectura desde el navegador: todo pasa por funciones de servidor que identifican al usuario por su sesión y su fila en `coaches`.
- La clave de servicio solo se usa en el servidor, cargada dentro de cada función.

## Accesos

- **Coach**: Coach Id + correo → el servidor valida coach activo y correo propio, y envía un código OTP. La respuesta es la misma exista o no el coach. Límite de 10 solicitudes por correo por hora, atómico (`registrar_intento_otp`).
- **Admin**: usuario y contraseña. El rol se lee siempre en el servidor (`coaches.rol`, `activo`).
- Un coach solo ve sus propios datos: el servidor ignora el coach solicitado salvo para admin/revisor.

## Cargas académicas (Academic Performance)

1. El navegador lee el xlsx (`src/lib/hoja-calculo.ts`), localiza la hoja por encabezados y convierte cada fila (`src/lib/academico-config.ts`). Vacíos = null; IDs con decimales o fechas inexistentes se rechazan por fila.
2. Formatos de fecha por fuente: QA día/mes/año (corregido solo si la columna Month lo demuestra); NL, Lateness e incidencias mes/día/año o fecha de Excel.
3. El servidor valida cada fila con un esquema por tabla (requeridos, IDs, escala 0–10) y que esté dentro del rango Desde/Hasta. Si hay errores, no se modifica nada y se devuelven por fila.
4. `cargar_academico` (función SQL, solo `service_role`) borra el rango, inserta y registra la auditoría en una transacción con bloqueo por tabla. Si algo falla, los datos anteriores quedan intactos.
5. Índices únicos en CSAT, incidencias, NL y Lateness. QA queda sin índice único hasta resolver duplicados históricos.

Listados con filtros, búsqueda y paginación en el servidor, orden estable por fecha e id.

## Cálculos (`src/lib/reglas.ts`, con pruebas)

- QA: promedio que excluye notas vacías; misma función en panel y detalle. <7.5 bloqueo, 7.5–<7.8 advertencia.
- DSAT: cuentan las encuestas con "Aplica Coach" en blanco y nota; DSAT = nota ≤ 8 / que cuentan. Comparación sin redondear; ≤6% SUPERSTAR, ≤12% GREAT, resto BAD (`parametros`).
- La categoría mostrada es solo por DSAT. Elegibilidad de pago, booster NL y `min_encuestas` están pendientes de política confirmada y no se aplican.
- Incidencias: días distintos con applicable = 1; una sola regla para alertas y tarjetas (>3 crítico, =3 aviso).

## Coaches

Carga xlsx con vista previa del impacto. `sincronizar_coaches` (transacción, solo `service_role`) actualiza datos de directorio, crea nuevos, no cambia roles, no reactiva cuentas y solo desactiva ausentes si el admin lo confirma. Nunca borra; conserva vínculos de acceso. Reactivación manual desde la tabla.

## Mejora Continua

Bucket privado `mejora-continua` (máx. 1 GB por archivo, extensiones permitidas por política). Leen solo usuarios vinculados a un coach activo; suben y borran solo admins activos. Enlaces firmados de 10 minutos: un enlace ya emitido sigue funcionando hasta vencer.

## Desarrollo

- `bun run test` — pruebas (Vitest).
- `bun run lint` — ESLint (hay deuda de formato previa).
- Migraciones en `drizzle/migrations`.
