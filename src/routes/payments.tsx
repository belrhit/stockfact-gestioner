import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useInvoices, usePayments, useClients } from "@/hooks/useStore";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Plus, Trash2, Wallet } from "lucide-react";
import {
  invoicePaidAmount,
  invoiceTotalTTC,
  type PaymentMode,
} from "@/lib/storage";

export const Route = createFileRoute("/payments")({
  component: () => (
    <AppLayout>
      <Toaster richColors position="top-right" />
      <PaymentsPage />
    </AppLayout>
  ),
});

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";

const MODES: PaymentMode[] = ["Espèces", "Chèque", "Virement", "Effet"];

function PaymentsPage() {
  const { payments, addPayment, deletePayment } = usePayments();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  const [open, setOpen] = useState(false);

  const [clientId, setClientId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("Virement");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const clientInvoices = useMemo(
    () => invoices.filter((i) => i.clientId === clientId),
    [invoices, clientId],
  );

  const selectedInvoice = invoices.find((i) => i.id === invoiceId);
  const remaining = selectedInvoice
    ? invoiceTotalTTC(selectedInvoice) - invoicePaidAmount(selectedInvoice, payments)
    : 0;

  const reset = () => {
    setClientId("");
    setInvoiceId("");
    setAmount("");
    setMode("Virement");
    setReference("");
    setDate(new Date().toISOString().slice(0, 10));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return toast.error("Sélectionnez un client.");
    if (!invoiceId) return toast.error("Sélectionnez une facture.");
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return toast.error("Montant invalide.");
    try {
      addPayment({
        clientId,
        invoiceId,
        amount: amt,
        date: new Date(date).toISOString(),
        mode,
        reference: reference.trim() || undefined,
      });
      toast.success("Règlement enregistré.");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
  const invoiceMap = Object.fromEntries(invoices.map((i) => [i.id, i]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Règlements</h1>
          <p className="text-muted-foreground mt-1">
            Suivez les paiements clients et le statut de chaque facture.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Enregistrer un paiement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouveau règlement</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select
                  value={clientId}
                  onValueChange={(v) => {
                    setClientId(v);
                    setInvoiceId("");
                  }}
                >
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
                <Label>Facture *</Label>
                <Select value={invoiceId} onValueChange={setInvoiceId} disabled={!clientId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        clientId ? "Choisir une facture…" : "Sélectionnez d'abord un client"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {clientInvoices.length === 0 && clientId && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Aucune facture pour ce client.
                      </div>
                    )}
                    {clientInvoices.map((i) => {
                      const r = invoiceTotalTTC(i) - invoicePaidAmount(i, payments);
                      return (
                        <SelectItem key={i.id} value={i.id} disabled={r <= 0.0001}>
                          {i.number} — Reste {fmt(Math.max(0, r))}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedInvoice && (
                  <p className="text-xs text-muted-foreground">
                    Total TTC: {fmt(invoiceTotalTTC(selectedInvoice))} · Reste dû:{" "}
                    <span className="font-medium text-foreground">{fmt(Math.max(0, remaining))}</span>
                  </p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Montant (MAD) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mode *</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Référence</Label>
                  <Input
                    placeholder="N° chèque, virement…"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="submit">Enregistrer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <Wallet className="h-10 w-10 mb-3 opacity-40" />
            Aucun règlement enregistré.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Facture</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">Référence</th>
                  <th className="px-4 py-3 font-medium text-right">Montant</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments
                  .slice()
                  .sort((a, b) => +new Date(b.date) - +new Date(a.date))
                  .map((p) => {
                    const c = clientMap[p.clientId];
                    const inv = invoiceMap[p.invoiceId];
                    return (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(p.date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-4 py-3">{c?.name || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-primary">
                          {inv?.number || "—"}
                        </td>
                        <td className="px-4 py-3">{p.mode}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.reference || "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {fmt(p.amount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer ce règlement ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Le statut de la facture sera recalculé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    deletePayment(p.id);
                                    toast.success("Règlement supprimé.");
                                  }}
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
