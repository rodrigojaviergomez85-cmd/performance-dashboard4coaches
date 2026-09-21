import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_admin/academic-performance")({
  head: () => ({
    meta: [
      { title: "Academic Performance | Portal de Coaches E4CC" },
      {
        name: "description",
        content: "Desempeño académico de los coaches E4CC.",
      },
      {
        property: "og:title",
        content: "Academic Performance | Portal de Coaches E4CC",
      },
      {
        property: "og:description",
        content: "Desempeño académico de los coaches E4CC.",
      },
    ],
  }),
  component: AcademicPerformance,
});

function AcademicPerformance() {
  return (
    <section className="px-8 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Academic Performance
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Contenido pendiente de definir.
      </p>
    </section>
  );
}
