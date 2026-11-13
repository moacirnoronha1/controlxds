import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Inventario } from "@/lib/inventario";
import { SEM_CUSTO, type LinhaFinanceira, type ResumoFinanceiro } from "@/lib/custos-inventario";

const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

export function baixarInventarioPdf(inv: Inventario, linhas: LinhaFinanceira[], r: ResumoFinanceiro, status: string, tipo: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("GX CONTROL", W / 2, 14, { align: "center" });
  doc.setFontSize(11);
  doc.text(`RELATÓRIO DE INVENTÁRIO — ${(inv.titulo || "").toUpperCase()}`, W / 2, 21, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const ref = new Date(inv.referencia).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
  doc.text(`Tipo: ${tipo} · Status: ${status} · Referência: ${ref}`, 14, 28);
  doc.text(inv.fechado_em ? `Fechado em: ${new Date(inv.fechado_em).toLocaleString("pt-BR")}` : `Emitido em: ${new Date().toLocaleString("pt-BR")}`, W - 14, 28, { align: "right" });
  const divs = linhas.filter((l) => l.diferenca != null && l.diferenca !== 0).length;
  doc.setFont("helvetica", "bold");
  doc.text(`Itens: ${linhas.length}   Divergências: ${divs}   Sobras: ${moeda(r.sobra)}   Faltas: -${moeda(r.falta)}   Saldo líquido: ${moeda(r.liquido)}${r.semCusto ? `   Sem custo: ${r.semCusto}` : ""}`, 14, 35);

  autoTable(doc, {
    startY: 40,
    head: [["Produto", "Categoria", "Sistema", "Contagem", "Diferença", "Custo médio", "Valor da dif.", "Observação"]],
    body: linhas.map((l) => [
      l.item.produtos?.nome ?? "—",
      l.item.produtos?.categoria ?? "—",
      num(Number(l.item.estoque_sistema)),
      l.item.contagem_fisica == null ? "—" : num(Number(l.item.contagem_fisica)),
      l.diferenca == null ? "—" : num(l.diferenca),
      l.custo == null ? SEM_CUSTO : moeda(l.custo),
      l.diferenca == null || l.diferenca === 0 ? "—" : l.valor == null ? SEM_CUSTO : moeda(l.valor),
      l.item.observacao ?? "",
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [45, 45, 45], textColor: 255 },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
    margin: { left: 14, right: 14 },
    didParseCell: (d) => {
      if (d.section !== "body" || d.column.index !== 6) return;
      const v = linhas[d.row.index]?.valor;
      if (v != null && v < 0) d.cell.styles.textColor = [176, 0, 0];
      if (v != null && v > 0) d.cell.styles.textColor = [0, 120, 60];
    },
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120);
    doc.text("Grupo Xica · Sistema GX Control", W / 2, H - 8, { align: "center" });
    doc.text(`Página ${i} de ${pages}`, W - 14, H - 8, { align: "right" });
    doc.setTextColor(0);
  }
  doc.save(`inventario-${inv.referencia}.pdf`);
}
