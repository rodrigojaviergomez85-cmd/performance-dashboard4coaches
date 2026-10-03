import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import {
  cambiarEstadoCoach,
  listarCoaches,
  previsualizarCoaches,
  sincronizarCoaches,
} from "@/lib/coaches.functions";
import { entero as enteroEstricto } from "@/lib/hoja-calculo";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_authenticated/_admin/coaches")({
  head: () => ({
    meta: [
      { title: "Coaches | Portal de Coaches E4CC" },
      {
        name: "description",
        content: "Lista de coaches activos del Portal de Coaches E4CC.",
      },
      { property: "og:title", content: "Coaches | Portal de Coaches E4CC" },
      {
        property: "og:description",
        content: "Lista de coaches activos del Portal de Coaches E4CC.",
      },
    ],
  }),
  component: PaginaCoaches,
});

const TODOS = "__todos__";

type FilaCarga = {
  coach_id: number;
  nombre: string;
  email: string;
  pais: string | null;
  sucursal: string | null;
  id_coordinador: number | null;
  coordinador: string | null;
  estado: string | null;
  categoria: string | null;
  tenure: string | null;
};

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const limpio = String(valor).trim();
  return limpio === "" ? null : limpio;
}

const entero = enteroEstricto;

function PaginaCoaches() {
  const obtener = useServerFn(listarCoaches);
  const sincronizar = useServerFn(sincronizarCoaches);
  const queryClient = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);

  const [busqueda, setBusqueda] = useState("");
  const [pais, setPais] = useState(TODOS);
  const [sucursal, setSucursal] = useState(TODOS);
  const [coordinador, setCoordinador] = useState(TODOS);
  const [idCoach, setIdCoach] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: coaches = [], isLoading } = useQuery({
    queryKey: ["coaches"],
    queryFn: () => obtener(),
  });

  const previsualizar = useServerFn(previsualizarCoaches);
  const cambiarEstado = useServerFn(cambiarEstadoCoach);
  const [pendiente, setPendiente] = useState<{
    filas: FilaCarga[];
    omitidas: number;
    impacto: Awaited<ReturnType<typeof previsualizarCoaches>>;
  } | null>(null);
  const [desactivar, setDesactivar] = useState(false);

  const carga = useMutation({
    mutationFn: (v: { filas: FilaCarga[]; desactivar: boolean }) =>
      sincronizar({ data: { filas: v.filas, desactivarAusentes: v.desactivar } }),
    onSuccess: (r) => {
      setMensaje(
        `Lista actualizada: ${r.nuevos} nuevos, ${r.actualizados} actualizados, ${r.desactivados} desactivados.`,
      );
      setPendiente(null);
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const estado = useMutation({
    mutationFn: (v: { id: string; activo: boolean }) => cambiarEstado({ data: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coaches"] }),
    onError: (e: Error) => setError(e.message),
  });

  async function alSeleccionarArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    setMensaje(null);
    setError(null);

    try {
      const datos = new Uint8Array(await archivo.arrayBuffer());
      const libro = XLSX.read(datos, { type: "array" });
      const hoja = libro.Sheets[libro.SheetNames[0]!]!;

      // Algunos archivos declaran un rango incorrecto; se recalcula con las celdas reales.
      let maxFila = 0;
      let maxCol = 0;
      for (const direccion of Object.keys(hoja)) {
        if (direccion.startsWith("!")) continue;
        const celda = XLSX.utils.decode_cell(direccion);
        if (celda.r > maxFila) maxFila = celda.r;
        if (celda.c > maxCol) maxCol = celda.c;
      }
      hoja["!ref"] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: maxFila, c: maxCol },
      });

      const crudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
        defval: null,
      });



      // Los encabezados se comparan sin acentos ni mayúsculas.
      const clave = (t: string) =>
        t
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase();

      const filas: FilaCarga[] = [];
      let omitidas = 0;
      for (const cruda of crudas) {
        const fila: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(cruda)) fila[clave(k)] = v;

        const coachId = entero(fila["id coach"]);
        const nombre = texto(fila["coach"]);
        if (coachId === null || !nombre) {
          if (Object.values(fila).some((v) => texto(v) !== null)) omitidas++;
          continue;
        }
        filas.push({
          coach_id: coachId,
          nombre,
          email: texto(fila["correo coach"]) ?? "",
          pais: texto(fila["pais"]),
          sucursal: texto(fila["sucursal"]),
          id_coordinador: entero(fila["id coordinador"]),
          coordinador: texto(fila["coordinador"]),
          estado: texto(fila["estado"]),
          categoria: texto(fila["categoria"]),
          tenure: texto(fila["tenure"]),
        });
      }


      if (filas.length === 0) {
        setError("El archivo no contiene columnas Id Coach y Coach con datos.");
        return;
      }
      const impacto = await previsualizar({ data: { filas } });
      setDesactivar(false);
      setPendiente({ filas, omitidas, impacto });
    } catch (e) {
      setError(`No se pudo leer el archivo: ${(e as Error).message}`);
    }
  }

  const opciones = useMemo(() => {
    const unicos = (clave: "pais" | "sucursal" | "coordinador") =>
      [...new Set(coaches.map((c) => c[clave]).filter((v): v is string => !!v))].sort(
        (a, b) => a.localeCompare(b, "es"),
      );
    return {
      pais: unicos("pais"),
      sucursal: unicos("sucursal"),
      coordinador: unicos("coordinador"),
    };
  }, [coaches]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return coaches.filter((c) => {
      if (termino && !c.nombre.toLowerCase().includes(termino)) return false;
      if (pais !== TODOS && c.pais !== pais) return false;
      if (sucursal !== TODOS && c.sucursal !== sucursal) return false;
      if (coordinador !== TODOS && c.coordinador !== coordinador) return false;
      if (idCoach.trim() && !String(c.coach_id).includes(idCoach.trim())) return false;
      return true;
    });
  }, [coaches, busqueda, pais, sucursal, coordinador, idCoach]);

  function limpiar() {
    setBusqueda("");
    setPais(TODOS);
    setSucursal(TODOS);
    setCoordinador(TODOS);
    setIdCoach("");
  }

  return (
    <section className="px-8 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Coaches</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cargue el archivo mensual en formato xlsx. Antes de aplicar verá el impacto; los
            coaches ausentes solo se desactivan si usted lo confirma.
          </p>
        </div>
        <div>
          <input
            ref={entrada}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={alSeleccionarArchivo}
          />
          <Button onClick={() => entrada.current?.click()} disabled={carga.isPending}>
            {carga.isPending ? "Cargando..." : "Cargar lista (xlsx)"}
          </Button>
        </div>
      </div>

      {mensaje ? (
        <p className="mt-4 rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {mensaje}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Buscar coach por nombre"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Select value={pais} onValueChange={setPais}>
          <SelectTrigger>
            <SelectValue placeholder="País" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los países</SelectItem>
            {opciones.pais.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sucursal} onValueChange={setSucursal}>
          <SelectTrigger>
            <SelectValue placeholder="Sucursal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las sucursales</SelectItem>
            {opciones.sucursal.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={coordinador} onValueChange={setCoordinador}>
          <SelectTrigger>
            <SelectValue placeholder="Coordinador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los coordinadores</SelectItem>
            {opciones.coordinador.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            placeholder="Id Coach"
            value={idCoach}
            onChange={(e) => setIdCoach(e.target.value)}
          />
          <Button variant="outline" onClick={limpiar}>
            Limpiar
          </Button>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {filtrados.length} de {coaches.length} coaches
      </p>

      <div className="mt-3 overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>País</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Coordinador</TableHead>
              <TableHead>Id Coach</TableHead>
              <TableHead>Coach</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay coaches para mostrar.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.pais ?? "-"}</TableCell>
                  <TableCell>{c.sucursal ?? "-"}</TableCell>
                  <TableCell>{c.coordinador ?? "-"}</TableCell>
                  <TableCell>{c.coach_id}</TableCell>
                  <TableCell className="font-medium text-foreground">{c.nombre}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={c.activo ? "text-foreground" : "text-muted-foreground"}>
                        {c.activo ? "Activo" : "Inactivo"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={estado.isPending}
                        onClick={() => estado.mutate({ id: c.id, activo: !c.activo })}
                      >
                        {c.activo ? "Desactivar" : "Reactivar"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!pendiente} onOpenChange={(v) => !v && setPendiente(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar cambios antes de aplicar</DialogTitle>
          </DialogHeader>
          {pendiente && (
            <div className="space-y-3 text-sm text-foreground">
              <ul className="space-y-1">
                <li>{pendiente.impacto.enArchivo} coaches en el archivo</li>
                <li>{pendiente.impacto.nuevos} nuevos</li>
                <li>{pendiente.impacto.actualizados} con datos actualizados</li>
                {pendiente.impacto.inactivosEnArchivo > 0 && (
                  <li>{pendiente.impacto.inactivosEnArchivo} desactivados siguen inactivos (se reactivan a mano)</li>
                )}
                {pendiente.impacto.protegidos > 0 && (
                  <li>{pendiente.impacto.protegidos} cuentas de administración o revisión no se modifican</li>
                )}
                {pendiente.omitidas > 0 && <li>{pendiente.omitidas} filas sin Id Coach o nombre válidos se omiten</li>}
                <li>
                  {pendiente.impacto.ausentes} de {pendiente.impacto.activos} coaches activos no están en el archivo
                </li>
              </ul>
              {pendiente.impacto.ausentes > 0 && (
                <label className="flex items-center gap-2">
                  <Checkbox checked={desactivar} onCheckedChange={(v) => setDesactivar(v === true)} />
                  Desactivar a los {pendiente.impacto.ausentes} ausentes (no se borran)
                </label>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendiente(null)}>Cancelar</Button>
            <Button
              disabled={carga.isPending}
              onClick={() => pendiente && carga.mutate({ filas: pendiente.filas, desactivar })}
            >
              {carga.isPending ? "Aplicando..." : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
