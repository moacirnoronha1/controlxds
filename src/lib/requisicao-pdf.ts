import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Requisicao, RequisicaoItem } from "./requisicoes";

const STATUS_LABEL: Record<string, string> = {
  pendente: "PENDENTE",
  liberada: "LIBERADA",
  cancelada: "CANCELADA",
};

export function gerarRequisicaoPDF(req: Requisicao, itens: RequisicaoItem[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("REQUISIÇÃO DE MATERIAL", W / 2, 18, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº ${String(req.numero).padStart(5, "0")}`, W - 15, 18, { align: "right" });

  // Box meta
  doc.setDrawColor(180);
  doc.rect(14, 24, W - 28, 28);

  const dataFmt = new Date(req.data).toLocaleDateString("pt-BR");
  const horaFmt = new Date(req.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Data:", 17, 30);
  doc.text("Requisitante:", 17, 37);
  doc.text("Destino/Setor:", 17, 44);
  doc.text("Status:", W / 2 + 5, 30);
  doc.text("Liberação:", W / 2 + 5, 37);
  doc.text("Responsável:", W / 2 + 5, 44);

  doc.setFont("helvetica", "normal");
  doc.text(`${dataFmt} ${horaFmt}`, 40, 30);
  doc.text(req.requisitante || "—", 40, 37);
  doc.text(req.setor || "—", 40, 44);
  doc.text(STATUS_LABEL[req.status] ?? req.status, W / 2 + 28, 30);
  doc.text(
    req.liberada_em ? new Date(req.liberada_em).toLocaleString("pt-BR") : "—",
    W / 2 + 28,
    37,
  );
  doc.text(req.responsavel_liberacao || "—", W / 2 + 28, 44);

  // Items
  autoTable(doc, {
    startY: 58,
    head: [["#", "Código", "Produto", "Unid.", "Qtd."]],
    body: itens.map((it, i) => [
      String(i + 1),
      it.codigo || it.produtos?.codigo_barras || "—",
      it.produtos?.nome ?? "—",
      it.produtos?.unidade_medida ?? "",
      String(it.quantidade),
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 36 },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 20, halign: "right" },
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80;

  if (req.observacao) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Observação:", 14, finalY + 10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(req.observacao, W - 28);
    doc.text(lines, 14, finalY + 15);
  }

  // Signatures
  const sigY = Math.min(finalY + 50, 260);
  doc.setDrawColor(100);
  doc.line(25, sigY, 90, sigY);
  doc.line(W - 90, sigY, W - 25, sigY);
  doc.setFontSize(8);
  doc.text("Requisitante", 57.5, sigY + 5, { align: "center" });
  doc.text("Responsável pela liberação", W - 57.5, sigY + 5, { align: "center" });

  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    `Emitido em ${new Date().toLocaleString("pt-BR")}`,
    W / 2,
    285,
    { align: "center" },
  );

  doc.save(`requisicao-${String(req.numero).padStart(5, "0")}.pdf`);
}
