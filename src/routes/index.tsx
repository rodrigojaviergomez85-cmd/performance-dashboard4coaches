import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Portal de Coaches E4CC" },
      {
        name: "description",
        content:
          "Acceso interno para coaches E4CC: encuestas de satisfacción y categoría de pago.",
      },
      { property: "og:title", content: "Portal de Coaches E4CC" },
      {
        property: "og:description",
        content: "Acceso interno para coaches E4CC.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/homepage" : "/auth" });
  },
  component: () => null,
});
