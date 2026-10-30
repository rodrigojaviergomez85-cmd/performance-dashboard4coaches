import { useMemo, useState } from "react";
import { MessageSquareText, MessageSquareWarning, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { grupoComentarioCsat, ordenarComentariosCsat, tonoNotaCsat } from "@/lib/reglas";

type Fila = {
  id: number;
  period_month: string;
  syllabus: string | null;
  class_id: string | null;
  horario?: string | null;
  experience_comment: string | null;
  coach_comment: string | null;
  coach_score: number | null;
  cuenta: boolean;
  razon_no_cuenta: string | null;
};

const ABREV = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const mesDe = (f: Fila) => Number(String(f.period_month).slice(5, 7));

export function ComentariosCsat({
  filas,
  quarter,
  cargando,
  error,
  reintentar,
  filtros,
}: {
  filas: Fila[];
  quarter: number;
  cargando: boolean;
  error: boolean;
  reintentar: () => void;
  filtros: React.ReactNode;
}) {
  const [tab, setTab] = useState<number>(0); // 0 = Q TOTAL
  const meses = [1, 2, 3].map((i) => (quarter - 1) * 3 + i);

  const visibles = useMemo(() => (tab === 0 ? filas : filas.filter((f) => mesDe(f) === tab)), [filas, tab]);
  const ordenadas = useMemo(() => ordenarComentariosCsat(visibles), [visibles]);
  const detractores = ordenadas.filter((f) => grupoComentarioCsat(f.coach_score) === "detractor");
  const positivos = ordenadas.filter((f) => grupoComentarioCsat(f.coach_score) === "positivo");
  const sinNota = ordenadas.filter((f) => grupoComentarioCsat(f.coach_score) === null);

  const tabs = [
    ...meses.map((m) => ({ clave: m, etiqueta: ABREV[m - 1], n: filas.filter((f) => mesDe(f) === m).length })),
    { clave: 0, etiqueta: "Q TOTAL", n: filas.length },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground">CSAT Comments</h2>
        <div role="tablist" className="flex flex-wrap gap-1 rounded-md bg-scorecard-total p-1">
          {tabs.map((t) => (
            <button
              key={t.clave}
              role="tab"
              aria-selected={tab === t.clave}
              onClick={() => setTab(t.clave)}
              className={cn(
                "rounded px-3 py-1.5 text-[13px] font-semibold tabular-nums transition-colors",
                tab === t.clave ? "bg-scorecard-brand text-primary-foreground shadow-sm" : "text-scorecard-brand hover:bg-card",
              )}
            >
              {t.etiqueta} ({t.n})
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">{filtros}</div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Resumen titulo="Detractors" valor={detractores.length} nota="Scores 1–8" icono={MessageSquareWarning} clase="border-bad/25 bg-bad/10 text-bad" />
        <Resumen titulo="Positive" valor={positivos.length} nota="Scores 9–10" icono={MessageSquareText} clase="border-status-ok-foreground/25 bg-status-ok/60 text-status-ok-foreground" />
        <Resumen titulo="Total comments" valor={ordenadas.length} nota="With comments" icono={MessagesSquare} clase="border-scorecard-brand/20 bg-scorecard-total text-scorecard-brand" />
      </div>

      {error ? (
        <p className="py-6 text-center text-sm text-destructive">
          Could not load comments. <Button variant="link" size="sm" onClick={reintentar}>Retry</Button>
        </p>
      ) : cargando && !filas.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : !ordenadas.length ? (
        <p className="rounded-md border border-dashed border-border py-6 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">No comments</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Grupo titulo="Detractors (1–8)" filas={detractores} acento="border-l-bad" />
          <Grupo titulo="Positive (9–10)" filas={positivos} acento="border-l-status-ok-foreground" />
          {sinNota.length > 0 && <Grupo titulo="No score" filas={sinNota} acento="border-l-border" />}
        </div>
      )}
    </div>
  );
}

function Resumen({ titulo, valor, nota, icono: Icono, clase }: { titulo: string; valor: number; nota: string; icono: typeof MessagesSquare; clase: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-md border px-4 py-3", clase)}>
      <Icono className="h-5 w-5 shrink-0 opacity-80" strokeWidth={1.6} aria-hidden="true" />
      <div>
        <p className="text-[13px] font-semibold uppercase">{titulo}</p>
        <p className="text-2xl font-bold tabular-nums text-foreground">{valor}</p>
        <p className="text-xs text-muted-foreground">{nota}</p>
      </div>
    </div>
  );
}

function Grupo({ titulo, filas, acento }: { titulo: string; filas: Fila[]; acento: string }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-base font-bold text-foreground">{titulo}</h3>
        <span className="text-xs text-muted-foreground">{filas.length} {filas.length === 1 ? "comment" : "comments"}</span>
      </div>
      {filas.length === 0 ? (
        <p className="text-xs uppercase text-muted-foreground">No comments</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {filas.map((f) => <FilaComentario key={f.id} fila={f} acento={acento} />)}
        </ul>
      )}
    </section>
  );
}

function FilaComentario({ fila, acento }: { fila: Fila; acento: string }) {
  const tono = tonoNotaCsat(fila.coach_score);
  const badge =
    tono === "rojo" ? "bg-bad/15 text-bad" : tono === "ambar" ? "bg-great/25 text-great-text" : tono === "verde" ? "bg-status-ok text-status-ok-foreground" : "bg-muted text-muted-foreground";
  const m = mesDe(fila);
  return (
    <li className={cn("flex gap-3 border-l-[3px] px-3 py-2.5", acento)}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[15px] font-bold tabular-nums", badge)}>
        {fila.coach_score ?? "—"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-snug text-foreground">{fila.coach_comment ?? <span className="text-muted-foreground">No coach comment</span>}</p>
        {fila.experience_comment && <p className="mt-1 text-[13px] leading-snug text-muted-foreground">Experience: {fila.experience_comment}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {ABREV[m - 1] ?? String(fila.period_month).slice(0, 7)} · {fila.syllabus ?? "—"} · {fila.horario ?? "No schedule"}
          {!fila.cuenta && <span className="ml-1 font-medium">· Not counted: {fila.razon_no_cuenta ?? "No score"}</span>}
        </p>
      </div>
    </li>
  );
}
