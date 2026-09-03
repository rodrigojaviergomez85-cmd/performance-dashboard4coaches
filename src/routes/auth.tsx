import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { solicitarCodigo, verificarCodigo } from "@/lib/auth.functions";
import { AlternadorTema } from "@/components/alternador-tema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ingresar | Portal de Coaches English4Kids" },
      {
        name: "description",
        content:
          "Ingrese con su correo institucional y el código de acceso de seis dígitos.",
      },
      { property: "og:title", content: "Ingresar | Portal de Coaches English4Kids" },
      {
        property: "og:description",
        content: "Acceso con código de seis dígitos para coaches de English4Kids.",
      },
    ],
  }),
  component: PantallaAcceso,
});

function PantallaAcceso() {
  const navigate = useNavigate();
  const pedirCodigo = useServerFn(solicitarCodigo);
  const validarCodigo = useServerFn(verificarCodigo);

  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviarCorreo(evento: React.FormEvent) {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const resultado = await pedirCodigo({ data: { email: email.trim().toLowerCase() } });
      setAviso(resultado.mensaje);
      setPaso("codigo");
    } catch {
      setError("No fue posible procesar la solicitud. Intente de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function enviarCodigo(evento: React.FormEvent) {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const resultado = await validarCodigo({
        data: { email: email.trim().toLowerCase(), codigo },
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
      setError("El código no es válido o ya expiró.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          English4Kids
        </span>
        <AlternadorTema />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Portal de Coaches</CardTitle>
            <CardDescription>
              {paso === "correo"
                ? "Escriba su correo institucional para recibir un código de acceso."
                : "Escriba el código de seis dígitos que enviamos a su correo."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paso === "correo" ? (
              <form onSubmit={enviarCorreo} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@english4kids.com"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={cargando}>
                  {cargando ? "Enviando..." : "Enviar código"}
                </Button>
              </form>
            ) : (
              <form onSubmit={enviarCodigo} className="space-y-4">
                {aviso ? (
                  <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {aviso}
                  </p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código de seis dígitos</Label>
                  <Input
                    id="codigo"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                  />
                  <p className="text-xs text-muted-foreground">
                    El código es válido por 10 minutos.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={cargando}>
                  {cargando ? "Verificando..." : "Ingresar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setPaso("correo");
                    setCodigo("");
                    setError(null);
                    setAviso(null);
                  }}
                >
                  Usar otro correo
                </Button>
              </form>
            )}

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
