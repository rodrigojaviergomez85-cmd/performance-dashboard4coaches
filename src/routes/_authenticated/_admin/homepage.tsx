import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_admin/inicio")({
  head: () => ({
    meta: [
      { title: "Inicio | Portal de Coaches E4CC" },
      { name: "description", content: "Panel interno de coaches E4CC." },
      { property: "og:title", content: "Inicio | Portal de Coaches E4CC" },
      { property: "og:description", content: "Panel interno de coaches E4CC." },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { perfil } = Route.useRouteContext();

  return (
    <section className="px-8 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Hola, {perfil.nombre}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Perfil: {perfil.rol}</p>
    </section>
  );
}
