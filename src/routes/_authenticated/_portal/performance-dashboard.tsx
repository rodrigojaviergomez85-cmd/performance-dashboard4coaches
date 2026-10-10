import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, Info, Moon, Sparkles, Sun } from "lucide-react";
import {
  comentariosCsat,
  detalleQa,
  directorioCoaches,
  panelDesempeno,
} from "@/lib/performance.functions";
import { SelectorBuscable } from "@/components/selector-buscable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_portal/performance-dashboard")({
  head: () => ({
    meta: [
      { title: "Performance Dashboard | Portal de Coaches E4CC" },
      { name: "description", content: "Scorecard trimestral de desempeño para coaches E4CC." },
      { property: "og:title", content: "Performance Dashboard | Portal de Coaches E4CC" },
      { property: "og:description", content: "Scorecard trimestral de desempeño para coaches E4CC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PerformanceDashboard,
});

const ahora = new Date();
const ANIOS = [ahora.getUTCFullYear(), ahora.getUTCFullYear() - 1, ahora.getUTCFullYear() - 2];
const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const porcentaje = (valor: number | null) => (valor === null ? "—" : `${valor.toFixed(2)}%`);
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

function estadoCategoria(categoria: string | null) {
  if (categoria === "SUPERSTAR") return "scorecard-superstar";
  if (categoria === "GREAT") return "scorecard-great";
  if (categoria === "BAD") return "scorecard-bad";
  return "scorecard-empty";
}

function TarjetaMes({ mes }: { mes: any }) {
  return (
    <div className={cn("scorecard-month-card", estadoCategoria(mes.categoria))}>
      <p className="scorecard-label">{mes.etiqueta}</p>
      <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{porcentaje(mes.porcentaje)}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase text-scorecard-status">
        {mes.categoria ?? "No data"}
      </p>
      <p className="mt-3 text-[10px] text-muted-foreground">
        {mes.denominador ? `${mes.numerador} / ${mes.denominador} = ${porcentaje(mes.porcentaje)}` : "0 / 0"}
      </p>
    </div>
  );
}

function TarjetaLock({
  titulo,
  valor,
  sufijo,
  nota,
  accion,
  tono,
}: {
  titulo: string;
  valor: string;
  sufijo?: string;
  nota: string;
  accion?: () => void;
  tono?: "success" | "warning";
}) {
  return (
    <div className={cn("scorecard-lock-card", tono === "success" && "scorecard-lock-success", tono === "warning" && "scorecard-lock-warning")}>
      <div className="flex items-center justify-between">
        <p className="scorecard-label">{titulo}</p>
        <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="mt-3 text-center">
        <span className="text-3xl font-bold tabular-nums text-foreground">{valor}</span>
        {sufijo && <span className="ml-1 text-xs text-muted-foreground">{sufijo}</span>}
      </div>
      <p className="mt-3 text-center text-[10px] text-muted-foreground">{nota}</p>
      {accion && (
        <Button variant="link" size="sm" onClick={accion} className="mt-1 h-auto p-0 text-xs text-scorecard-link">
          View details <span aria-hidden="true">→</span>
        </Button>
      )}
    </div>
  );
}

function PerformanceDashboard() {
  const panel = useServerFn(panelDesempeno);
  const directorio = useServerFn(directorioCoaches);
  const comentarios = useServerFn(comentariosCsat);
  const qaDetalle = useServerFn(detalleQa);
  const [coachId, setCoachId] = useState<number | null>(null);
  const [year, setYear] = useState(ahora.getUTCFullYear());
  const [quarter, setQuarter] = useState(Math.floor(ahora.getUTCMonth() / 3) + 1);
  const [mes, setMes] = useState<number | null>(null);
  const [syllabus, setSyllabus] = useState<string | null>(null);
  const [clase, setClase] = useState<string | null>(null);
  const [vistaAnual, setVistaAnual] = useState(false);
  const [mostrarQa, setMostrarQa] = useState(false);

  const [paginaCsat, setPaginaCsat] = useState(0);
  const POR_PAGINA_CSAT = 25;

  // Al cambiar coach, año o trimestre, los filtros anteriores dejan de aplicar.
  useEffect(() => {
    setMes(null);
    setSyllabus(null);
    setClase(null);
    setPaginaCsat(0);
    setMostrarQa(false);
  }, [coachId, year, quarter]);

  const argumentos = { coachId, year, quarter };
  const { data: coaches = [] } = useQuery({ queryKey: ["directorio-coaches"], queryFn: () => directorio() });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["panel", coachId, year, quarter],
    queryFn: () => panel({ data: argumentos }),
  });
  const csatConsulta = useQuery({
    queryKey: ["csat", coachId, year, quarter, mes, syllabus, clase, paginaCsat],
    queryFn: () =>
      comentarios({ data: { ...argumentos, mes, syllabus, clase, texto: null, pagina: paginaCsat, porPagina: POR_PAGINA_CSAT } }),
    placeholderData: (previo) => previo,
  });
  const csat = csatConsulta.data;
  const qaConsulta = useQuery({
    queryKey: ["qa-detalle", coachId, year, quarter],
    queryFn: () => qaDetalle({ data: argumentos }),
    enabled: mostrarQa,
  });
  const qa = qaConsulta.data;
  const hayFiltrosCsat = mes !== null || syllabus !== null || clase !== null;

  const mesesTexto = useMemo(() => {
    const inicio = (quarter - 1) * 3;
    return MESES.slice(inicio, inicio + 3).join(", ");
  }, [quarter]);

  if (error) {
    return (
      <section className="p-8 text-sm text-destructive">
        No se pudo cargar el panel: {error.message}{" "}
        <Button variant="link" size="sm" onClick={() => refetch()}>Reintentar</Button>
      </section>
    );
  }

  if (isLoading || !data) {
    return <section className="p-8 text-sm text-muted-foreground">Cargando scorecard…</section>;
  }

  const diferencia = data.tardanzas - data.tardanzasPrevias;
  const categoria = data.trimestre.categoria;
  const alertas = data.alertas;

  return (
    <section className="scorecard-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-scorecard-brand" />
            <h1 className="text-sm font-bold text-foreground">Coach Scorecard</h1>
          </div>
          <p className="mt-1 text-[10px] uppercase text-muted-foreground">Coach Performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => document.documentElement.classList.toggle("dark")} aria-label="Cambiar tema">
            <Moon className="h-4 w-4 dark:hidden" />
            <Sun className="hidden h-4 w-4 dark:block" />
          </Button>
          <Button variant="outline" onClick={() => setVistaAnual((actual) => !actual)}>
            {vistaAnual ? `Q${quarter} View` : "Full Year View"}
          </Button>
          {data.puedeElegirCoach ? (
            <SelectorBuscable
              opciones={coaches.map((coach) => ({ valor: String(coach.coach_id), etiqueta: coach.nombre }))}
              valor={coachId === null ? "" : String(coachId)}
              alElegir={(valor) => setCoachId(valor ? Number(valor) : null)}
              marcador={data.coach.nombre}
            />
          ) : (
            <div className="rounded-full border border-border bg-card px-5 py-2 text-xs font-semibold uppercase text-foreground">
              {data.coach.nombre}
            </div>
          )}
        </div>
      </header>

      <div className="scorecard-coach-banner">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary-foreground/30 bg-primary-foreground/10 text-sm font-bold text-primary-foreground">
          {iniciales(data.coach.nombre)}
        </div>
        <div>
          <p className="text-lg font-bold uppercase text-primary-foreground">{data.coach.nombre}</p>
          <p className="text-xs text-primary-foreground/80">{data.coach.tenure ?? `Coach ${data.coach.coach_id}`}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-sm font-bold text-foreground">DSAT — Q{quarter} {year}</h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{mesesTexto} · drives your Q{quarter === 4 ? 1 : quarter + 1} CSAT Category</span>
          <Select value={String(year)} onValueChange={(valor) => setYear(Number(valor))}>
            <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ANIOS.map((anio) => <SelectItem key={anio} value={String(anio)}>{anio}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(quarter)} onValueChange={(valor) => setQuarter(Number(valor))}>
            <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {vistaAnual ? (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <Table className="text-xs">
            <TableHeader><TableRow className="bg-muted/60"><TableHead>Month</TableHead><TableHead>DSAT</TableHead><TableHead>Category</TableHead><TableHead>QA</TableHead><TableHead>Incidencias</TableHead><TableHead>Lateness</TableHead><TableHead>NL</TableHead></TableRow></TableHeader>
            <TableBody>{data.anual.map((fila) => <TableRow key={fila.mes}><TableCell>{fila.etiqueta}</TableCell><TableCell>{porcentaje(fila.dsat)}</TableCell><TableCell>{fila.categoria ?? "NO DATA"}</TableCell><TableCell>{fila.qaFrase ?? "—"}</TableCell><TableCell>{fila.incidencias}</TableCell><TableCell>{fila.tardanzas}</TableCell><TableCell>{porcentaje(fila.nl)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,1fr)_minmax(220px,.85fr)]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.meses.map((item) => <TarjetaMes key={item.mes} mes={item} />)}
            <div className={cn("scorecard-month-card border-scorecard-brand bg-scorecard-total", estadoCategoria(categoria))}>
              <p className="scorecard-label">Q{quarter} Total</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{porcentaje(data.trimestre.porcentaje)}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase text-scorecard-status">{categoria ?? "No data"}</p>
              <p className="mt-3 text-[10px] text-muted-foreground">{data.trimestre.numerador} / {data.trimestre.denominador} = {porcentaje(data.trimestre.porcentaje)}</p>
            </div>
          </div>

          <div className={cn("scorecard-category-card", estadoCategoria(categoria))}>
            <div className="scorecard-award"><Award className="h-5 w-5" /></div>
            <div>
              <p className="scorecard-label">Q{quarter} {year} → Q{quarter === 4 ? 1 : quarter + 1} {categoria === "SUPERSTAR" && <span className="scorecard-rank">★ TOP PERFORMER</span>}</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{categoria ?? "NO DATA"}</p>
            </div>
          </div>

          <div className="scorecard-alert-card">
            <p className="scorecard-label">Alerts</p>
            <div className="mt-2 space-y-1">
              {alertas.map((alerta) => (
                <div key={alerta.texto} className={cn("flex items-center gap-2 rounded px-2 py-1 text-[11px]", alerta.tono === "ok" ? "bg-scorecard-alert text-scorecard-alert-foreground" : alerta.tono === "critico" ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground")}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {alerta.texto}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!vistaAnual && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
            <h2 className="text-sm font-bold text-foreground">CSAT Comments</h2>
            <p className="text-[10px] text-muted-foreground">What parents & students are saying — every DSAT survey this quarter</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3 shadow-sm">
            <div className="mb-3 flex flex-wrap gap-2">
              <Select value={mes === null ? "all" : String(mes)} onValueChange={(valor) => { setMes(valor === "all" ? null : Number(valor)); setPaginaCsat(0); }}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All months</SelectItem>{data.meses.map((item) => <SelectItem key={item.mes} value={String(item.mes)}>{item.etiqueta}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={syllabus ?? "all"} onValueChange={(valor) => { setSyllabus(valor === "all" ? null : valor); setPaginaCsat(0); }}>
                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All syllabuses" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All syllabuses</SelectItem>{(csat?.syllabi ?? []).map((valor: string) => <SelectItem key={valor} value={valor}>{valor}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={clase ?? "all"} onValueChange={(valor) => { setClase(valor === "all" ? null : valor); setPaginaCsat(0); }}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All classes</SelectItem>{(csat?.clases ?? []).map((valor: string) => <SelectItem key={valor} value={valor}>{valor}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex h-8 items-center rounded-md border border-border px-3 text-[11px] text-foreground">{csat?.total ? `Showing ${paginaCsat * POR_PAGINA_CSAT + 1}–${paginaCsat * POR_PAGINA_CSAT + csat.filas.length} of ${csat.total} records` : "0 records"}</div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" disabled={paginaCsat === 0} onClick={() => setPaginaCsat((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!csat || (paginaCsat + 1) * POR_PAGINA_CSAT >= csat.total} onClick={() => setPaginaCsat((p) => p + 1)}>Next</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[850px] text-[11px]">
                <TableHeader><TableRow className="bg-muted/70"><TableHead>Month</TableHead><TableHead>Syllabus</TableHead><TableHead>Class ID</TableHead><TableHead>Experience Comment</TableHead><TableHead>Coach Score</TableHead><TableHead>Coach Comment</TableHead><TableHead>Counts?</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                <TableBody>{(csat?.filas ?? []).length ? (csat?.filas ?? []).map((fila: any) => <TableRow key={fila.id}><TableCell>{String(fila.period_month).slice(0, 7)}</TableCell><TableCell>{fila.syllabus ?? "—"}</TableCell><TableCell>{fila.class_id ?? "—"}</TableCell><TableCell className="max-w-64 whitespace-normal">{fila.experience_comment ?? "—"}</TableCell><TableCell>{fila.coach_score ?? "—"}</TableCell><TableCell className="max-w-64 whitespace-normal">{fila.coach_comment ?? "—"}</TableCell><TableCell>{fila.cuenta ? "Yes" : "No"}</TableCell><TableCell>{fila.cuenta ? "—" : fila.razon_no_cuenta ?? "No score"}</TableCell></TableRow>) : <TableRow><TableCell colSpan={8} className="h-14 text-center text-muted-foreground">{csatConsulta.isError ? <span className="text-destructive">Could not load comments. <Button variant="link" size="sm" onClick={() => csatConsulta.refetch()}>Retry</Button></span> : csatConsulta.isLoading ? "Loading…" : hayFiltrosCsat ? "No comments match these filters." : "No comments this quarter."}</TableCell></TableRow>}</TableBody>
              </Table>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Rows marked “No” do not count toward DSAT — the reason is shown.</p>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
            <h2 className="text-sm font-bold text-foreground">QA Results</h2>
            <p className="text-[10px] text-muted-foreground">Average QA score by QA period · minimum average 7.5</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[...(data.qaMeses ?? []).map((m) => ({ ...m, total: false })), ...(data.qaTotal ? [{ ...data.qaTotal, mes: 0, etiqueta: `Q${quarter} Total`, total: true }] : [])].map((m) => (
              <div key={m.mes} className={cn("scorecard-month-card", m.total && "border-scorecard-brand bg-scorecard-total", m.promedio === null ? "scorecard-empty" : m.bloqueado ? "scorecard-bad" : "scorecard-great")}>
                <p className="scorecard-label">{m.etiqueta}</p>
                <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{m.promedio === null ? "—" : m.promedio.toFixed(2)}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase text-scorecard-status">{m.frase ?? "No data"}</p>
                <p className="mt-3 text-[10px] text-muted-foreground">{m.evaluaciones} {m.evaluaciones === 1 ? "evaluation" : "evaluations"}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
            <h2 className="text-sm font-bold text-foreground">Incidencias — Q{quarter} {year}</h2>
            <p className="text-[10px] text-muted-foreground">Unique days and weeks with incidences · limit is 3 days per quarter</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[...(data.incMeses ?? []).map((m) => ({ ...m, total: false })), ...(data.incTotal ? [{ ...data.incTotal, mes: 0, etiqueta: `Q${quarter} Total`, total: true }] : [])].map((m) => (
              <div key={m.mes} className={cn("scorecard-month-card", m.total && "border-scorecard-brand bg-scorecard-total", m.dias === null ? "scorecard-empty" : m.total && m.dias > 3 ? "scorecard-bad" : "scorecard-great")}>
                <p className="scorecard-label">{m.etiqueta}</p>
                <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{m.dias === null ? "—" : `${m.dias} ${m.dias === 1 ? "día" : "días"}`}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase text-scorecard-status">{m.semanas === null ? "No data" : `${m.semanas} ${m.semanas === 1 ? "semana" : "semanas"}`}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
            <h2 className="text-sm font-bold text-foreground">Locks</h2>
            <p className="text-[10px] text-muted-foreground">Quarter checks · effect on payout pending policy confirmation</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaLock titulo="QA Results" valor={data.qa.frase ?? "No data"} nota={data.qa.frase ? "Minimum average 7.5" : "No QA evaluations this quarter"} accion={() => setMostrarQa((actual) => !actual)} {...(data.qa.frase ? { tono: data.qa.bloqueado || data.qa.advertencia ? ("warning" as const) : ("success" as const) } : {})} />
            <TarjetaLock titulo="Incidencias" valor={String(data.incidencias)} sufijo="days" nota="Limit is 3 days" {...(data.incidencias >= 3 ? { tono: "warning" as const } : {})} />
            <TarjetaLock titulo="Lateness" valor={String(data.tardanzas)} sufijo="events" nota={diferencia === 0 ? "For awareness only" : `${Math.abs(diferencia)} ${diferencia > 0 ? "more" : "fewer"} than prior quarter`} />
            <TarjetaLock titulo="NL" valor={porcentaje(data.nl)} nota={data.nl === null ? "No NL evaluations this quarter" : "≥70% booster pending confirmation"} {...(data.nl !== null && data.nl >= 70 ? { tono: "success" as const } : {})} />
          </div>

          {mostrarQa && (
            <div className="overflow-x-auto rounded-md border border-border bg-card">
              <Table className="text-xs"><TableHeader><TableRow className="bg-muted/60"><TableHead>Date</TableHead><TableHead>Class</TableHead><TableHead>Syllabus</TableHead><TableHead>Level</TableHead><TableHead>Schedule</TableHead><TableHead>Evaluator</TableHead><TableHead>Result</TableHead></TableRow></TableHeader><TableBody>{qaConsulta.isLoading ? <TableRow><TableCell colSpan={7} className="h-12 text-center text-muted-foreground">Loading…</TableCell></TableRow> : qaConsulta.isError ? <TableRow><TableCell colSpan={7} className="h-12 text-center text-destructive">Could not load QA details. <Button variant="link" size="sm" onClick={() => qaConsulta.refetch()}>Retry</Button></TableCell></TableRow> : !(qa?.filas ?? []).length ? <TableRow><TableCell colSpan={7} className="h-12 text-center text-muted-foreground">No QA evaluations this quarter.</TableCell></TableRow> : (qa?.filas ?? []).map((fila: any) => <TableRow key={fila.id}><TableCell>{fila.fecha}</TableCell><TableCell>{fila.clase ?? "—"}</TableCell><TableCell>{fila.syllabus ?? "—"}</TableCell><TableCell>{fila.level ?? "—"}</TableCell><TableCell>{fila.schedule ?? "—"}</TableCell><TableCell>{fila.evaluador ?? "—"}</TableCell><TableCell>{fila.frase ?? "No score"}</TableCell></TableRow>)}</TableBody></Table>
            </div>
          )}
        </>
      )}
    </section>
  );
}