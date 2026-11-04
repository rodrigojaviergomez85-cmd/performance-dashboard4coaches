import { describe, expect, it } from "vitest";
import { fechaDiaMes, normalizarFilaQaData } from "@/lib/hoja-calculo";

describe("QA DATA (formato nuevo)", () => {
  it("usa Fecha Ingresado dd/mm/aaaa con hora y Ver Quality como clave", () => {
    const f = normalizarFilaQaData({
      "id coach": 1185, "nota final": 8, "ver quality": "128875",
      "qa | fecha ingresado": "05/10/2026 09:32", "qa | fecha monitoreo": "03/10/2026 09:32",
      "qa | level": "B4N", "qa | type qa": "REGULAR QA",
    });
    expect(fechaDiaMes(f["fecha ingresado"])).toBe("2026-10-05");
    expect(fechaDiaMes(f["fecha monitoreo"])).toBe("2026-10-03");
    expect(f["clave"]).toBe("128875");
    expect(f["level"]).toBe("B4N");
    expect(f["nota final"]).toBe(8);
  });
});
