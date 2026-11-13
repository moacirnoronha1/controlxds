import { describe, it, expect } from "vitest";
import { custoMedioAte, analiseFinanceira } from "./custos-inventario";

const lotes = [
  { produto_id: "a", custo_unitario: 10, quantidade_inicial: 2, created_at: "2026-11-01T10:00:00Z" },
  { produto_id: "a", custo_unitario: 20, quantidade_inicial: 2, created_at: "2026-11-02T10:00:00Z" },
  { produto_id: "a", custo_unitario: 100, quantidade_inicial: 5, created_at: "2026-11-10T10:00:00Z" },
];
const item = (pid: string, sis: number, cont: number | null) =>
  ({ id: pid, produto_id: pid, inventario_id: "i", estoque_sistema: sis, contagem_fisica: cont, diferenca: 0, observacao: null, contado_por: null, contado_em: null });

describe("valor das divergências", () => {
  it("usa custo médio ponderado só até a data do inventário", () => {
    expect(custoMedioAte(lotes, "2026-11-05T00:00:00Z").get("a")).toBe(15);
  });
  it("falta = quantidade × custo médio; sem custo não recebe valor", () => {
    const c = custoMedioAte(lotes, "2026-11-05T00:00:00Z");
    const { linhas, resumo } = analiseFinanceira([item("a", 10, 8), item("b", 1, 3)], c);
    expect(linhas[0].valor).toBe(-30);
    expect(linhas[1].valor).toBeNull();
    expect(resumo).toEqual({ sobra: 0, falta: 30, liquido: -30, semCusto: 1 });
  });
});
