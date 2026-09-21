import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  actualizarApplicable,
  cargarAcademico,
  eliminarAcademico,
  listarAcademico,
} from "@/lib/academic.functions";
import type { ConfigPestana } from "@/lib/academico-config";
import { leerHoja, rangoMesActual } from "@/lib/hoja-calculo";
import { MultiFiltro } from "@/components/multi-filtro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const POR_PAGINA = 50;

interface Vista {
  registros: Record<string, unknown>[];
  problemas: string[];
}

export function PestanaAcademica({ config }: { config: ConfigPestana }) {
  const listar = useServerFn(listarAcademico);
  const cargar = useServerFn(cargarAcademico);
  const eliminar = useServerFn(eliminarAcademico);
  const cambiarApplicable = useServerFn(actualizarApplicable);
  const queryClient = useQueryClient();
  const entradaArchivo = useRef<HTMLInputElement>(null);

  const inicial = rangoMesActual();
  const [desde, setDesde] = useState(inicial.desde);
  const [hasta, setHasta] = useState(inicial.hasta);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<Record<string, string[]>>({});
  const [pagina, setPagina] = useState(0);

  const [dialogo, setDialogo] = useState(false);
  const [mes, setMes] = useState(inicial.desde.slice(0, 7));
  const [token, setToken] = useState("");
  const [vista, setVista] = useState<Vista | null>(null);

  const clave = ["academico", config.clave, desde, hasta];

  const { data: filas = [], isLoading } = useQuery({
    queryKey: clave,
    queryFn: () => listar({ data: { tabla: config.clave, desde, hasta } }),
  });

  const opcionesDe = (columna: string) =>
    [...new Set(filas.map((f) => f[columna]).filter((v) => v != null && v !== ""))]
      .map(String)
      .sort();

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      for (const [columna, valores] of Object.entries(filtros)) {
        if (valores.length && !valores.includes(String(f[columna] ?? ""))) return false;
      }
      if (!texto) return true;
      return config.busqueda.some((c) => String(f[c] ?? "").toLowerCase().includes(texto));
    });
  }, [filas, filtros, busqueda, config.busqueda]);

  const paginadas = filtradas.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA);

  const carga = useMutation({
    mutationFn: (registros: Record<string, unknown>[]) =>
      cargar({
        data: {
          tabla: config.clave,
          filas: registros,
          reemplazarRango: config.reemplazarRango ?? false,
          desde,
          hasta,
        },
      }),
    onSuccess: (r) => {
      toast.success(`${r.insertadas} filas agregadas`, {
        description: r.omitidas ? `${r.omitidas} repetidas se omitieron.` : undefined,
      });
      setDialogo(false);
      setVista(null);
      queryClient.invalidateQueries({ queryKey: ["academico", config.clave] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const borrado = useMutation({
    mutationFn: (id: string) => eliminar({ data: { tabla: config.clave, id } }),
    onSuccess: () => {
      toast.success("Registro eliminado");
      queryClient.invalidateQueries({ queryKey: ["academico", config.clave] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applicable = useMutation({
    mutationFn: (v: { id: string; valor: number }) =>
      cambiarApplicable({
        data: { tabla: config.clave as "qa" | "dsat" | "abs", id: v.id, valor: v.valor },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academico", config.clave] }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function alElegirArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;

    try {
      const crudas = await leerHoja(archivo);
      const registros: Record<string, unknown>[] = [];
      const problemas: string[] = [];

      crudas.forEach((fila, i) => {
        const r = config.mapear(fila, { mes, token: token.trim() || null });
        if (r.registro) registros.push(r.registro);
        else if (r.problema && problemas.length < 20)
          problemas.push(`Fila ${i + 2}: ${r.problema}`);
      });

      const finales = config.agrupar ? config.agrupar(registros) : registros;
      if (!finales.length) {
        toast.error("El archivo no tiene filas válidas", { description: problemas[0] });
        return;
      }
      setVista({ registros: finales, problemas });
    } catch (e) {
      toast.error("No se pudo leer el archivo", { description: (e as Error).message });
    }
  }

  const formato = (valor: unknown) => {
    if (valor === null || valor === undefined || valor === "") return "—";
    return String(valor);
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Desde</Label>
          <Input
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setPagina(0);
            }}
            className="h-9 w-40 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Hasta</Label>
          <Input
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setPagina(0);
            }}
            className="h-9 w-40 text-sm"
          />
        </div>
        <Input
          placeholder="Buscar coach"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(0);
          }}
          className="h-9 w-52 text-sm"
        />
        {config.filtros.map((f) => (
          <MultiFiltro
            key={f.clave}
            etiqueta={f.etiqueta}
            opciones={opcionesDe(f.clave)}
            seleccion={filtros[f.clave] ?? []}
            alCambiar={(valores) => {
              setFiltros({ ...filtros, [f.clave]: valores });
              setPagina(0);
            }}
          />
        ))}
        <div className="ml-auto">
          <Button size="sm" onClick={() => setDialogo(true)}>
            Cargar archivo
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50">
              {config.columnas.map((c) => (
                <TableHead key={c.clave} className={c.alineacion === "derecha" ? "text-right" : ""}>
                  {c.etiqueta}
                </TableHead>
              ))}
              {config.applicable && <TableHead className="text-right">Applicable</TableHead>}
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={config.columnas.length + 2}
                  className="py-8 text-center text-muted-foreground"
                >
                  Cargando…
                </TableCell>
              </TableRow>
            ) : paginadas.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={config.columnas.length + 2}
                  className="py-8 text-center text-muted-foreground"
                >
                  Sin registros en este periodo.
                </TableCell>
              </TableRow>
            ) : (
              paginadas.map((fila) => (
                <TableRow key={String(fila["id"])}>
                  {config.columnas.map((c) => (
                    <TableCell
                      key={c.clave}
                      className={c.alineacion === "derecha" ? "text-right" : ""}
                    >
                      {formato(fila[c.clave])}
                    </TableCell>
                  ))}
                  {config.applicable && (
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        defaultValue={Number(fila["applicable"] ?? 1)}
                        onBlur={(e) => {
                          const valor = Number(e.target.value) ? 1 : 0;
                          if (valor !== Number(fila["applicable"] ?? 1))
                            applicable.mutate({ id: String(fila["id"]), valor });
                        }}
                        className="ml-auto h-8 w-16 text-right text-sm"
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar"
                      onClick={() => borrado.mutate(String(fila["id"]))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filtradas.length === 0
            ? "Sin registros"
            : `Mostrando ${pagina * POR_PAGINA + 1}–${Math.min(
                (pagina + 1) * POR_PAGINA,
                filtradas.length,
              )} de ${filtradas.length}`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagina === 0}
            onClick={() => setPagina((p) => p - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(pagina + 1) * POR_PAGINA >= filtradas.length}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <Dialog
        open={dialogo}
        onOpenChange={(v) => {
          setDialogo(v);
          if (!v) setVista(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cargar archivo de {config.titulo}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {config.requiereMes && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Mes del archivo</Label>
                <Input
                  type="month"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="h-9 w-48 text-sm"
                />
              </div>
            )}
            {config.requiereToken && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Token del operador</Label>
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Identificador de esta carga"
                  className="h-9 w-64 text-sm"
                />
              </div>
            )}

            <input
              ref={entradaArchivo}
              type="file"
              accept={config.aceptar}
              className="hidden"
              onChange={alElegirArchivo}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => entradaArchivo.current?.click()}
              disabled={(config.requiereToken && !token.trim()) || (config.requiereMes && !mes)}
            >
              Elegir archivo
            </Button>

            {config.reemplazarRango && (
              <p className="text-xs text-muted-foreground">
                La carga reemplaza lo que ya exista entre las fechas seleccionadas arriba.
              </p>
            )}

            {vista && (
              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  {vista.registros.length} filas listas para guardar.
                </p>
                {vista.problemas.length > 0 && (
                  <ul className="max-h-32 overflow-y-auto rounded-md border border-border p-2 text-xs text-muted-foreground">
                    {vista.problemas.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!vista || carga.isPending}
              onClick={() => vista && carga.mutate(vista.registros)}
            >
              {carga.isPending ? "Guardando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
