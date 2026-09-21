import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { solicitarCodigoCoach, vincularCoach } from "@/lib/auth.functions";
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
      { title: "Sign in | Performance Dashboard" },
      {
        name: "description",
        content:
          "Coaches sign in with their Coach Id and email; administrators sign in with username and password.",
      },
      { property: "og:title", content: "Sign in | Performance Dashboard" },
      {
        property: "og:description",
        content: "Internal access to the Performance Dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PantallaAcceso,
});

function PantallaAcceso() {
  const navigate = useNavigate();
  const pedirCodigo = useServerFn(solicitarCodigoCoach);
  const enlazarCoach = useServerFn(vincularCoach);

  const [coachId, setCoachId] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviarCodigo(evento: React.FormEvent) {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    setAviso(null);
    try {
      const resultado = await pedirCodigo({
        data: { coachId: Number(coachId), email: email.trim().toLowerCase() },
      });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setCodigoEnviado(true);
      setAviso("We sent a code to your email. It expires in a few minutes.");
    } catch {
      setError("We could not process the request. Please try again.");
    } finally {
      setCargando(false);
    }
  }

  async function verificarCodigo(evento: React.FormEvent) {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const { error: errorCodigo } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: codigo.trim(),
        type: "email",
      });
      if (errorCodigo) {
        setError("Invalid or expired code.");
        return;
      }
      const enlace = await enlazarCoach({ data: undefined });
      if (!enlace.ok) {
        await supabase.auth.signOut();
        setError("This account does not match an active coach.");
        return;
      }
      await navigate({ to: "/performance-dashboard", replace: true });
    } catch {
      setError("We could not process the request. Please try again.");
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
        setError("Incorrect username or password.");
        return;
      }
      await navigate({ to: "/homepage", replace: true });
    } catch {
      setError("We could not process the request. Please try again.");
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
            <CardTitle className="text-2xl">Performance Dashboard</CardTitle>
            <CardDescription>Choose how you want to sign in.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="coach"
              onValueChange={() => setError(null)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="coach">Coach</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>

              <TabsContent value="coach">
                <form
                  onSubmit={codigoEnviado ? verificarCodigo : enviarCodigo}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="coachId">Coach Id</Label>
                    <Input
                      id="coachId"
                      inputMode="numeric"
                      required
                      disabled={codigoEnviado}
                      value={coachId}
                      onChange={(e) => setCoachId(e.target.value.replace(/\D/g, ""))}
                      placeholder="12345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      disabled={codigoEnviado}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Code</Label>
                    <Input
                      id="codigo"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required={codigoEnviado}
                      disabled={!codigoEnviado}
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={cargando}>
                    {cargando
                      ? "Verifying..."
                      : codigoEnviado
                        ? "Sign in"
                        : "Send code"}
                  </Button>
                  {codigoEnviado ? (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="w-full"
                      disabled={cargando}
                      onClick={() => {
                        setCodigoEnviado(false);
                        setCodigo("");
                        setAviso(null);
                      }}
                    >
                      Use a different Coach Id or email
                    </Button>
                  ) : null}
                  {aviso ? (
                    <p className="text-xs text-muted-foreground">{aviso}</p>
                  ) : null}
                </form>
              </TabsContent>

              <TabsContent value="admin">
                <form onSubmit={enviarAdmin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="usuario">Username</Label>
                    <Input
                      id="usuario"
                      autoComplete="username"
                      required
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contrasena">Password</Label>
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
                    {cargando ? "Verifying..." : "Sign in"}
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
