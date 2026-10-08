import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { guardarPeriodoQa, listarPeriodosQa } from "@/lib/academic.functions";
import { hoyLocal, periodoPorDefecto, seSolapan, type PeriodoQa } from "@/lib/periodos-qa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmt = (f: string) => f.split("-").reverse().join("/");

/** Selector de Período QA: entrega start_date/end_date al padre. */
export function SelectorPeriodoQa({ alCambiar }: { alCambiar: (rango: { desde: string; hasta: string } | null) => void }) {
  const listar = useServerFn(listarPeriodosQa);
  const { data: periodos = [], isLoading } = useQuery({
    queryKey: ["qa-periodos"],
    queryFn: () => listar() as Promise<PeriodoQa[]>,
  });
  const [id, setId] = useState<string | null>(null);
  const [config, setConfig] = useState(false);

  const actual = periodos.find((p) => p.id === id) ?? null;
  useEffect(() => {
    if (!periodos.length) return void (isLoading || alCambiar(null));
    const elegido = actual ?? periodoPorDefecto(periodos, hoyLocal());
    if (elegido && elegido.id !== id) setId(elegido.id);
    if (elegido) alCambiar({ desde: elegido.start_date, hasta: elegido.end_date });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodos, id, actual?.start_date, actual?.end_date]);

  return (
    <>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Período QA</Label>
        <Select value={id ?? undefined} onValueChange={setId}>
          <SelectTrigger className="h-9 w-56 text-sm">
            <SelectValue placeholder={isLoading ? "Cargando…" : "Sin períodos"} />
          </SelectTrigger>
          <SelectContent>
            {periodos.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        {actual && <p className="text-xs text-muted-foreground">{fmt(actual.start_date)} – {fmt(actual.end_date)}</p>}
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setConfig(true)}>
          Configurar períodos QA
        </Button>
      </div>
      <ConfigPeriodos abierto={config} alCerrar={() => setConfig(false)} periodos={periodos} />
    </>
  );
}

const vacio = { label: "", month: "", year: "", start_date: "", end_date: "" };

function ConfigPeriodos({ abierto, alCerrar, periodos }: { abierto: boolean; alCerrar: () => void; periodos: PeriodoQa[] }) {
  const guardar = useServerFn(guardarPeriodoQa);
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<string | null>(null);
  const [f, setF] = useState(vacio);

  const reiniciar = () => { setEditando(null); setF(vacio); };
  const choque = f.start_date && f.end_date
    ? periodos.find((p) => p.id !== editando && seSolapan(p, f)) : undefined;
  const error = !f.start_date || !f.end_date ? null
    : f.end_date < f.start_date ? "La fecha fin debe ser igual o posterior a la fecha inicio."
    : choque ? `Se solapa con "${choque.label}".` : null;
  const completo = f.label.trim() && Number(f.month) >= 1 && Number(f.month) <= 12 && Number(f.year) >= 2000 && f.start_date && f.end_date;

  const m = useMutation({
    mutationFn: () => guardar({ data: {
      id: editando ?? undefined, label: f.label.trim(), month: Number(f.month), year: Number(f.year),
      start_date: f.start_date, end_date: f.end_date,
    } }),
    onSuccess: () => {
      toast.success(editando ? "Período actualizado" : "Período creado");
      reiniciar();
      queryClient.invalidateQueries({ queryKey: ["qa-periodos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={abierto} onOpenChange={(v) => { if (!v) { reiniciar(); alCerrar(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Períodos QA</DialogTitle></DialogHeader>
        <div className="max-h-56 overflow-y-auto rounded-md border border-border">
          {periodos.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Aún no hay períodos.</p>
          ) : periodos.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-0">
              <span className="text-foreground">{p.label}</span>
              <span className="ml-auto mr-2 text-muted-foreground">{fmt(p.start_date)} – {fmt(p.end_date)}</span>
              <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => {
                setEditando(p.id);
                setF({ label: p.label, month: String(p.month), year: String(p.year), start_date: p.start_date, end_date: p.end_date });
              }}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Nombre del período</Label>
            <Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Septiembre 2026" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mes</Label>
            <Input type="number" min={1} max={12} value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} className="h-9 text-sm" />
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Año</Label>
            <Input type="number" min={2000} max={2100} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} className="h-9 text-sm" />
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Fecha inicio</Label>
            <Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} className="h-9 text-sm" />
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Fecha fin</Label>
            <Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} className="h-9 text-sm" />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          {editando && <Button variant="outline" onClick={reiniciar}>Nuevo período</Button>}
          <Button disabled={!completo || !!error || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Guardando…" : editando ? "Guardar cambios" : "Crear período"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
