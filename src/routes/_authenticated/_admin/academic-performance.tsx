import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PestanaAcademica } from "@/components/academico/pestana-academica";
import { CONFIGS } from "@/lib/academico-config";

export const Route = createFileRoute("/_authenticated/_admin/academic-performance")({
  head: () => ({
    meta: [
      { title: "Academic Performance | Portal de Coaches E4CC" },
      {
        name: "description",
        content: "Carga y revisión de QA, DSAT, NL, ausencias y tardanzas de los coaches E4CC.",
      },
      {
        property: "og:title",
        content: "Academic Performance | Portal de Coaches E4CC",
      },
      {
        property: "og:description",
        content: "Carga y revisión de los indicadores académicos de los coaches E4CC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcademicPerformance,
});

const PESTANAS = ["qa", "dsat", "nl", "retention", "abs", "lateness"] as const;
const ETIQUETAS: Record<(typeof PESTANAS)[number], string> = {
  qa: "QA",
  dsat: "DSAT",
  nl: "NL",
  retention: "Retention",
  abs: "Abs",
  lateness: "Lateness",
};

function AcademicPerformance() {
  return (
    <section className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Academic Performance</h1>
        <p className="mt-1 text-muted-foreground">
          Indicadores académicos y carga de los archivos mensuales.
        </p>
      </div>

      <Tabs defaultValue="qa" className="space-y-6">
        <TabsList>
          {PESTANAS.map((p) => (
            <TabsTrigger key={p} value={p}>
              {ETIQUETAS[p]}
            </TabsTrigger>
          ))}
        </TabsList>

        {PESTANAS.map((p) => (
          <TabsContent key={p} value={p}>
            <PestanaAcademica config={CONFIGS[p]} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
