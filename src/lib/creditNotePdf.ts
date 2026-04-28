// PDF Facture d'Avoir — mention légale "AVOIR".
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CreditNote, CompanyInfo } from "./storage";
import { montantEnLettresMAD } from "./numberToWords";
import { installPdfSafeText, sanitizeRows } from "./pdfSafe";

const fmt = (n: number): string => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const [intPart, decPart] = abs.toFixed(2).split(".");
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${withSpaces},${decPart}`;
};

const formatDate = (iso?: string) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
};

function detectImageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

export function generateCreditNotePdf(cn: CreditNote, company: CompanyInfo) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  installPdfSafeText(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const BLACK: [number, number, number] = [0, 0, 0];
  const RED: [number, number, number] = [180, 30, 30];
  const GREY: [number, number, number] = [90, 90, 90];

  const headerY = margin;
  const logoSize = 22;

  if (company.logoDataUrl && company.logoDataUrl.startsWith("data:image/")) {
    try {
      doc.addImage(
        company.logoDataUrl,
        detectImageFormat(company.logoDataUrl),
        margin,
        headerY,
        logoSize,
        logoSize,
      );
    } catch {
      /* ignore */
    }
  }

  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...BLACK);
  doc.text((company.name || "ENTREPRISE").toUpperCase(), pageW / 2, headerY + 12, {
    align: "center",
  });

  // Titre AVOIR (rouge pour distinction)
  const titleY = headerY + 38;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...RED);
  doc.text("FACTURE D'AVOIR", margin, titleY);
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.6);
  doc.line(margin, titleY + 1.8, margin + 78, titleY + 1.8);
  doc.setTextColor(...BLACK);
  doc.setDrawColor(...BLACK);

  const infoY = titleY + 6;
  const infoW = 95;
  const colW = infoW / 3;
  doc.setLineWidth(0.3);
  doc.rect(margin, infoY, infoW, 8);
  doc.rect(margin, infoY + 8, infoW, 8);
  doc.line(margin + colW, infoY, margin + colW, infoY + 16);
  doc.line(margin + colW * 2, infoY, margin + colW * 2, infoY + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("NUMERO", margin + colW / 2, infoY + 5.5, { align: "center" });
  doc.text("DATE", margin + colW + colW / 2, infoY + 5.5, { align: "center" });
  doc.text("FAC. LIÉE", margin + colW * 2 + colW / 2, infoY + 5.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.text(cn.number, margin + colW / 2, infoY + 13.5, { align: "center" });
  doc.text(formatDate(cn.date), margin + colW + colW / 2, infoY + 13.5, { align: "center" });
  doc.text(cn.invoiceNumber || "—", margin + colW * 2 + colW / 2, infoY + 13.5, { align: "center" });

  // Bloc client (hauteur dynamique)
  const clientX = margin + infoW + 8;
  const clientW = pageW - margin - clientX;
  const ci = cn.clientInfo;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const addrLines: string[] = ci?.address
    ? (doc.splitTextToSize(ci.address, clientW - 6) as string[])
    : [];
  const contactParts: string[] = [];
  if (ci?.phone) contactParts.push(`Tél: ${ci.phone}`);
  if (ci?.email) contactParts.push(ci.email);
  const contactLine = contactParts.join("  •  ");
  const contactLines: string[] = contactLine
    ? (doc.splitTextToSize(contactLine, clientW - 6) as string[])
    : [];
  const lineH = 4.2;
  const nameH = 7;
  const iceH = ci?.ice ? 6 : 0;
  const addrBlockH = addrLines.length * lineH;
  const contactBlockH = contactLines.length * lineH;
  const clientH = Math.max(28, nameH + addrBlockH + contactBlockH + iceH + 6);

  doc.rect(clientX, infoY, clientW, clientH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text((ci?.name || cn.client || "CLIENT").toUpperCase(), clientX + clientW / 2, infoY + 6, {
    align: "center",
  });
  let cursorY = infoY + nameH + 4;
  if (addrLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(addrLines, clientX + clientW / 2, cursorY, {
      align: "center",
      lineHeightFactor: 1.35,
    });
    cursorY += addrBlockH;
  }
  if (contactLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(contactLines, clientX + clientW / 2, cursorY, {
      align: "center",
      lineHeightFactor: 1.35,
    });
  }
  if (ci?.ice) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`ICE: ${ci.ice}`, clientX + clientW - 3, infoY + clientH - 3, { align: "right" });
  }

  const tableY = infoY + Math.max(16, clientH) + 4;
  const tvaRate = cn.tvaRate;
  const rows = sanitizeRows(
    cn.items.map((it) => [
      it.reference || "",
      it.name,
      fmt(it.quantity),
      fmt(it.price),
      String(tvaRate),
      fmt(it.price * it.quantity),
    ]),
  );

  autoTable(doc, {
    startY: tableY,
    head: [["Référence", "Désignation", "Qté", "P.U.HT", "TVA", "MT"]],
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: BLACK,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: BLACK,
      fontStyle: "bold",
      halign: "center",
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 16, halign: "right" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 30, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error lastAutoTable est ajouté par autotable
  const afterTable: number = doc.lastAutoTable.finalY + 4;

  // Bloc montant en lettres + totaux
  const lettresW = 90;
  const lettresH = 26;
  doc.setLineWidth(0.3);
  doc.rect(margin, afterTable, lettresW, lettresH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Avoir d'un montant de :", margin + 2, afterTable + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const lettres = `### ${montantEnLettresMAD(cn.totalTTC)} ###`;
  const lettresLines = doc.splitTextToSize(lettres, lettresW - 4);
  doc.text(lettresLines, margin + 2, afterTable + 11);

  const totalsX = margin + lettresW + 6;
  const totalsW = pageW - margin - totalsX;
  const cellW = totalsW / 3;
  const cellH1 = 10;
  const cellH2 = 12;
  for (let i = 0; i < 3; i++) {
    doc.rect(totalsX + i * cellW, afterTable, cellW, cellH1);
    doc.rect(totalsX + i * cellW, afterTable + cellH1, cellW, cellH2);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Montant\nHT", totalsX + cellW / 2, afterTable + 4.2, { align: "center" });
  doc.text("Montant\nTVA", totalsX + cellW + cellW / 2, afterTable + 4.2, { align: "center" });
  doc.text("Montant\nTTC", totalsX + cellW * 2 + cellW / 2, afterTable + 4.2, { align: "center" });

  const drawAmount = (value: string, cx: number) => {
    const maxW = cellW - 4;
    let size = 10.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    while (doc.getTextWidth(value) > maxW && size > 6) {
      size -= 0.5;
      doc.setFontSize(size);
    }
    doc.text(value, cx + cellW - 2, afterTable + cellH1 + 7.8, { align: "right" });
  };
  drawAmount(`-${fmt(cn.totalHT)}`, totalsX);
  drawAmount(`-${fmt(cn.tvaAmount)}`, totalsX + cellW);
  drawAmount(`-${fmt(cn.totalTTC)}`, totalsX + cellW * 2);

  // Mention légale
  const mentionY = afterTable + Math.max(lettresH, cellH1 + cellH2) + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...RED);
  doc.text("AVOIR — À DÉDUIRE DU SOLDE CLIENT", margin, mentionY);
  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  if (cn.invoiceNumber) {
    doc.text(`Annulation / régularisation de la facture ${cn.invoiceNumber}.`, margin, mentionY + 5);
  }
  if (cn.reason) {
    doc.text(`Motif : ${cn.reason}`, margin, mentionY + 10);
  }

  // Pied de page
  const footY = pageH - 18;
  doc.setDrawColor(...GREY);
  doc.setLineWidth(0.2);
  doc.line(margin, footY - 4, pageW - margin, footY - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...BLACK);

  let footerLine1 = company.legalFooter || "";
  if (!footerLine1) {
    const parts: string[] = [];
    if (company.address) parts.push(company.address);
    if (company.phone) parts.push(`GSM ${company.phone}`);
    if (company.cnss) parts.push(`C.N.S.S : ${company.cnss}`);
    if (company.rc) parts.push(`R.C : ${company.rc}`);
    footerLine1 = parts.join(" – ");
  }
  const footerLine2Parts: string[] = [];
  if (company.patente) footerLine2Parts.push(`PATENTE : ${company.patente}`);
  if (company.lf) footerLine2Parts.push(`LF : ${company.lf}`);
  if (company.ice) footerLine2Parts.push(`I.C.E : ${company.ice}`);
  const footerLine2 = footerLine2Parts.join(" – ");
  if (footerLine1) doc.text(footerLine1, pageW / 2, footY, { align: "center", maxWidth: pageW - margin * 2 });
  if (footerLine2) doc.text(footerLine2, pageW / 2, footY + 4.5, { align: "center", maxWidth: pageW - margin * 2 });

  doc.save(`${cn.number}.pdf`);
}
