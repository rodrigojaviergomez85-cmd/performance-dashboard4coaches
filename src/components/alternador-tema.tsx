import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AlternadorTema() {
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    const guardado = localStorage.getItem("tema");
    const activo =
      guardado === "oscuro" ||
      (guardado === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setOscuro(activo);
    document.documentElement.classList.toggle("dark", activo);
  }, []);

  function alternar() {
    const nuevo = !oscuro;
    setOscuro(nuevo);
    document.documentElement.classList.toggle("dark", nuevo);
    localStorage.setItem("tema", nuevo ? "oscuro" : "claro");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={alternar}
      aria-label={oscuro ? "Activar modo claro" : "Activar modo oscuro"}
    >
      {oscuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
