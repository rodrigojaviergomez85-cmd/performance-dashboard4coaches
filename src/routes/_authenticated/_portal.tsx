import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { verificarAcceso } from "@/lib/auth.functions";
import { BarraLateral } from "@/components/barra-lateral";

export const Route = createFileRoute("/_authenticated/_portal")({
  ssr: false,
  beforeLoad: async () => {
    // Cualquier coach activo; el rol se resuelve siempre en el servidor.
    const perfil = await verificarAcceso();
    if (!perfil.ok) throw redirect({ to: "/auth" });
    return { perfil };
  },
  component: DisposicionPortal,
});

function DisposicionPortal() {
  const { perfil } = Route.useRouteContext();

  return (
    <div className="flex min-h-screen bg-background">
      <BarraLateral nombre={perfil.nombre} rol={perfil.rol} />
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
