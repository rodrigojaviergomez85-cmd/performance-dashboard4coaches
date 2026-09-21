import { createFileRoute, redirect, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { verificarAdmin } from "@/lib/auth.functions";
import { AlternadorTema } from "@/components/alternador-tema";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_admin")({
  ssr: false,
  beforeLoad: async () => {
    // Se valida en el servidor en cada navegación. El rol nunca viene del navegador.
    const perfil = await verificarAdmin();
    if (!perfil.ok) throw redirect({ to: "/auth" });
    return { perfil };
  },
  component: DisposicionAdmin,
});

const ENLACES = [
  { to: "/homepage", etiqueta: "Homepage" },
  { to: "/performance-dashboard", etiqueta: "Performance Dashboard" },
  { to: "/academic-performance", etiqueta: "Academic Performance" },
] as const;

function DisposicionAdmin() {
  const { perfil } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function salir() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Portal de Coaches E4CC
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{perfil.nombre}</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {ENLACES.map((enlace) => (
            <Link
              key={enlace.to}
              to={enlace.to}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              activeProps={{
                className:
                  "rounded-md px-3 py-2 text-sm font-medium bg-primary/10 text-primary",
              }}
            >
              {enlace.etiqueta}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <AlternadorTema />
          <Button variant="outline" size="sm" onClick={salir}>
            Salir
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
