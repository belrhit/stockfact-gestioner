// src/lib/invoicePdf.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Invoice, CompanyInfo } from "./storage";
import { montantEnLettresMAD } from "./numberToWords";
import { installPdfSafeText, sanitizeRows } from "./pdfSafe";

const TVA_RATE_DEFAULT = 20;

// Format marocain : séparateur de milliers = espace ASCII, décimales = virgule.
// On évite toLocaleString qui insère \u202f (espace fine insécable) non rendu par les polices PDF par défaut.
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

// REMPLACE la fonction actuelle par celle-ci :
function detectImageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.includes("image/png")) return "PNG";
  if (dataUrl.includes("image/webp")) return "WEBP";
  return "JPEG";
}

export function generateInvoicePdf(invoice: Invoice, company: CompanyInfo) {
  // AJOUTE CECI :
  if (!invoice || !company) {
    console.error("Données manquantes");
    return;
  }
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  installPdfSafeText(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  const BLACK: [number, number, number] = [0, 0, 0];
  const GREY: [number, number, number] = [90, 90, 90];

  // ============ EN-TÊTE : logo + nom entreprise centré ============
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
      /* image invalide, on ignore */
    }
  }

  // Nom entreprise centré (gros, bold, type "RAKII TRANSPORT")
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...BLACK);
  doc.text((company.name || "ENTREPRISE").toUpperCase(), pageW / 2, headerY + 12, {
    align: "center",
  });

  // Sous-titre éventuel (S.A.R.L détecté dans le nom)
  const upperName = (company.name || "").toUpperCase();
  if (!/S\.?A\.?R\.?L/.test(upperName)) {
    doc.setFontSize(14);
    doc.text("S.A.R.L", pageW / 2 + 40, headerY + 22, { align: "center" });
  }

  // ============ TITRE FACTURE ============
  const titleY = headerY + 38;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...BLACK);
  doc.text("FACTURE", margin, titleY);
  // soulignement
  doc.setLineWidth(0.5);
  doc.line(margin, titleY + 1.5, margin + 38, titleY + 1.5);

  // ============ Bloc gauche : Numéro / Date / Réf ============
  const infoY = titleY + 6;
  const infoW = 95;
  const colW = infoW / 3;
  doc.setLineWidth(0.3);
  doc.setDrawColor(...BLACK);
  // ligne d'en-tête
  doc.rect(margin, infoY, infoW, 8);
  doc.rect(margin, infoY + 8, infoW, 8);
  // séparateurs verticaux
  doc.line(margin + colW, infoY, margin + colW, infoY + 16);
  doc.line(margin + colW * 2, infoY, margin + colW * 2, infoY + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("NUMERO", margin + colW / 2, infoY + 5.5, { align: "center" });
  doc.text("DATE", margin + colW + colW / 2, infoY + 5.5, { align: "center" });
  doc.text("REF/CMDE", margin + colW * 2 + colW / 2, infoY + 5.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.text(invoice.number || invoice.id, margin + colW / 2, infoY + 13.5, { align: "center" });
  doc.text(formatDate(invoice.date), margin + colW + colW / 2, infoY + 13.5, { align: "center" });
  doc.text("", margin + colW * 2 + colW / 2, infoY + 13.5, { align: "center" });

  // ============ Bloc droit : client encadré (hauteur dynamique) ============
  const clientX = margin + infoW + 8;
  const clientW = pageW - margin - clientX;
  const ci = invoice.clientInfo;

  // Pré-calcul des lignes d'adresse pour dimensionner le bloc
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
  const lineH = 4.2; // line-height adresse (mm)
  const nameH = 7;
  const iceH = ci?.ice ? 6 : 0;
  const addrBlockH = addrLines.length * lineH;
  const contactBlockH = contactLines.length * lineH;
  const clientH = Math.max(28, nameH + addrBlockH + contactBlockH + iceH + 6);

  doc.setLineWidth(0.3);
  doc.rect(clientX, infoY, clientW, clientH);

  // Nom client
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    (ci?.name || invoice.client || "CLIENT").toUpperCase(),
    clientX + clientW / 2,
    infoY + 6,
    { align: "center" },
  );

  // Adresse multi-lignes
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

  // Contact (téléphone / email)
  if (contactLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(contactLines, clientX + clientW / 2, cursorY, {
      align: "center",
      lineHeightFactor: 1.35,
    });
  }

  // ICE en bas du bloc
  if (ci?.ice) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`ICE: ${ci.ice}`, clientX + clientW - 3, infoY + clientH - 3, { align: "right" });
  }

  // ============ TABLEAU PRODUITS ============
  const tableY = infoY + Math.max(16, clientH) + 4;
  const tvaRate = invoice.tvaRate ?? TVA_RATE_DEFAULT;

  const rows = sanitizeRows(
    invoice.items.map((it) => [
      it.reference || "",
      it.name,
      fmt(it.quantity),
      fmt(it.price),
      "",
      String(tvaRate),
      fmt(it.price * it.quantity),
    ]),
  );

  autoTable(doc, {
    startY: tableY,
    head: [["Référence", "Désignation", "Qté", "P.U.HT", "R%", "TVA", "MT"]],
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
      fillColor: [255, 255, 255],
      textColor: BLACK,
      fontStyle: "bold",
      halign: "center",
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 16, halign: "right" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 30, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // ============ Montant en lettres + totaux ============
  const totalHT = invoice.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tvaAmount = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + tvaAmount;

  // @ts-expect-error lastAutoTable est ajouté par autotable
  const afterTable: number = doc.lastAutoTable.finalY + 4;

  // Bloc gauche : montant en lettres
  const lettresW = 90;
  const lettresH = 26;
  doc.setLineWidth(0.3);
  doc.rect(margin, afterTable, lettresW, lettresH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Arrêtée la présente facture à la somme de :", margin + 2, afterTable + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const lettres = `### ${montantEnLettresMAD(totalTTC)} ###`;
  const lettresLines = doc.splitTextToSize(lettres, lettresW - 4);
  doc.text(lettresLines, margin + 2, afterTable + 11);

  // Bloc droit : 3 cases Montant HT / TVA / TTC
  const totalsX = margin + lettresW + 6;
  const totalsW = pageW - margin - totalsX;
  const cellW = totalsW / 3;
  const cellH1 = 10;
  const cellH2 = 12;
  // En-têtes
  doc.setLineWidth(0.3);
  for (let i = 0; i < 3; i++) {
    doc.rect(totalsX + i * cellW, afterTable, cellW, cellH1);
    doc.rect(totalsX + i * cellW, afterTable + cellH1, cellW, cellH2);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Montant\nHT", totalsX + cellW / 2, afterTable + 4.2, { align: "center" });
  doc.text("Montant\nTVA", totalsX + cellW + cellW / 2, afterTable + 4.2, { align: "center" });
  doc.text("Montant\nTTC", totalsX + cellW * 2 + cellW / 2, afterTable + 4.2, { align: "center" });

  // Valeurs : alignées à droite, taille auto-ajustée pour rester dans la cellule
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
  drawAmount(fmt(totalHT), totalsX);
  drawAmount(fmt(tvaAmount), totalsX + cellW);
  drawAmount(fmt(totalTTC), totalsX + cellW * 2);

  // ============ Mode de paiement ============
  const payY = afterTable + Math.max(lettresH, cellH1 + cellH2) + 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(...BLACK);
  doc.text(`--- Mode de Paiement : ${invoice.paymentMethod || "—"} ---`, margin + 2, payY);

  // ============ Pied de page légal ============
  const footY = pageH - 18;
  doc.setDrawColor(...GREY);
  doc.setLineWidth(0.2);
  doc.line(margin, footY - 4, pageW - margin, footY - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...BLACK);

  // 1. Ligne 1 : Soit le footer personnalisé, soit l'adresse + GSM + RC
  let footerLine1 = company.legalFooter || "";
  if (!footerLine1) {
    const parts: string[] = [];
    if (company.address) parts.push(company.address);
    if (company.phone) parts.push(`GSM: ${company.phone}`);
    if (company.cnss) parts.push(`CNSS: ${company.cnss}`);
    if (company.rc) parts.push(`RC: ${company.rc}`);
    footerLine1 = parts.join("  –  ");
  }

  // 2. Ligne 2 : Identifiants fiscaux (Patente, IF, ICE)
  const footerLine2Parts: string[] = [];
  if (company.patente) footerLine2Parts.push(`Patente: ${company.patente}`);
  if (company.lf || company.if) footerLine2Parts.push(`IF: ${company.lf || company.if}`);
  if (company.ice) footerLine2Parts.push(`ICE: ${company.ice}`);
  const footerLine2 = footerLine2Parts.join("  –  ");

  // Affichage sécurisé (on vérifie que la string n'est pas vide)
  if (footerLine1.trim()) {
    doc.text(footerLine1, pageW / 2, footY, { align: "center", maxWidth: pageW - margin * 2 });
  }
  if (footerLine2.trim()) {
    doc.text(footerLine2, pageW / 2, footY + 4.5, {
      align: "center",
      maxWidth: pageW - margin * 2,
    });
  }

  // Numérotation de page
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text("Page 1/1", pageW / 2, pageH - 6, { align: "center" });

  // ============ DÉCLENCHEMENT DU TÉLÉCHARGEMENT ============
  const fileName = `${invoice.number || "facture"}.pdf`.replace(/\//g, "-"); // Sécurité sur le nom de fichier
  doc.save(fileName);
}