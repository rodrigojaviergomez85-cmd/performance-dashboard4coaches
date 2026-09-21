import { cn } from "@/lib/utils";

export function EtiquetaCategoria({ valor }: { valor: string | null }) {
  if (!valor) return <span className="text-muted-foreground">—</span>;
  const estilos: Record<string, string> = {
    SUPERSTAR: "bg-superstar text-superstar-foreground",
    GREAT: "bg-great text-great-foreground",
    BAD: "bg-bad text-bad-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        estilos[valor] ?? "bg-muted text-muted-foreground",
      )}
    >
      {valor}
    </span>
  );
}

export function Tarjeta({
  titulo,
  valor,
  detalle,
  pie,
  destacado,
}: {
  titulo: string;
  valor: string;
  detalle?: string | null;
  pie?: React.ReactNode;
  destacado?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5",
        destacado && "ring-1 ring-primary/30",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>}
      {pie && <div className="mt-3">{pie}</div>}
    </div>
  );
}
