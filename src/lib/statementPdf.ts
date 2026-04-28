import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Client, CompanyInfo } from "./storage";
import { installPdfSafeText, sanitizeRows } from "./pdfSafe";

const fmt = (n: number): string => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const [intPart, decPart] = abs.toFixed(2).split(".");
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${withSpaces},${decPart}`;
};

export type StatementRow = {
  date: string; // ISO
  type: "Facture" | "Règlement" | "Avoir";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export function generateStatementPdf(
  client: Client,
  company: CompanyInfo,
  rows: StatementRow[],
  from: string,
  to: string,
  openingBalance: number,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  installPdfSafeText(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;

  // En-tête entreprise
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(company.name || "ENTREPRISE", margin, margin + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = margin + 11;
  if (company.address) doc.text(company.address, margin, y), (y += 4);
  if (company.ice) doc.text(`ICE: ${company.ice}`, margin, y), (y += 4);

  // Titre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("RELEVÉ DE COMPTE", pageW / 2, margin + 10, { align: "center" });

  // Bloc client
  const cy = margin + 28;
  doc.setLineWidth(0.3);
  doc.rect(margin, cy, pageW - margin * 2, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Client: ${client.name}`, margin + 3, cy + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Code: ${client.code}`, margin + 3, cy + 11);
  doc.text(`ICE: ${client.ice}`, margin + 3, cy + 16);
  if (client.address) {
    doc.text(client.address, margin + 80, cy + 11);
  }
  doc.text(
    `Période: du ${new Date(from).toLocaleDateString("fr-FR")} au ${new Date(to).toLocaleDateString("fr-FR")}`,
    pageW - margin - 3,
    cy + 6,
    { align: "right" },
  );

  // Tableau
  const head = [["Date", "Type", "Référence", "Description", "Débit", "Crédit", "Solde"]];
  const body: string[][] = [];
  body.push([
    new Date(from).toLocaleDateString("fr-FR"),
    "",
    "",
    "Solde initial",
    "",
    "",
    fmt(openingBalance),
  ]);
  for (const r of rows) {
    body.push([
      new Date(r.date).toLocaleDateString("fr-FR"),
      r.type,
      r.reference,
      r.description,
      r.debit ? fmt(r.debit) : "",
      r.credit ? fmt(r.credit) : "",
      fmt(r.balance),
    ]);
  }

  autoTable(doc, {
    startY: cy + 26,
    head,
    body: sanitizeRows(body),
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2, lineWidth: 0.2, lineColor: [0, 0, 0] },
    headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 22 },
      2: { cellWidth: 28 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 28, halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  // Totaux
  // @ts-expect-error lastAutoTable
  const finalY: number = doc.lastAutoTable.finalY + 6;
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const finalBalance = rows.length ? rows[rows.length - 1].balance : openingBalance;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const boxW = 80;
  const boxX = pageW - margin - boxW;
  doc.rect(boxX, finalY, boxW, 22);
  doc.text("Total débit:", boxX + 3, finalY + 6);
  doc.text(`${fmt(totalDebit)} MAD`, boxX + boxW - 3, finalY + 6, { align: "right" });
  doc.text("Total crédit:", boxX + 3, finalY + 12);
  doc.text(`${fmt(totalCredit)} MAD`, boxX + boxW - 3, finalY + 12, { align: "right" });
  doc.setFontSize(11);
  doc.text("Solde:", boxX + 3, finalY + 19);
  doc.text(`${fmt(finalBalance)} MAD`, boxX + boxW - 3, finalY + 19, { align: "right" });

  doc.save(`releve-${client.code}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
