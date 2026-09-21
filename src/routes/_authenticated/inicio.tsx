import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { obtenerPerfil } from "@/lib/auth.functions";
import { AlternadorTema } from "@/components/alternador-tema";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Inicio | Portal de Coaches E4CC" },
      {
        name: "description",
        content: "Panel interno de coaches E4CC.",
      },
      { property: "og:title", content: "Inicio | Portal de Coaches E4CC" },
      {
        property: "og:description",
        content: "Panel interno de coaches E4CC.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cargarPerfil = useServerFn(obtenerPerfil);

  const { data, isPending } = useQuery({
    queryKey: ["perfil"],
    queryFn: () => cargarPerfil(),
  });

  async function salir() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Portal de Coaches E4CC
        </span>
        <div className="flex items-center gap-2">
          <AlternadorTema />
          <Button variant="outline" size="sm" onClick={salir}>
            Salir
          </Button>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {isPending ? "Cargando..." : `Hola, ${data?.nombre ?? ""}`}
          </h1>
          {data ? (
            <p className="mt-2 text-sm text-muted-foreground">Perfil: {data.rol}</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
