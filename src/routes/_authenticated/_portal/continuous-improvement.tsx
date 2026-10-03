import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const BUCKET = "mejora-continua";

export const Route = createFileRoute("/_authenticated/_portal/continuous-improvement")({
  head: () => ({
    meta: [
      { title: "Mejora Continua — Portal de Coaches E4CC" },
      { name: "description", content: "Materiales mensuales de mejora continua: lecturas, imágenes y videos." },
      { property: "og:title", content: "Mejora Continua — Portal de Coaches E4CC" },
      { property: "og:description", content: "Materiales mensuales de mejora continua para coaches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MejoraContinua,
});

type Material = {
  id: string;
  titulo: string;
  descripcion: string | null;
  mes: string;
  tipo: string;
  ruta: string;
  nombre_archivo: string;
  mime: string | null;
  tamano: number | null;
};

function tipoDe(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "imagen";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "documento";
}

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatoMes(mes: string) {
  const [a, m] = mes.split("-");
  return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" });
}

function MejoraContinua() {
  const { perfil } = Route.useRouteContext();
  const esAdmin = perfil.rol === "admin";
  const [mes, setMes] = useState(mesActual());
  const [tipo, setTipo] = useState("todos");

  const consulta = useQuery({
    queryKey: ["mejora", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiales_mejora")
        .select("*")
        .eq("mes", `${mes}-01`)
        .order("creado", { ascending: false });
      if (error) throw error;
      return data as Material[];
    },
  });

  const lista = useMemo(
    () => (consulta.data ?? []).filter((m) => tipo === "todos" || m.tipo === tipo),
    [consulta.data, tipo],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mejora Continua</h1>
          <p className="text-sm text-muted-foreground">Materiales del mes: lecturas, imágenes y videos.</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="mes">Mes</Label>
            <Input id="mes" type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
          </div>
          {esAdmin && <DialogoSubir mesInicial={mes} />}
        </div>
      </div>

      <Tabs value={tipo} onValueChange={setTipo}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="pdf">PDFs</TabsTrigger>
          <TabsTrigger value="imagen">Imágenes</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="documento">Otros</TabsTrigger>
        </TabsList>
      </Tabs>

      {consulta.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No hay materiales para {formatoMes(mes)}.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((m) => (
            <TarjetaMaterial key={m.id} material={m} esAdmin={esAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaMaterial({ material, esAdmin }: { material: Material; esAdmin: boolean }) {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);

  const url = useQuery({
    queryKey: ["mejora-url", material.ruta],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(material.ruta, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 50 * 60 * 1000,
  });

  const borrar = useMutation({
    mutationFn: async () => {
      await supabase.storage.from(BUCKET).remove([material.ruta]);
      const { error } = await supabase.from("materiales_mejora").delete().eq("id", material.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material eliminado");
      qc.invalidateQueries({ queryKey: ["mejora"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex aspect-video items-center justify-center bg-muted">
        {url.data && material.tipo === "imagen" ? (
          <img src={url.data} alt={material.titulo} className="h-full w-full object-cover" />
        ) : url.data && material.tipo === "video" ? (
          <video src={url.data} controls className="h-full w-full" />
        ) : (
          <span className="text-sm font-medium uppercase text-muted-foreground">{material.tipo}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-medium text-foreground">{material.titulo}</p>
        {material.descripcion && <p className="text-sm text-muted-foreground">{material.descripcion}</p>}
        <p className="text-xs text-muted-foreground">{material.nombre_archivo}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          {material.tipo === "pdf" && url.data && (
            <Dialog open={abierto} onOpenChange={setAbierto}>
              <DialogTrigger asChild>
                <Button size="sm">Leer</Button>
              </DialogTrigger>
              <DialogContent className="h-[90vh] max-w-5xl">
                <DialogHeader>
                  <DialogTitle>{material.titulo}</DialogTitle>
                </DialogHeader>
                <iframe src={url.data} title={material.titulo} className="h-full w-full rounded border border-border" />
              </DialogContent>
            </Dialog>
          )}
          {url.data && (
            <Button size="sm" variant="outline" asChild>
              <a href={url.data} target="_blank" rel="noreferrer">Abrir</a>
            </Button>
          )}
          {esAdmin && (
            <Button
              size="sm"
              variant="ghost"
              disabled={borrar.isPending}
              onClick={() => confirm("¿Eliminar este material?") && borrar.mutate()}
            >
              Eliminar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DialogoSubir({ mesInicial }: { mesInicial: string }) {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [mes, setMes] = useState(mesInicial);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);

  const subir = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      for (const archivo of archivos) {
        const limpio = archivo.name.replace(/[^\w.\-]+/g, "_");
        const ruta = `${mes}/${crypto.randomUUID()}-${limpio}`;
        const { error: e1 } = await supabase.storage
          .from(BUCKET)
          .upload(ruta, archivo, { contentType: archivo.type || undefined });
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("materiales_mejora").insert({
          titulo: (archivos.length > 1 ? archivo.name : titulo) || archivo.name,
          descripcion: descripcion || null,
          mes: `${mes}-01`,
          tipo: tipoDe(archivo.type),
          ruta,
          nombre_archivo: archivo.name,
          mime: archivo.type || null,
          tamano: archivo.size,
          subido_por: u.user?.id ?? null,
        });
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("Archivos subidos");
      qc.invalidateQueries({ queryKey: ["mejora"] });
      setAbierto(false);
      setTitulo("");
      setDescripcion("");
      setArchivos([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>Subir archivos</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir material</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="sub-mes">Mes</Label>
            <Input id="sub-mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub-titulo">Título</Label>
            <Input
              id="sub-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Si sube varios archivos se usa el nombre de cada uno"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub-desc">Descripción</Label>
            <Textarea id="sub-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub-archivo">Archivos (PDF, imágenes, videos, documentos; máx. 1 GB)</Label>
            <Input
              id="sub-archivo"
              type="file"
              multiple
              onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
            />
          </div>
          <Button
            className="w-full"
            disabled={!mes || archivos.length === 0 || subir.isPending}
            onClick={() => subir.mutate()}
          >
            {subir.isPending ? "Subiendo…" : "Subir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
