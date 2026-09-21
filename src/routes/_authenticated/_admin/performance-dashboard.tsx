import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_admin/performance-dashboard")({
  head: () => ({
    meta: [
      { title: "Performance Dashboard | Portal de Coaches E4CC" },
      {
        name: "description",
        content: "Panel de desempeño de coaches E4CC.",
      },
      { property: "og:title", content: "Performance Dashboard | Portal de Coaches E4CC" },
      { property: "og:description", content: "Panel de desempeño de coaches E4CC." },
    ],
  }),
  component: PerformanceDashboard,
});

function PerformanceDashboard() {
  return (
    <section className="px-8 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Performance Dashboard
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Contenido pendiente de definir.
      </p>
    </section>
  );
}
