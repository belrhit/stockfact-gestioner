// PDF Bon de Livraison — quantités sans prix obligatoires.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DeliveryNote, CompanyInfo } from "./storage";
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

export function generateDeliveryNotePdf(bl: DeliveryNote, company: CompanyInfo) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  installPdfSafeText(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const BLACK: [number, number, number] = [0, 0, 0];
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

  // Titre
  const titleY = headerY + 38;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("BON DE LIVRAISON", margin, titleY);
  doc.setLineWidth(0.5);
  doc.line(margin, titleY + 1.5, margin + 70, titleY + 1.5);

  // Infos numéro/date
  const infoY = titleY + 6;
  const infoW = 95;
  const colW = infoW / 2;
  doc.setLineWidth(0.3);
  doc.rect(margin, infoY, infoW, 8);
  doc.rect(margin, infoY + 8, infoW, 8);
  doc.line(margin + colW, infoY, margin + colW, infoY + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("NUMERO", margin + colW / 2, infoY + 5.5, { align: "center" });
  doc.text("DATE", margin + colW + colW / 2, infoY + 5.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(bl.number, margin + colW / 2, infoY + 13.5, { align: "center" });
  doc.text(formatDate(bl.date), margin + colW + colW / 2, infoY + 13.5, { align: "center" });

  // Bloc client
  const clientX = margin + infoW + 8;
  const clientW = pageW - margin - clientX;
  const ci = bl.clientInfo;

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
  doc.text((ci?.name || bl.client || "CLIENT").toUpperCase(), clientX + clientW / 2, infoY + 6, {
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
  const rows = sanitizeRows(bl.items.map((it) => [it.reference || "", it.name, fmt(it.quantity)]));

  autoTable(doc, {
    startY: tableY,
    head: [["Référence", "Désignation", "Qté livrée"]],
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 2.5,
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
      0: { cellWidth: 35, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 30, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error lastAutoTable est ajouté par autotable
  const afterTable: number = doc.lastAutoTable.finalY + 8;

  if (bl.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Notes : ${bl.notes}`, margin, afterTable);
  }

  // Signatures
  const sigY = Math.min(pageH - 50, afterTable + 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Livreur", margin + 25, sigY, { align: "center" });
  doc.text("Réceptionnaire", pageW - margin - 30, sigY, { align: "center" });
  doc.setLineWidth(0.3);
  doc.rect(margin, sigY + 3, 50, 25);
  doc.rect(pageW - margin - 60, sigY + 3, 60, 25);

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
    footerLine1 = parts.join(" – ");
  }
  if (footerLine1) {
    doc.text(footerLine1, pageW / 2, footY, { align: "center", maxWidth: pageW - margin * 2 });
  }
  if (company.ice) {
    doc.text(`I.C.E : ${company.ice}`, pageW / 2, footY + 4.5, { align: "center" });
  }

  doc.save(`${bl.number}.pdf`);
}
