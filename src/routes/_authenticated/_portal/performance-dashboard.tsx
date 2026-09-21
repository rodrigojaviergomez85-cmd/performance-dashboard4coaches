import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  comentariosCsat,
  detalleQa,
  directorioCoaches,
  panelDesempeno,
} from "@/lib/performance.functions";
import { SelectorBuscable } from "@/components/selector-buscable";
import { EtiquetaCategoria, Tarjeta } from "@/components/panel/tarjetas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_portal/performance-dashboard")({
  head: () => ({
    meta: [
      { title: "Performance Dashboard | Portal de Coaches E4CC" },
      {
        name: "description",
        content: "Resultados de satisfacción, QA, ausencias y tardanzas por trimestre.",
      },
      { property: "og:title", content: "Performance Dashboard | Portal de Coaches E4CC" },
      {
        property: "og:description",
        content: "Resultados de satisfacción, QA, ausencias y tardanzas por trimestre.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PerformanceDashboard,
});

const ahora = new Date();
const ANIOS = [ahora.getUTCFullYear(), ahora.getUTCFullYear() - 1, ahora.getUTCFullYear() - 2];

const porcentaje = (v: number | null) => (v === null ? "—" : `${v.toFixed(2)}%`);

function PerformanceDashboard() {
  const panel = useServerFn(panelDesempeno);
  const directorio = useServerFn(directorioCoaches);
  const comentarios = useServerFn(comentariosCsat);
  const qaDetalle = useServerFn(detalleQa);

  const [coachId, setCoachId] = useState<number | null>(null);
  const [year, setYear] = useState(ahora.getUTCFullYear());
  const [quarter, setQuarter] = useState(Math.floor(ahora.getUTCMonth() / 3) + 1);
  const [busquedaComentario, setBusquedaComentario] = useState("");

  const argumentos = { coachId, year, quarter };

  const { data: coaches = [] } = useQuery({
    queryKey: ["directorio-coaches"],
    queryFn: () => directorio(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["panel", coachId, year, quarter],
    queryFn: () => panel({ data: argumentos }),
  });

  const { data: csat } = useQuery({
    queryKey: ["csat", coachId, year, quarter, busquedaComentario],
    queryFn: () =>
      comentarios({ data: { ...argumentos, texto: busquedaComentario.trim() || null } }),
  });

  const { data: qa } = useQuery({
    queryKey: ["qa-detalle", coachId, year, quarter],
    queryFn: () => qaDetalle({ data: argumentos }),
  });

  if (error) {
    return (
      <section className="px-8 py-10">
        <p className="text-sm text-destructive">No se pudo cargar el panel: {error.message}</p>
      </section>
    );
  }

  const diferenciaTardanzas =
    data && data.tardanzasPrevias > 0
      ? data.tardanzas - data.tardanzasPrevias
      : null;

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Performance Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            {data ? `${data.coach.nombre} · Coach ${data.coach.coach_id}` : "Cargando…"}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {data?.puedeElegirCoach && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Coach</Label>
              <SelectorBuscable
                opciones={coaches.map((c) => ({
                  valor: String(c.coach_id),
                  etiqueta: `${c.nombre} (${c.coach_id})`,
                }))}
                valor={coachId === null ? "" : String(coachId)}
                alCambiar={(v) => setCoachId(v ? Number(v) : null)}
                marcador="Elegir coach"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Año</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-9 w-28 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANIOS.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Trimestre</Label>
            <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
              <SelectTrigger className="h-9 w-28 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((q) => (
                  <SelectItem key={q} value={String(q)}>
                    Q{q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Cargando resultados…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.meses.map((m) => (
              <Tarjeta
                key={m.mes}
                titulo={m.etiqueta}
                valor={porcentaje(m.porcentaje)}
                detalle={
                  m.denominador === 0
                    ? "Sin encuestas que cuenten"
                    : `${m.numerador} de ${m.denominador} insatisfechas`
                }
                pie={<EtiquetaCategoria valor={m.categoria} />}
              />
            ))}
            <Tarjeta
              destacado
              titulo={`Trimestre Q${data.quarter}`}
              valor={porcentaje(data.trimestre.porcentaje)}
              detalle={
                data.trimestre.denominador === 0
                  ? "Sin encuestas que cuenten"
                  : `${data.trimestre.numerador} de ${data.trimestre.denominador} insatisfechas`
              }
              pie={<EtiquetaCategoria valor={data.trimestre.categoria} />}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tarjeta
              titulo="QA"
              valor={data.qa.frase ?? "—"}
              detalle={
                data.qa.bloqueado
                  ? "Promedio bajo el mínimo: categoría bloqueada"
                  : data.qa.advertencia
                    ? "Promedio cerca del mínimo"
                    : data.qa.rango
                      ? `Rango ${data.qa.rango} de 5`
                      : "Sin evaluaciones"
              }
            />
            <Tarjeta
              titulo="Incidencias"
              valor={String(data.incidencias)}
              detalle="Días con ausencia aplicable"
            />
            <Tarjeta
              titulo="Tardanzas"
              valor={String(data.tardanzas)}
              detalle={
                diferenciaTardanzas === null
                  ? "Sin trimestre previo para comparar"
                  : diferenciaTardanzas === 0
                    ? "Igual que el trimestre anterior"
                    : diferenciaTardanzas > 0
                      ? `${diferenciaTardanzas} más que el trimestre anterior`
                      : `${Math.abs(diferenciaTardanzas)} menos que el trimestre anterior`
              }
            />
            <Tarjeta
              titulo="NL"
              valor={porcentaje(data.nl)}
              detalle="Aprobadas sobre evaluadas"
            />
          </div>

          <Tabs defaultValue="anual" className="space-y-4">
            <TabsList>
              <TabsTrigger value="anual">Resumen anual</TabsTrigger>
              <TabsTrigger value="csat">Comentarios CSAT</TabsTrigger>
              <TabsTrigger value="qa">Detalle QA</TabsTrigger>
            </TabsList>

            <TabsContent value="anual">
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Mes</TableHead>
                      <TableHead className="text-right">DSAT</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>QA</TableHead>
                      <TableHead className="text-right">Incidencias</TableHead>
                      <TableHead className="text-right">Tardanzas</TableHead>
                      <TableHead className="text-right">NL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.anual.map((m) => (
                      <TableRow key={m.mes}>
                        <TableCell>{m.etiqueta}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {porcentaje(m.dsat)}
                        </TableCell>
                        <TableCell>
                          <EtiquetaCategoria valor={m.categoria} />
                        </TableCell>
                        <TableCell>{m.qaFrase ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.incidencias}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.tardanzas}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {porcentaje(m.nl)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="csat" className="space-y-3">
              <Input
                placeholder="Buscar en los comentarios"
                value={busquedaComentario}
                onChange={(e) => setBusquedaComentario(e.target.value)}
                className="h-9 w-72 text-sm"
              />
              <div className="space-y-3">
                {(csat?.filas ?? []).length === 0 ? (
                  <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                    Sin comentarios en este trimestre.
                  </p>
                ) : (
                  (csat?.filas ?? []).map((f: any) => (
                    <div key={f.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{String(f.period_month).slice(0, 7)}</span>
                        <span>Clase {f.class_id ?? "—"}</span>
                        <span>{f.syllabus ?? "—"}</span>
                        <span>Nota {f.coach_score ?? "—"}</span>
                        <span>{f.status ?? "—"}</span>
                      </div>
                      {f.experience_comment && (
                        <p className="mt-2 text-sm text-foreground">{f.experience_comment}</p>
                      )}
                      {f.coach_comment && (
                        <p className="mt-2 text-sm text-muted-foreground">{f.coach_comment}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="qa">
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Fecha</TableHead>
                      <TableHead>Clase</TableHead>
                      <TableHead>Syllabus</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Horario</TableHead>
                      <TableHead>Evaluador</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(qa?.filas ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          Sin evaluaciones en este trimestre.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (qa?.filas ?? []).map((f: any) => (
                        <TableRow key={f.id}>
                          <TableCell>{f.fecha}</TableCell>
                          <TableCell>{f.clase ?? "—"}</TableCell>
                          <TableCell>{f.syllabus ?? "—"}</TableCell>
                          <TableCell>{f.level ?? "—"}</TableCell>
                          <TableCell>{f.schedule ?? "—"}</TableCell>
                          <TableCell>{f.evaluador ?? "—"}</TableCell>
                          <TableCell>{f.frase ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </section>
  );
}
