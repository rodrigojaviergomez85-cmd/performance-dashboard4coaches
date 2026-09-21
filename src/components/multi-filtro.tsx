import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  etiqueta: string;
  opciones: string[];
  seleccion: string[];
  alCambiar: (valores: string[]) => void;
}

/** Filtro de varios valores con buscador. */
export function MultiFiltro({ etiqueta, opciones, seleccion, alCambiar }: Props) {
  const resumen = seleccion.length ? seleccion.join(", ") : etiqueta;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 min-w-40 justify-between text-sm">
          <span className="truncate">{resumen}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${etiqueta.toLowerCase()}`} className="h-9" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {opciones.map((opcion) => {
                const activa = seleccion.includes(opcion);
                return (
                  <CommandItem
                    key={opcion}
                    value={opcion}
                    onSelect={() =>
                      alCambiar(
                        activa ? seleccion.filter((v) => v !== opcion) : [...seleccion, opcion],
                      )
                    }
                  >
                    <Check className={cn("mr-2 h-4 w-4", activa ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{opcion}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex justify-between border-t border-border p-2">
          <Button variant="ghost" size="sm" onClick={() => alCambiar([])}>
            Limpiar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
