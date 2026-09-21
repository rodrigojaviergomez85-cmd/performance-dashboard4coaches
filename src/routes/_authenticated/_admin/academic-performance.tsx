import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_admin/desempeno-academico")({
  head: () => ({
    meta: [
      { title: "Desempeño Académico | Portal de Coaches E4CC" },
      {
        name: "description",
        content: "Desempeño académico de los coaches E4CC.",
      },
      {
        property: "og:title",
        content: "Desempeño Académico | Portal de Coaches E4CC",
      },
      {
        property: "og:description",
        content: "Desempeño académico de los coaches E4CC.",
      },
    ],
  }),
  component: DesempenoAcademico,
});

function DesempenoAcademico() {
  return (
    <section className="px-8 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Desempeño Académico
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Contenido pendiente de definir.
      </p>
    </section>
  );
}
