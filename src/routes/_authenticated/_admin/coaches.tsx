import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { listarCoaches, sincronizarCoaches } from "@/lib/coaches.functions";
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

function entero(valor: unknown): number | null {
  const n = Number(texto(valor));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

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

  const carga = useMutation({
    mutationFn: (filas: FilaCarga[]) => sincronizar({ data: { filas } }),
    onSuccess: (resultado) => {
      setMensaje(
        `Lista actualizada: ${resultado.cargados} coaches en el archivo, ${resultado.eliminados} eliminados.`,
      );
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
    },
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
      for (const cruda of crudas) {
        const fila: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(cruda)) fila[clave(k)] = v;

        const coachId = entero(fila["id coach"]);
        const nombre = texto(fila["coach"]);
        if (coachId === null || !nombre) continue;
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
      carga.mutate(filas);
    } catch {
      setError("No se pudo leer el archivo. Verifique que sea un archivo xlsx válido.");
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
            Cargue el archivo mensual en formato xlsx. Los coaches que no aparezcan en el
            archivo se eliminan de la lista.
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
