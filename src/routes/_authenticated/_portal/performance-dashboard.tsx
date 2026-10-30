import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Info, Moon, Sparkles, Sun } from "lucide-react";
import {
  comentariosCsat,
  detalleQa,
  directorioCoaches,
  panelDesempeno,
} from "@/lib/performance.functions";
import { SelectorBuscable } from "@/components/selector-buscable";
import { ComentariosCsat } from "@/components/panel/comentarios-csat";
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

type Celda = { valor: string; sub?: string };
type FilaResumen = { clave: string; titulo: string; subtitulo?: string; meses: (Celda & { etiqueta: string })[]; total: Celda; estado: string | null; tono?: "verde" | "amarillo" | "rojo" | undefined };

function tonoEstado(estado: string | null, tono?: string) {
  if (!estado) return "gris";
  if (tono) return tono;
  const e = estado.toUpperCase();
  if (e.includes("ALMOST") || e.includes("NEAR")) return "amarillo";
  if (e.includes("BAD") || e.includes("OFF") || e.includes("BELOW")) return "rojo";
  return "verde";
}

function RetencionPorNivel({ datos, quarter }: { datos: { meses: { mes: number; etiqueta: string; niveles: { nivel: string; retencion: number }[] }[]; total: { nivel: string; retencion: number }[] } | undefined; quarter: number }) {
  const [pestana, setPestana] = useState<number>(0);
  if (!datos) return null;
  const pestanas = [...datos.meses.map((m) => ({ clave: m.mes, etiqueta: m.etiqueta, niveles: m.niveles })), { clave: 0, etiqueta: "Q Total", niveles: datos.total }];
  const actual = pestanas.find((p) => p.clave === pestana) ?? pestanas[pestanas.length - 1]!;
  const tono = (r: number) => (r < 80 ? "border-bad bg-bad/15 text-bad" : r < 90 ? "border-great bg-great/20 text-great-text" : "border-superstar bg-superstar/15 text-superstar");
  return (
    <div className="space-y-2 pt-2">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label={`Retention by level Q${quarter}`}>
        {pestanas.map((p) => (
          <button key={p.clave} type="button" role="tab" aria-selected={p.clave === actual.clave} onClick={() => setPestana(p.clave)}
            className={cn("rounded-md border px-3 py-1 text-xs font-semibold uppercase transition-colors", p.clave === actual.clave ? (p.clave === 0 ? "border-scorecard-brand bg-scorecard-total text-foreground" : "border-primary bg-primary text-primary-foreground") : "border-border bg-card text-muted-foreground hover:bg-muted")}>
            {p.etiqueta}
          </button>
        ))}
      </div>
      <h3 className="text-sm font-bold text-foreground">Retention by Level</h3>
      {actual.niveles.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/40 py-4 text-center text-sm font-semibold uppercase text-muted-foreground">No data</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table className="text-sm">
            <TableHeader><TableRow className="bg-muted/60"><TableHead className="text-[13px] font-semibold uppercase">Level</TableHead><TableHead className="text-right text-[13px] font-semibold uppercase">Retention</TableHead></TableRow></TableHeader>
            <TableBody>
              {actual.niveles.map((n) => (
                <TableRow key={n.nivel}>
                  <TableCell className="py-1.5 text-[14px] font-medium">{n.nivel}</TableCell>
                  <TableCell className="py-1.5 text-right"><span className={cn("rounded-full border px-2.5 py-0.5 text-[13px] font-bold tabular-nums", tono(n.retencion))}>{Math.round(n.retencion)}%</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ResumenScorecard({ filas, abierta, alAbrir, quarter }: { filas: FilaResumen[]; abierta: string | null; alAbrir: (clave: string) => void; quarter: number }) {
  const etiquetas = filas.find((f) => f.meses.length)?.meses.map((m) => m.etiqueta) ?? [];
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-[13px] font-semibold uppercase text-muted-foreground">
            <th className="px-4 py-2 text-left">Metric</th>
            {etiquetas.map((e) => <th key={e} className="px-3 py-2 text-center">{e}</th>)}
            <th className="bg-scorecard-total px-3 py-2 text-center text-scorecard-brand">Q{quarter} Total</th>
            <th className="px-3 py-2 text-center">Status</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const activa = abierta === f.clave;
            const t = tonoEstado(f.estado, f.tono);
            return (
              <tr key={f.clave} onClick={() => alAbrir(f.clave)} aria-expanded={activa} className={cn("cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-scorecard-total/60", activa && "bg-scorecard-total shadow-[inset_3px_0_0_var(--scorecard-brand)]")}>
                <td className="px-4 py-2">
                  <p className={cn("text-[15px] font-bold text-foreground", activa && "text-scorecard-brand")}>{f.titulo}</p>
                  {f.subtitulo && <p className="text-[13px] text-muted-foreground">{f.subtitulo}</p>}
                </td>
                {f.meses.map((m) => (
                  <td key={m.etiqueta} className="px-3 py-2 text-center">
                    <p className="text-[15px] font-semibold tabular-nums text-foreground">{m.valor}</p>
                    {m.sub && <p className="text-[12px] text-muted-foreground">{m.sub}</p>}
                  </td>
                ))}
                <td className="bg-scorecard-total px-3 py-2 text-center">
                  <p className="text-[17px] font-bold tabular-nums text-foreground">{f.total.valor}</p>
                  {f.total.sub && <p className="text-[12px] text-muted-foreground">{f.total.sub}</p>}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn("inline-block rounded-full px-3 py-0.5 text-[12px] font-semibold uppercase whitespace-nowrap", t === "verde" ? "bg-status-ok text-status-ok-foreground" : t === "amarillo" ? "bg-great/20 text-great-text" : t === "rojo" ? "bg-bad/12 text-bad" : "bg-muted text-muted-foreground")}>{f.estado ?? "No data"}</span>
                </td>
                <td className="pr-3 text-muted-foreground"><ChevronDown className={cn("h-4 w-4 transition-transform", activa && "rotate-180")} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  const [syllabus, setSyllabus] = useState<string | null>(null);
  const [clase, setClase] = useState<string | null>(null);
  const [vistaAnual, setVistaAnual] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);


  // Al cambiar coach, año o trimestre, los filtros anteriores dejan de aplicar.
  useEffect(() => {
    setSyllabus(null);
    setClase(null);
    setAbierta(null);
  }, [coachId, year, quarter]);

  const argumentos = { coachId, year, quarter };
  const { data: coaches = [] } = useQuery({ queryKey: ["directorio-coaches"], queryFn: () => directorio() });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["panel", coachId, year, quarter],
    queryFn: () => panel({ data: argumentos }),
  });
  // Trae todos los comentarios del trimestre (en páginas de 100) para que pestañas y resúmenes usen la misma población.
  const csatConsulta = useQuery({
    queryKey: ["csat-todo", coachId, year, quarter, syllabus, clase],
    queryFn: async () => {
      const filas: any[] = [];
      let primera: any = null;
      for (let pagina = 0; pagina < 200; pagina++) {
        const r = await comentarios({ data: { ...argumentos, mes: null, syllabus, clase, texto: null, pagina, porPagina: 100 } });
        primera ??= r;
        filas.push(...r.filas);
        if ((pagina + 1) * 100 >= r.total || !r.filas.length) break;
      }
      return { ...primera, filas };
    },
    placeholderData: (previo) => previo,
  });
  const csat = csatConsulta.data;
  const qaConsulta = useQuery({
    queryKey: ["qa-detalle", coachId, year, quarter],
    queryFn: () => qaDetalle({ data: argumentos }),
    enabled: abierta === "qa",
  });
  const qa = qaConsulta.data;

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

  const categoria = data.trimestre.categoria;
  const alertas = data.alertas;
  const fmt2 = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toFixed(2));
  const dias = (d: number | null) => (d === null ? "—" : `${d} ${d === 1 ? "día" : "días"}`);
  const sem = (w: number | null) => (w === null ? "No data" : `${w} ${w === 1 ? "semana" : "semanas"}`);
  const hiresCelda = (h: any): Celda => h ? { valor: `${h.hires} / ${h.meta ?? "—"}`, sub: `2M+ ${h.cr2m === null ? "—" : `${h.cr2m.toFixed(2)}%`}` } : { valor: "—", sub: "No data" };
  const incTot = data.incTotal;
  const hTot = data.hiresTotal;
  const filasResumen: FilaResumen[] = [
    {
      clave: "qa", titulo: "QA", subtitulo: "Average coach score",
      meses: (data.qaMeses ?? []).map((m: any) => ({ etiqueta: m.etiqueta, valor: fmt2(m.promedio), sub: m.promedio === null ? "No data" : `${m.evaluaciones} ${m.evaluaciones === 1 ? "evaluation" : "evaluations"}` })),
      total: data.qaTotal && data.qaTotal.promedio !== null ? { valor: fmt2(data.qaTotal.promedio), sub: `${data.qaTotal.evaluaciones} evaluations` } : { valor: "—", sub: "No data" },
      estado: data.qaTotal?.frase ?? null,
      tono: data.qaTotal?.promedio == null ? undefined : data.qaTotal.bloqueado ? "rojo" : (data.qa as any)?.advertencia ? "amarillo" : "verde",
    },
    {
      clave: "dsat", titulo: "CSAT",
      meses: data.meses.map((m: any) => ({ etiqueta: m.etiqueta, valor: porcentaje(m.porcentaje) })),
      total: { valor: porcentaje(data.trimestre.porcentaje) },
      estado: categoria ?? null,
    },
    {
      clave: "hires", titulo: "Hires", subtitulo: "Meta + 2M+",
      meses: (data.hiresMeses ?? []).map((m: any) => ({ etiqueta: m.etiqueta, ...hiresCelda(m.datos) })),
      total: hiresCelda(hTot),
      estado: !hTot || !hTot.estado2m ? null : hTot.estado2m === "verde" ? "ON TARGET" : hTot.estado2m === "amarillo" ? "ALMOST THERE" : "OFF TARGET",
    },
    {
      clave: "ret", titulo: "Retention", subtitulo: "CLV + DO",
      meses: (data.retMeses ?? []).map((m: any) => ({ etiqueta: m.etiqueta, valor: m.retencion === null ? "—" : `${Math.round(m.retencion)}%`, sub: m.retencion === null ? "No data" : `DO ${m.doPct === null ? "—" : `${Math.round(m.doPct)}%`} · CLV ${m.clv ?? "—"}` })),
      total: data.retTotal && data.retTotal.retencion !== null ? { valor: `${data.retTotal.retencion.toFixed(2)}%`, sub: `DO ${data.retTotal.doPct === null ? "—" : `${data.retTotal.doPct.toFixed(2)}%`} · CLV ${data.retTotal.clv ?? "—"}` } : { valor: "—", sub: "No data" },
      estado: data.retTotal?.retencion != null ? data.retTotal.categoria ?? null : null,
    },
    {
      clave: "inc", titulo: "Incidencias",
      meses: (data.incMeses ?? []).map((m: any) => ({ etiqueta: m.etiqueta, valor: dias(m.dias), sub: sem(m.semanas) })),
      total: incTot ? { valor: dias(incTot.dias), sub: sem(incTot.semanas) } : { valor: "—", sub: "No data" },
      estado: !incTot || incTot.dias === null ? null : incTot.dias > 3 ? "OFF TARGET" : "ON TARGET",
    },
  ];

  return (
    <section className="scorecard-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-scorecard-orange" />
            <h1 className="text-xl font-bold text-foreground">Coach Scorecard</h1>
          </div>
          <p className="mt-1 text-xs uppercase text-muted-foreground">Coach Performance</p>
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

      <div className="scorecard-coach-banner flex-wrap">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-banner-foreground/30 bg-banner-foreground/10 text-sm font-bold text-banner-foreground">
          {iniciales(data.coach.nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold uppercase text-banner-foreground">{data.coach.nombre}</p>
          <p className="text-xs text-banner-foreground/80">Coach {data.coach.coach_id}{data.coach.tenure ? ` · ${data.coach.tenure}` : ""}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-banner-foreground">Q{quarter} {year}</p>
          <p className="text-xs text-banner-foreground/80">{mesesTexto}</p>
        </div>
        <div className={cn("rounded-full px-4 py-1.5 text-base font-bold", categoria === "BAD" ? "bg-card text-bad" : categoria ? "bg-status-ok text-status-ok-foreground" : "bg-muted text-muted-foreground")}>
          {categoria ?? "NO DATA"}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-sm font-bold text-foreground">Performance Summary — Q{quarter} {year}</h2>
        <div className="flex items-center gap-2">
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
      {vistaAnual && (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <Table className="text-xs">
            <TableHeader><TableRow className="bg-muted/60"><TableHead>Month</TableHead><TableHead>CSAT</TableHead><TableHead>Category</TableHead><TableHead>QA</TableHead><TableHead>Incidencias</TableHead><TableHead>Lateness</TableHead><TableHead>NL</TableHead></TableRow></TableHeader>
            <TableBody>{data.anual.map((fila) => <TableRow key={fila.mes}><TableCell>{fila.etiqueta}</TableCell><TableCell>{porcentaje(fila.dsat)}</TableCell><TableCell>{fila.categoria ?? "NO DATA"}</TableCell><TableCell>{fila.qaFrase ?? "—"}</TableCell><TableCell>{fila.incidencias}</TableCell><TableCell>{fila.tardanzas}</TableCell><TableCell>{porcentaje(fila.nl)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      )}
      {!vistaAnual && (
        <>
          <ResumenScorecard filas={filasResumen} abierta={abierta} alAbrir={(clave) => setAbierta((a) => (a === clave ? null : clave))} quarter={quarter} />

          {abierta === "dsat" && (
            <div className="scorecard-detail">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.meses.map((item) => <TarjetaMes key={item.mes} mes={item} />)}
            <div className={cn("scorecard-month-card border-scorecard-brand bg-scorecard-total", estadoCategoria(categoria))}>
              <p className="scorecard-label">Q{quarter} Total</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{porcentaje(data.trimestre.porcentaje)}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase text-scorecard-status">{categoria ?? "No data"}</p>
            </div>
          </div>

          <ComentariosCsat
            key={`${coachId}-${year}-${quarter}`}
            filas={csat?.filas ?? []}
            quarter={quarter}
            cargando={csatConsulta.isLoading || csatConsulta.isFetching}
            error={csatConsulta.isError}
            reintentar={() => csatConsulta.refetch()}
            filtros={
              <>
                <Select value={syllabus ?? "all"} onValueChange={(valor) => setSyllabus(valor === "all" ? null : valor)}>
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All courses" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All courses</SelectItem>{(csat?.syllabi ?? []).map((valor: string) => <SelectItem key={valor} value={valor}>{valor}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={clase ?? "all"} onValueChange={(valor) => setClase(valor === "all" ? null : valor)}>
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All schedules" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All schedules</SelectItem>{(csat?.clases ?? []).map((valor: string) => <SelectItem key={valor} value={valor}>{valor}</SelectItem>)}</SelectContent>
                </Select>
              </>
            }
          />

            </div>
          )}
          {abierta === "qa" && (
            <div className="scorecard-detail">
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

          <DetalleQa quarter={quarter} consulta={qaConsulta} />
            </div>
          )}
          {abierta === "inc" && <div className="scorecard-detail">
          <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
            <h2 className="text-sm font-bold text-foreground">Incidencias — Q{quarter} {year}</h2>
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

            <DetalleIncidencias quarter={quarter} eventos={data.incDetalle ?? []} />
          </div>}
          {abierta === "ret" && <div className="scorecard-detail">
          <h2 className="pt-1 text-sm font-bold text-foreground">Retention Results</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[...(data.retMeses ?? []).map((m: any) => ({ ...m, total: false, valor: m.retencion === null ? "—" : `${Math.round(m.retencion)}%`, sub: m.retencion === null ? "No data" : `DO ${m.doPct === null ? "—" : `${Math.round(m.doPct)}%`} · CLV ${m.clv ?? "—"}` })),
              { mes: 0, etiqueta: `Q${quarter} Total`, total: true, retencion: data.retTotal?.retencion ?? null, categoria: data.retTotal?.categoria ?? null, valor: data.retTotal?.retencion == null ? "—" : `${data.retTotal.retencion.toFixed(2)}%`, sub: data.retTotal?.retencion == null ? "No data" : `DO ${data.retTotal.doPct === null ? "—" : `${data.retTotal.doPct.toFixed(2)}%`} · CLV ${data.retTotal.clv ?? "—"}` }].map((m: any) => (
              <div key={m.mes} className={cn("scorecard-month-card", m.total && "border-scorecard-brand bg-scorecard-total", m.retencion === null ? "scorecard-empty" : m.categoria === "BAD" ? "scorecard-bad" : "scorecard-great")}>
                <p className="scorecard-label">{m.etiqueta}</p>
                <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{m.valor}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase text-scorecard-status">{m.retencion === null ? "No data" : m.categoria ?? ""}</p>
                <p className="mt-3 text-[10px] text-muted-foreground">{m.sub}</p>
              </div>
            ))}
          </div>
          <RetencionPorNivel key={`${coachId}-${year}-${quarter}`} datos={data.retNiveles} quarter={quarter} />
          </div>}
          {abierta === "hires" && <div className="scorecard-detail">
          <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
            <h2 className="text-sm font-bold text-foreground">Hires — Q{quarter} {year}</h2>
            <p className="text-[10px] text-muted-foreground">Source: HIRES-RD · unique students · 2M+ minimum is 30%</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[...(data.hiresMeses ?? []).map((m) => ({ ...m, total: false })), { mes: 0, etiqueta: `Q${quarter} Total`, datos: data.hiresTotal ?? null, total: true }].map((m) => (
              <div key={m.mes} className={cn("scorecard-month-card", m.total && "border-scorecard-brand bg-scorecard-total", !m.datos && "scorecard-empty")}>
                <p className="scorecard-label">{m.etiqueta}</p>
                {!m.datos ? (
                  <>
                    <p className="mt-2 text-xl font-bold tabular-nums text-foreground">—</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase text-scorecard-status">No data</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-[10px] font-semibold uppercase text-muted-foreground">HIRES / META</p>
                    <p className="text-xl font-bold tabular-nums text-foreground">{m.datos.hires} / {m.datos.meta ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">CR % <span className="font-semibold tabular-nums text-foreground">{m.datos.cr === null ? "—" : `${m.datos.cr.toFixed(2)}%`}</span></p>
                    <p className="mt-3 text-[10px] font-semibold uppercase text-muted-foreground">HIRES 2M+</p>
                    <p className="text-base font-bold tabular-nums text-foreground">{m.datos.hires2m}</p>
                    <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">CR % 2M+ <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums", m.datos.estado2m === "verde" ? "border-superstar bg-superstar/15 text-superstar" : m.datos.estado2m === "amarillo" ? "border-great bg-great/20 text-great-text" : m.datos.estado2m === "rojo" ? "border-bad bg-bad/15 text-bad" : "border-border text-muted-foreground")}>{m.datos.cr2m === null ? "—" : `${m.datos.cr2m.toFixed(2)}%`}</span></p>
                  </>
                )}
              </div>
            ))}
          </div>
          <DetalleHires key={`${coachId}-${year}-${quarter}`} quarter={quarter} total={data.hiresTotal?.hires ?? 0} filas={data.hiresDetalle ?? []} />
          </div>}

          <div className="scorecard-alert-card">
            <p className="scorecard-label">Alerts</p>
            <div className="mt-2 space-y-1">
              {alertas.map((alerta) => (
                <div key={alerta.texto} className={cn("flex items-center gap-2 rounded px-2 py-1 text-[11px]", alerta.tono === "ok" ? "bg-status-ok text-status-ok-foreground" : alerta.tono === "critico" ? "bg-destructive/10 font-medium text-destructive" : "bg-muted text-foreground")}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {alerta.texto}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
            <h2 className="text-sm font-bold text-foreground">Locks</h2>
            <p className="text-[10px] text-muted-foreground">Quarter checks · effect on payout pending policy confirmation</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaLock titulo="QA Results" valor={data.qa.frase ?? "No data"} nota={data.qa.frase ? "Minimum average 7.5" : "No QA evaluations this quarter"} accion={() => setAbierta("qa")} {...(data.qa.frase ? { tono: data.qa.bloqueado || data.qa.advertencia ? ("warning" as const) : ("success" as const) } : {})} />
            <TarjetaLock titulo="Incidencias" valor={String(data.incidencias)} sufijo="days" nota="Limit is 3 days" {...(data.incidencias >= 3 ? { tono: "warning" as const } : {})} />
            <TarjetaLock titulo="Lateness" valor={String(data.tardanzas)} sufijo="late arrivals" nota="Accumulated this quarter" />
            <TarjetaLock titulo="NL" valor={porcentaje(data.nl)} nota={data.nl === null ? "No NL evaluations this quarter" : "≥70% booster pending confirmation"} {...(data.nl !== null && data.nl >= 70 ? { tono: "success" as const } : {})} />
          </div>

        </>
      )}
    </section>
  );
}
const ABREV_QA = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DIC"];
const MESES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fechaLegible = (f: string | null) => {
  if (!f) return "—";
  const [y, m, d] = f.slice(0, 10).split("-");
  return `${MESES_EN[Number(m) - 1]} ${d}, ${y}`;
};

function DetalleHires({ quarter, total, filas }: { quarter: number; total: number; filas: { mes: number; student_id: number; fecha: string | null; trainee: string | null }[] }) {
  const [tab, setTab] = useState(0);
  const meses = [1, 2, 3].map((i) => (quarter - 1) * 3 + i);
  const unicos = (xs: typeof filas) => new Set(xs.map((f) => f.student_id)).size;
  const tabs = [...meses.map((m) => ({ clave: m, etiqueta: ABREV_QA[m - 1], n: unicos(filas.filter((f) => f.mes === m)) })), { clave: 0, etiqueta: "Q TOTAL", n: total }];
  const visibles = tab === 0 ? filas.filter((f, i) => filas.findIndex((g) => g.student_id === f.student_id) === i) : filas.filter((f) => f.mes === tab);
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="rounded-md border border-border border-l-4 border-l-scorecard-brand bg-scorecard-total px-4 py-3">
        {total > 0 ? (
          <p className="text-base font-bold text-foreground">You changed <span className="text-scorecard-orange tabular-nums">{total}</span> {total === 1 ? "life" : "lives"}.</p>
        ) : (
          <p className="text-base font-bold text-foreground">Keep going, Coach.</p>
        )}
        <p className="text-[12px] text-muted-foreground">{total > 0 ? "Thank you, Coach, for helping change futures, one hire at a time." : "Every effort brings you closer to changing a life."}</p>
      </div>
      <div role="tablist" className="flex w-fit flex-wrap gap-1 rounded-md bg-scorecard-total p-1">
        {tabs.map((t) => (
          <button key={t.clave} role="tab" aria-selected={tab === t.clave} onClick={() => setTab(t.clave)}
            className={cn("rounded px-3 py-1.5 text-[13px] font-semibold tabular-nums transition-colors", tab === t.clave ? "bg-scorecard-brand text-primary-foreground shadow-sm" : "text-scorecard-brand hover:bg-card")}>
            {t.etiqueta} ({t.n})
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <Table className="text-[14px]">
          <TableHeader><TableRow className="bg-muted/60 [&>th]:text-[13px] [&>th]:font-semibold">
            <TableHead className="w-40">Hire Date</TableHead><TableHead>Trainee</TableHead><TableHead className="w-24">Level</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {!visibles.length ? <TableRow><TableCell colSpan={3} className="h-12 text-center text-sm text-muted-foreground">No hires recorded for this period.</TableCell></TableRow>
            : visibles.map((f) => (
              <TableRow key={`${f.mes}-${f.student_id}`}>
                <TableCell className="whitespace-nowrap">{fechaLegible(f.fecha)}</TableCell>
                <TableCell>{f.trainee ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DetalleIncidencias({ quarter, eventos }: { quarter: number; eventos: { fecha: string; mes: number; tipo: string }[] }) {
  const [tab, setTab] = useState(0);
  const [tipo, setTipo] = useState("__all");
  const meses = [1, 2, 3].map((i) => (quarter - 1) * 3 + i);
  const tipos = [...new Set(eventos.map((e) => e.tipo))].sort();
  const filtrados = tipo === "__all" ? eventos : eventos.filter((e) => e.tipo === tipo);
  const dias = (xs: typeof eventos) => new Set(xs.map((e) => e.fecha)).size;
  const tabs = [...meses.map((m) => ({ clave: m, etiqueta: ABREV_QA[m - 1], n: dias(filtrados.filter((e) => e.mes === m)) })), { clave: 0, etiqueta: "Q TOTAL", n: dias(filtrados) }];
  const visibles = tab === 0 ? filtrados : filtrados.filter((e) => e.mes === tab);
  const porFecha = new Map<string, Map<string, number>>();
  for (const e of visibles) {
    const m = porFecha.get(e.fecha) ?? new Map<string, number>();
    m.set(e.tipo, (m.get(e.tipo) ?? 0) + 1);
    porFecha.set(e.fecha, m);
  }
  const filas = [...porFecha.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="flex w-fit flex-wrap gap-1 rounded-md bg-scorecard-total p-1">
          {tabs.map((t) => (
            <button key={t.clave} role="tab" aria-selected={tab === t.clave} onClick={() => setTab(t.clave)}
              className={cn("rounded px-3 py-1.5 text-[13px] font-semibold tabular-nums transition-colors", tab === t.clave ? "bg-scorecard-brand text-primary-foreground shadow-sm" : "text-scorecard-brand hover:bg-card")}>
              {t.etiqueta} ({t.n})
            </button>
          ))}
        </div>
        <select aria-label="Incidence type" value={tipo} onChange={(e) => setTipo(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2 text-[12px] font-semibold uppercase text-foreground">
          <option value="__all">All incidence types</option>
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <Table className="text-[14px]">
          <TableHeader><TableRow className="bg-muted/60 [&>th]:text-[13px] [&>th]:font-semibold">
            <TableHead className="w-40">Date</TableHead><TableHead>Incidence Type</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {!filas.length ? <TableRow><TableCell colSpan={2} className="h-12 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">No incidences</TableCell></TableRow>
            : filas.map(([fecha, ts]) => (
              <TableRow key={fecha}>
                <TableCell className="whitespace-nowrap align-top">{fechaLegible(fecha)}</TableCell>
                <TableCell><div className="flex flex-wrap gap-1">{[...ts.entries()].map(([t, n]) => (
                  <span key={t} className="rounded bg-muted px-2 py-0.5 text-[12px] font-semibold uppercase text-foreground">{t}{n > 1 ? ` ×${n}` : ""}</span>
                ))}</div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DetalleQa({ quarter, consulta }: { quarter: number; consulta: any }) {
  const [tab, setTab] = useState(0);
  const filas: any[] = consulta.data?.filas ?? [];
  const meses = [1, 2, 3].map((i) => (quarter - 1) * 3 + i);
  const ordenar = (xs: any[]) => [...xs].sort((a, b) => (a.fechaMonitoreo === b.fechaMonitoreo ? a.id - b.id : a.fechaMonitoreo < b.fechaMonitoreo ? -1 : 1));
  const visibles = ordenar(tab === 0 ? filas : filas.filter((f) => f.mes === tab));
  const tabs = [...meses.map((m) => ({ clave: m, etiqueta: ABREV_QA[m - 1], n: filas.filter((f) => f.mes === m).length })), { clave: 0, etiqueta: "Q TOTAL", n: filas.length }];
  const cols = 8;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div role="tablist" className="flex w-fit flex-wrap gap-1 rounded-md bg-scorecard-total p-1">
        {tabs.map((t) => (
          <button key={t.clave} role="tab" aria-selected={tab === t.clave} onClick={() => setTab(t.clave)}
            className={cn("rounded px-3 py-1.5 text-[13px] font-semibold tabular-nums transition-colors", tab === t.clave ? "bg-scorecard-brand text-primary-foreground shadow-sm" : "text-scorecard-brand hover:bg-card")}>
            {t.etiqueta} ({t.n})
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <Table className="text-[14px]">
          <TableHeader><TableRow className="bg-muted/60 [&>th]:text-[13px] [&>th]:font-semibold">
            <TableHead>Monitoring Date</TableHead><TableHead>Quality Type</TableHead><TableHead>Level</TableHead><TableHead>Schedule</TableHead><TableHead>Score</TableHead><TableHead>Result</TableHead><TableHead>Trend</TableHead><TableHead>Evaluator</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {consulta.isLoading ? <TableRow><TableCell colSpan={cols} className="h-12 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            : consulta.isError ? <TableRow><TableCell colSpan={cols} className="h-12 text-center text-destructive">Could not load QA details. <Button variant="link" size="sm" onClick={() => consulta.refetch()}>Retry</Button></TableCell></TableRow>
            : !visibles.length ? <TableRow><TableCell colSpan={cols} className="h-12 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">No QA evaluations</TableCell></TableRow>
            : visibles.map((f) => {
              const tono = f.nota == null ? "bg-muted text-muted-foreground" : f.frase === "Almost There" ? "bg-great/25 text-great-text" : f.bloqueado ? "bg-bad/15 text-bad" : "bg-status-ok text-status-ok-foreground";
              const t = f.tendencia;
              return (
                <TableRow key={f.id}>
                  <TableCell className="whitespace-nowrap">{fechaLegible(f.fechaMonitoreo)}</TableCell>
                  <TableCell>{f.syllabus ?? "—"}</TableCell>
                  <TableCell>{f.level ?? "—"}</TableCell>
                  <TableCell>{f.schedule ?? "—"}</TableCell>
                  <TableCell><span className={cn("inline-block rounded px-2 py-0.5 text-[15px] font-semibold tabular-nums", tono)}>{f.nota == null ? "—" : Number(f.nota).toFixed(2)}</span></TableCell>
                  <TableCell><span className={cn("rounded px-2 py-0.5 text-[12px] font-semibold uppercase", tono)}>{f.frase ?? "No data"}</span></TableCell>
                  <TableCell className={cn("whitespace-nowrap text-[13px] font-semibold tabular-nums", t == null ? "text-muted-foreground" : t > 0 ? "text-status-ok-foreground" : t < 0 ? "text-bad" : "text-muted-foreground")}>
                    {t == null ? "—" : `${t > 0 ? "↑ +" : t < 0 ? "↓ " : "→ "}${t.toFixed(2)}`}{t != null && <span className="ml-1 font-normal text-muted-foreground">vs previous</span>}
                  </TableCell>
                  <TableCell className="text-[13px]">{f.evaluador ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
