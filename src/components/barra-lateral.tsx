import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlternadorTema } from "@/components/alternador-tema";
import { Button } from "@/components/ui/button";

const ENLACES = [
  { to: "/homepage", etiqueta: "Homepage", soloAdmin: true },
  { to: "/coaches", etiqueta: "Coaches", soloAdmin: true },
  { to: "/performance-dashboard", etiqueta: "Performance Dashboard", soloAdmin: false },
  { to: "/academic-performance", etiqueta: "Academic Performance", soloAdmin: true },
  { to: "/continuous-improvement", etiqueta: "Mejora Continua", soloAdmin: false },
] as const;

export function BarraLateral({ nombre, rol }: { nombre: string; rol: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const esAdmin = rol === "admin";

  async function salir() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <p className="text-sm font-semibold tracking-tight text-foreground">
          Portal de Coaches E4CC
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{nombre}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {ENLACES.filter((e) => esAdmin || !e.soloAdmin).map((enlace) => (
          <Link
            key={enlace.to}
            to={enlace.to}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            activeProps={{
              className: "rounded-md px-3 py-2 text-sm font-medium bg-primary/10 text-primary",
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
  );
}
