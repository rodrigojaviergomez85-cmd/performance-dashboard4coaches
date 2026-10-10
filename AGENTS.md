<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Spreadsheet imports with multiple worksheets select the data worksheet by required normalized headers, because exported workbooks include report and pivot sheets before the raw monthly data.
- Academic uploads are validated per table on the server and written through the `cargar_academico` SQL function (service_role only), because range replacement must be atomic with its audit row.
- Coach directory sync goes through `sincronizar_coaches` (service_role only) and never changes roles, reactivates accounts or deletes rows, because imported files can be incomplete.
- Dashboard calculations live in pure `src/lib/reglas.ts` with Vitest tests, so panel and detail views share one definition.
- Multi-page Data API reads always order by a unique id, because unordered range pagination can skip or repeat rows.
- QA in Academic Performance filters by `qa_periods` (non-overlapping inclusive date ranges on `fecha_ingresado`) instead of free Desde/Hasta, because QA reporting periods do not follow calendar months; stored QA dates are never rewritten.
- Incidencias uploads read only the RAW ONSITE/ONLINE sheets, keep only rows whose category is in the configured list (`CATEGORIAS_INCIDENCIA` in reglas.ts), and replace exactly the date range found in the file, because the workbook is uploaded weekly as-is with full history.
- Retention uploads read only the `COACH GRAL` sheet, store one row per coach and month (unique coach_id + period_month, month replaced on re-upload), and compute the quarter from summed DO / Active Student / FC DO (`retencionTrimestre` in reglas.ts), because averaging monthly percentages misstates the quarter.
