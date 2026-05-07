import { describe, expect, it } from "bun:test";
import { extractJsonBlock } from "./utils";

describe("extractJsonBlock", () => {
  it("extrae JSON válido de texto plano", () => {
    const text = `Aquí va mi análisis:\n{"sugerencia_narrativa":"ok","ajuste_recomendado_pct":5,"alertas":[]}`;
    const result = extractJsonBlock(text);
    expect(result.sugerencia_narrativa).toBe("ok");
    expect(result.ajuste_recomendado_pct).toBe(5);
  });

  it("retorna objeto vacío cuando no hay JSON", () => {
    expect(extractJsonBlock("sin json aquí")).toEqual({});
  });

  it("retorna objeto vacío para texto vacío", () => {
    expect(extractJsonBlock("")).toEqual({});
  });

  it("extrae el JSON aunque haya texto antes y después", () => {
    const text = `texto previo {"key": "value"} texto posterior`;
    const result = extractJsonBlock(text);
    expect(result.key).toBe("value");
  });

  it("retorna objeto vacío cuando el JSON es inválido", () => {
    const text = `{clave sin comillas: valor}`;
    expect(extractJsonBlock(text)).toEqual({});
  });

  it("extrae JSON con arrays", () => {
    const text = `{"alertas":["alerta1","alerta2"],"ajuste_recomendado_pct":null}`;
    const result = extractJsonBlock(text);
    expect(Array.isArray(result.alertas)).toBe(true);
    expect(result.ajuste_recomendado_pct).toBeNull();
  });
});
