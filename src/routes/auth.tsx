import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { accesoCoach } from "@/lib/auth.functions";
import { AlternadorTema } from "@/components/alternador-tema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DOMINIO_INTERNO = "e4cc.local";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ingresar | Portal de Coaches E4CC" },
      {
        name: "description",
        content:
          "Acceso de coaches con su número de coach y correo, y acceso administrativo con usuario y contraseña.",
      },
      { property: "og:title", content: "Ingresar | Portal de Coaches E4CC" },
      {
        property: "og:description",
        content: "Acceso interno al Portal de Coaches E4CC.",
      },
    ],
  }),
  component: PantallaAcceso,
});

function PantallaAcceso() {
  const navigate = useNavigate();
  const entrarComoCoach = useServerFn(accesoCoach);

  const [coachId, setCoachId] = useState("");
  const [email, setEmail] = useState("");
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviarCoach(evento: React.FormEvent) {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const resultado = await entrarComoCoach({
        data: { coachId: Number(coachId), email: email.trim().toLowerCase() },
      });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      const { error: errorSesion } = await supabase.auth.setSession({
        access_token: resultado.access_token,
        refresh_token: resultado.refresh_token,
      });
      if (errorSesion) {
        setError("No fue posible iniciar la sesión. Intente de nuevo.");
        return;
      }
      await navigate({ to: "/inicio", replace: true });
    } catch {
      setError("No fue posible procesar la solicitud. Intente de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function enviarAdmin(evento: React.FormEvent) {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const nombre = usuario.trim().toLowerCase();
      const correo = nombre.includes("@") ? nombre : `${nombre}@${DOMINIO_INTERNO}`;
      const { error: errorSesion } = await supabase.auth.signInWithPassword({
        email: correo,
        password: contrasena,
      });
      if (errorSesion) {
        setError("Usuario o contraseña incorrectos.");
        return;
      }
      await navigate({ to: "/inicio", replace: true });
    } catch {
      setError("No fue posible procesar la solicitud. Intente de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold tracking-tight text-foreground">E4CC</span>
        <AlternadorTema />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Portal de Coaches E4CC</CardTitle>
            <CardDescription>
              Elija el tipo de acceso que le corresponde.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="coach"
              onValueChange={() => setError(null)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="coach">Coach</TabsTrigger>
                <TabsTrigger value="admin">Administración</TabsTrigger>
              </TabsList>

              <TabsContent value="coach">
                <form onSubmit={enviarCoach} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="coachId">Número de coach</Label>
                    <Input
                      id="coachId"
                      inputMode="numeric"
                      required
                      value={coachId}
                      onChange={(e) => setCoachId(e.target.value.replace(/\D/g, ""))}
                      placeholder="12345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nombre@correo.com"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={cargando}>
                    {cargando ? "Verificando..." : "Ingresar"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Sus datos se verifican contra la lista de coaches activos.
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="admin">
                <form onSubmit={enviarAdmin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="usuario">Usuario</Label>
                    <Input
                      id="usuario"
                      autoComplete="username"
                      required
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      placeholder="admin.e4cc"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contrasena">Contraseña</Label>
                    <Input
                      id="contrasena"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={contrasena}
                      onChange={(e) => setContrasena(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={cargando}>
                    {cargando ? "Verificando..." : "Ingresar"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {error ? (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
