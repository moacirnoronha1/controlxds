import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { CATEGORIAS, type Produto, type LocalEstoque } from "./estoque";
import type { MinimoInfo } from "./estoque-minimo";

export type LinhaEstoque = {
  produto: Produto;
  local: string;
  minimo: number;
  sugestao: number;
  baixo: boolean;
  observacao: string;
};

export function montarLinhas(
  produtos: Produto[],
  locais: LocalEstoque[],
  minimos: Map<string, MinimoInfo>,
): LinhaEstoque[] {
  const localById = new Map(locais.map((l) => [l.id, l.nome]));
  return produtos
    .filter((p) => p.ativo)
    .map((p) => {
      const info = minimos.get(p.id);
      const minimo = info?.minimoEfetivo ?? Number(p.estoque_minimo) || 0;
      const atual = Number(p.estoque_atual) || 0;
      const sugestao = Math.max(0, Math.ceil(minimo - atual));
      const baixo = atual <= minimo;
      return {
        produto: p,
        local: (p.local_padrao_id && localById.get(p.local_padrao_id)) || "—",
        minimo,
        sugestao,
        baixo,
        observacao: baixo ? (atual <= 0 ? "SEM ESTOQUE" : "ESTOQUE BAIXO") : "",
      };
    });
}

function construir(linhas: LinhaEstoque[], emitidoPor: string, categoria: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("GX CONTROL", W / 2, 14, { align: "center" });
  doc.setFontSize(11);
  doc.text("RELATÓRIO DE ESTOQUE ATUAL", W / 2, 21, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Data de emissão: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    14,
    28,
  );
  doc.text(`Emitido por: ${emitidoPor || "—"}`, W - 14, 28, { align: "right" });
  doc.text(`Categoria: ${categoria}`, 14, 33);

  let y = 40;
  const cats = CATEGORIAS.filter((c) =>
    linhas.some((l) => (l.produto.categoria || "OUTROS").toUpperCase() === c),
  );
  const outras = Array.from(
    new Set(
      linhas
        .map((l) => (l.produto.categoria || "OUTROS").toUpperCase())
        .filter((c) => !CATEGORIAS.includes(c as (typeof CATEGORIAS)[number])),
    ),
  );

  for (const cat of [...cats, ...outras]) {
    const itens = linhas
      .filter((l) => (l.produto.categoria || "OUTROS").toUpperCase() === cat)
      .sort((a, b) => a.produto.nome.localeCompare(b.produto.nome));
    if (!itens.length) continue;

    if (y > H - 40) {
      doc.addPage();
      y = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(cat, 14, y);

    autoTable(doc, {
      startY: y + 2,
      head: [[
        "Produto",
        "Un.",
        "Local",
        "Estoque atual",
        "Estoque mínimo",
        "Sugestão compra",
        "Observação",
      ]],
      body: itens.map((l) => [
        l.produto.nome,
        l.produto.unidade_medida,
        l.local,
        String(Number(l.produto.estoque_atual)),
        String(l.minimo),
        l.sugestao > 0 ? String(l.sugestao) : "—",
        l.observacao,
      ]),
      styles: { fontSize: 8.5, cellPadding: 2, lineColor: [210, 210, 210], lineWidth: 0.1 },
      headStyles: { fillColor: [45, 45, 45], textColor: 255, fontSize: 8.5 },
      columnStyles: {
        1: { cellWidth: 12, halign: "center" },
        3: { cellWidth: 22, halign: "right" },
        4: { cellWidth: 24, halign: "right" },
        5: { cellWidth: 24, halign: "right" },
        6: { cellWidth: 28 },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === "body" && itens[data.row.index]?.baixo) {
          data.cell.styles.textColor = [176, 0, 0];
          if (data.column.index === 6 || data.column.index === 0)
            data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  if (!linhas.length) {
    doc.setFont("helvetica", "normal");
    doc.text("Nenhum produto ativo encontrado.", 14, y);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Grupo Xica", W / 2, H - 8, { align: "center" });
    doc.text(`Página ${i} de ${pages}`, W - 14, H - 8, { align: "right" });
    doc.setTextColor(0);
  }

  return doc;
}

export function baixarEstoquePDF(linhas: LinhaEstoque[], emitidoPor: string, categoria: string) {
  const doc = construir(linhas, emitidoPor, categoria);
  doc.save(`estoque-atual-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function imprimirEstoquePDF(linhas: LinhaEstoque[], emitidoPor: string, categoria: string) {
  const doc = construir(linhas, emitidoPor, categoria);
  doc.autoPrint();
  const url = doc.output("bloburl");
  window.open(url as unknown as string, "_blank");
}
