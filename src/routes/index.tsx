import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Portal de Coaches English4Kids" },
      {
        name: "description",
        content:
          "Acceso interno para coaches de English4Kids: encuestas de satisfacción y categoría de pago.",
      },
      { property: "og:title", content: "Portal de Coaches English4Kids" },
      {
        property: "og:description",
        content: "Acceso interno para coaches de English4Kids.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/inicio" : "/auth" });
  },
  component: () => null,
});
