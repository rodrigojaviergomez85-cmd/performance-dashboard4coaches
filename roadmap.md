# Roadmap — Academic Performance y Performance Dashboard

Decisiones confirmadas:
- DSAT viene de un archivo nuevo (como el sitio original), no de la tabla `encuestas`.
- Las seis pestañas desde el día uno (DO queda como marcador de posición).
- Sin tarjeta de Liable Complaints en ninguna vista.
- Umbrales: <=6% SUPERSTAR, <=12% GREAT, resto BAD (desde `parametros`).
- Panel: administración con selector de coach; cada coach ve solo lo suyo, sin selector.
- Seguridad propia del portal: tablas sin acceso desde el navegador, todo por funciones de servidor.

## Tareas
- [x] Migración: qa_evals, dsat_evals, nl_evals, abs_incidencias, lateness (RLS activo, sin políticas de cliente)
- [x] Funciones de servidor de Academic Performance (listar, cargar, editar applicable, eliminar)
- [x] Funciones de servidor del panel (resumen, año completo, detalle QA, comentarios CSAT, directorio)
- [x] Tokens de tema del panel (claro/oscuro propio)
- [x] Página Academic Performance con las seis pestañas
- [x] Página Performance Dashboard (resumen, año completo, detalle QA)
- [x] Menú lateral compartido admin/coach

## Abierto
- Validación de syllabus/horario contra tablas de referencia: el sitio original la hace contra `syllabi` y `schedules`,
  que aquí no existen ni tienen pantalla de mantenimiento. Por ahora no se valida. Pendiente de confirmar con el usuario.

## Verificado
- Compilación y tipos sin errores; probado como administrador: /performance-dashboard y /academic-performance cargan sin errores de consola.
- Falta probar la carga real de archivos QA/DSAT/NL/Abs/Lateness con archivos de ejemplo del usuario.
