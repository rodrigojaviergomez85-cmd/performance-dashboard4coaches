# Revisión de confiabilidad (oct 2026) — brief por fases
- [x] F1 numero()/entero() vacíos → null; fechas validadas por fuente
- [x] F1 validación por tabla en servidor, filas dentro del rango, errores por fila
- [x] F1 reemplazo atómico (función SQL solo service_role) con auditoría
- [ ] F1 unicidad: CSAT, incidencias, NL, lateness. QA bloqueado: 1,027 filas idénticas repetidas ya guardadas (requiere decisión del usuario)
- [ ] Pendiente de confirmación: efecto de pago de QA/incidencias, booster NL ≥70%, min_encuestas
- [x] F2 QA unificado, DSAT puro, categorías separadas, alertas sin promesas
- [x] F3 sincronizarCoaches atómico con vista previa y desactivación
- [x] F3 RLS Mejora Continua (solo coaches activos), URLs de 10 min
- [x] F3 OTP uniforme, errores comprobados, límite atómico, sin listUsers
- [x] F4 paginación en servidor (Academic, CSAT), estados de pantalla, invalidaciones
- [x] F4 Mejora Continua: limpieza de huérfanos, tipos y tamaño
- [x] F5 pruebas, README

# Rediseño Performance Dashboard
- [x] Igualar la estructura, jerarquía y paleta del scorecard de referencia.
- [x] Conservar DSAT, comentarios CSAT, QA, incidencias, tardanzas y NL.
- [x] Eliminar únicamente Liable Complaints.

# Roadmap — Academic Performance y Performance Dashboard

Decisiones confirmadas:
- DSAT viene de un archivo nuevo (como el sitio original), no de la tabla `encuestas`.
- Las seis pestañas desde el día uno (DO queda como marcador de posición).
- Sin tarjeta de Liable Complaints en ninguna vista.
- Umbrales: <=6% SUPERSTAR, <=12% GREAT, resto BAD (desde `parametros`).
- Panel: administración con selector de coach; cada coach ve solo lo suyo, sin selector.
- Seguridad propia del portal: tablas sin acceso desde el navegador, todo por funciones de servidor.

## Abierto
- Validación de syllabus/horario contra tablas de referencia: pendiente de confirmar con el usuario.

## Archivos reales (sep 2026)
- qa_evaluaciones (QA_FINAL), csat_respuestas (fuente del DSAT), incidencias (INCIDENCIAS).
- QA usa Nota Final y Fecha Monitoreo; fechas día/mes/año.
- El archivo QA puede incluir varias hojas; se localiza la hoja con CLAVE, Id Coach, Nota Final, Fecha Monitoreo y Type QA.
