import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useClients, useInvoices, usePayments, useActiveCompany, useCreditNotes } from "@/hooks/useStore";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Download, BookOpen } from "lucide-react";
import { invoiceTotalTTC } from "@/lib/storage";
import { generateStatementPdf, type StatementRow } from "@/lib/statementPdf";

export const Route = createFileRoute("/statement")({
  component: () => (
    <AppLayout>
      <Toaster richColors position="top-right" />
      <StatementPage />
    </AppLayout>
  ),
});

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";

function StatementPage() {
  const { clients } = useClients();
  const { invoices } = useInvoices();
  const { payments } = usePayments();
  const { creditNotes } = useCreditNotes();
  const { activeCompany } = useActiveCompany();

  const today = new Date().toISOString().slice(0, 10);
  const startDefault = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState(startDefault);
  const [to, setTo] = useState(today);

  const client = clients.find((c) => c.id === clientId);

  const { rows, opening } = useMemo(() => {
    if (!clientId) return { rows: [] as StatementRow[], opening: 0 };
    const fromTs = new Date(from).getTime();
    const toTs = new Date(to).getTime() + 86400000 - 1;

    type Entry = { date: string; type: "Facture" | "Règlement" | "Avoir"; reference: string; description: string; debit: number; credit: number };

    const entries: Entry[] = [];
    for (const inv of invoices) {
      if (inv.clientId !== clientId) continue;
      entries.push({
        date: inv.date,
        type: "Facture",
        reference: inv.number,
        description: `Facture ${inv.items.length} article(s)`,
        debit: invoiceTotalTTC(inv),
        credit: 0,
      });
    }
    for (const p of payments) {
      if (p.clientId !== clientId) continue;
      entries.push({
        date: p.date,
        type: "Règlement",
        reference: p.reference || p.mode,
        description: `Règlement ${p.mode}`,
        debit: 0,
        credit: p.amount,
      });
    }
    for (const cn of creditNotes) {
      if (cn.clientId !== clientId) continue;
      entries.push({
        date: cn.date,
        type: "Avoir",
        reference: cn.number,
        description: cn.invoiceNumber
          ? `Avoir s/ ${cn.invoiceNumber}${cn.reason ? ` — ${cn.reason}` : ""}`
          : `Avoir${cn.reason ? ` — ${cn.reason}` : ""}`,
        debit: 0,
        credit: cn.totalTTC,
      });
    }

    entries.sort((a, b) => +new Date(a.date) - +new Date(b.date));

    let opening = 0;
    const inRange: StatementRow[] = [];
    let bal = 0;
    for (const e of entries) {
      const ts = new Date(e.date).getTime();
      if (ts < fromTs) {
        opening += e.debit - e.credit;
        bal = opening;
      }
    }
    bal = opening;
    for (const e of entries) {
      const ts = new Date(e.date).getTime();
      if (ts < fromTs || ts > toTs) continue;
      bal += e.debit - e.credit;
      inRange.push({ ...e, balance: bal });
    }
    return { rows: inRange, opening };
  }, [clientId, invoices, payments, creditNotes, from, to]);

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const finalBalance = rows.length ? rows[rows.length - 1].balance : opening;

  const exportPdf = () => {
    if (!client) return toast.error("Sélectionnez un client.");
    try {
      generateStatementPdf(client, activeCompany, rows, from, to, opening);
      toast.success("Relevé téléchargé.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la génération du PDF.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relevé de Compte</h1>
        <p className="text-muted-foreground mt-1">
          Historique chronologique factures (débit) et règlements (crédit) par client.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 grid md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2 md:col-span-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un client…" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Du</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Au</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <Button onClick={exportPdf} disabled={!client}>
              <Download className="h-4 w-4 mr-1" /> Exporter en PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {!client ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 opacity-40" />
            Sélectionnez un client pour afficher son relevé.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Référence</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium text-right">Débit</th>
                  <th className="px-4 py-3 font-medium text-right">Crédit</th>
                  <th className="px-4 py-3 font-medium text-right">Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="bg-muted/20">
                  <td className="px-4 py-2 text-muted-foreground" colSpan={6}>
                    Solde initial au {new Date(from).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(opening)}</td>
                </tr>
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/10">
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(r.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-2">
                      <span className={
                        r.type === "Facture"
                          ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-100 text-blue-700 border-blue-200"
                          : r.type === "Règlement"
                          ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-green-100 text-green-700 border-green-200"
                          : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-red-100 text-red-700 border-red-200"
                      }>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.reference}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.description}</td>
                    <td className="px-4 py-2 text-right">{r.debit ? fmt(r.debit) : "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {r.credit ? fmt(r.credit) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{fmt(r.balance)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Aucun mouvement sur la période.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td className="px-4 py-3" colSpan={4}>
                    Totaux période
                  </td>
                  <td className="px-4 py-3 text-right">{fmt(totalDebit)}</td>
                  <td className="px-4 py-3 text-right">{fmt(totalCredit)}</td>
                  <td className="px-4 py-3 text-right text-primary text-base">
                    {fmt(finalBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
