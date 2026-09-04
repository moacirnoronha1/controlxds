import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Amostragem, AmostragemItem } from "./amostragem";

const num = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : String(Number(v));

export function gerarAmostragemPDF(rel: Amostragem, itens: AmostragemItem[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("RELATÓRIO DE AMOSTRAGEM ALEATÓRIA", W / 2, 16, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Data: ${new Date(rel.data + "T00:00:00").toLocaleDateString("pt-BR")}`, 14, 24);
  doc.text(`Responsável: ${rel.responsavel || "—"}`, 90, 24);
  doc.text(`Local: ${rel.locais_estoque?.nome || "Todos"}`, 190, 24);
  doc.text("Documento de conferência — não altera estoque.", 14, 30);

  autoTable(doc, {
    startY: 36,
    head: [[
      "#", "Produto", "Categoria", "Local", "Estoque sistema",
      "Contagem física", "Diferença", "Observação",
    ]],
    body: itens.map((it, i) => [
      String(i + 1),
      it.produtos?.nome ?? "—",
      it.categoria || "—",
      it.local_nome || "Todos",
      `${num(it.estoque_sistema)} ${it.produtos?.unidade_medida ?? ""}`.trim(),
      num(it.contagem_fisica),
      num(it.diferenca),
      it.observacao || "",
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 40] },
    columnStyles: { 0: { cellWidth: 8 }, 7: { cellWidth: 55 } },
  });

  if (rel.observacao) {
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFont("helvetica", "bold");
    doc.text("Observação geral:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(rel.observacao, W - 28), 14, y + 5);
  }

  doc.save(`amostragem-${rel.data}.pdf`);
}
