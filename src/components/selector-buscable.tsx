import { useState } from "react";
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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Opcion {
  valor: string;
  etiqueta: string;
}

interface Props {
  opciones: Opcion[];
  valor: string | null;
  alElegir: (valor: string) => void;
  marcador?: string;
  className?: string;
}

/** Selector con buscador, para listas largas como la de coaches. */
export function SelectorBuscable({ opciones, valor, alElegir, marcador, className }: Props) {
  const [abierto, setAbierto] = useState(false);
  const actual = opciones.find((o) => o.valor === valor);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("w-full justify-between sm:w-64", className)}
        >
          <span className="truncate">{actual?.etiqueta ?? marcador ?? "Seleccionar"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar coach" className="h-9" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {opciones.map((o) => (
                <CommandItem
                  key={o.valor}
                  value={o.etiqueta}
                  onSelect={() => {
                    alElegir(o.valor);
                    setAbierto(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", o.valor === valor ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{o.etiqueta}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
