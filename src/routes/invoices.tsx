import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useInvoices, useProducts, useActiveCompany, useClients, usePayments } from "@/hooks/useStore";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Trash2, FileText, Download, Users, ArrowUpDown, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { BulkBar } from "@/components/BulkBar";
import {
  nextInvoiceNumber,
  invoiceStatus,
  invoicePaidAmount,
  invoiceTotalTTC,
  type Invoice,
} from "@/lib/storage";
import { generateInvoicePdf } from "@/lib/invoicePdf";
import { cn } from "@/lib/utils";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const searchSchema = z.object({
  status: fallback(z.enum(["all", "Impayée", "Partielle", "Soldée"]), "all").default("all"),
  client: fallback(z.string(), "").default(""),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/invoices")({
  validateSearch: zodValidator(searchSchema),
  component: () => (
    <AppLayout>
      <Toaster richColors position="top-right" />
      <InvoicesPage />
    </AppLayout>
  ),
});

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";

function StatusBadge({ status }: { status: "Impayée" | "Partielle" | "Soldée" }) {
  const styles = {
    "Impayée": "bg-red-100 text-red-700 border-red-200",
    "Partielle": "bg-orange-100 text-orange-700 border-orange-200",
    "Soldée": "bg-green-100 text-green-700 border-green-200",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}

type SortKey = "number" | "date" | "client" | "total" | "status";
const PAGE_SIZE = 20;


function InvoicesPage() {
  const { invoices, deleteInvoices } = useInvoices();
  const { activeCompany } = useActiveCompany();
  const { clients } = useClients();
  const { payments, addPaymentBulk } = usePayments();
  const [open, setOpen] = useState(false);
  const search = useSearch({ from: "/invoices" });
  const navigate = useNavigate({ from: "/invoices" });

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const enriched = useMemo(
    () =>
      invoices.map((inv) => {
        const ttc = invoiceTotalTTC(inv);
        const paid = invoicePaidAmount(inv, payments);
        const status = invoiceStatus(inv, payments);
        return { inv, ttc, paid, status };
      }),
    [invoices, payments],
  );

  const filtered = useMemo(() => {
    return enriched.filter(({ inv, status }) => {
      if (search.status !== "all" && status !== search.status) return false;
      if (search.client && inv.clientId !== search.client) return false;
      if (search.from && new Date(inv.date) < new Date(search.from)) return false;
      if (search.to) {
        const end = new Date(search.to);
        end.setHours(23, 59, 59);
        if (new Date(inv.date) > end) return false;
      }
      return true;
    });
  }, [enriched, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let v = 0;
      switch (sortKey) {
        case "number":
          v = a.inv.number.localeCompare(b.inv.number);
          break;
        case "date":
          v = new Date(a.inv.date).getTime() - new Date(b.inv.date).getTime();
          break;
        case "client":
          v = (a.inv.clientInfo?.name || a.inv.client).localeCompare(
            b.inv.clientInfo?.name || b.inv.client,
          );
          break;
        case "total":
          v = a.ttc - b.ttc;
          break;
        case "status":
          v = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === "asc" ? v : -v;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const allOnPageSelected =
    paginated.length > 0 && paginated.every(({ inv }) => selected.has(inv.id));

  const togglePage = () => {
    const next = new Set(selected);
    if (allOnPageSelected) paginated.forEach(({ inv }) => next.delete(inv.id));
    else paginated.forEach(({ inv }) => next.add(inv.id));
    setSelected(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }; 

  const download = (inv: Invoice) => {
    try {
      generateInvoicePdf(inv, activeCompany.settings);
    } catch (e) {
      toast.error("Erreur lors de la génération du PDF.");
      console.error(e);
    }
  };

  const bulkExport = () => {
    const list = enriched.filter(({ inv }) => selected.has(inv.id));
    list.forEach(({ inv }) => {
      try {
        generateInvoicePdf(inv, activeCompany.settings);
      } catch (e) {
        console.error(e);
      }
    });
    toast.success(`${list.length} facture(s) exportée(s).`);
  };

  const bulkSettle = () => {
    const list = enriched.filter(
      ({ inv, status }) => selected.has(inv.id) && status !== "Soldée",
    );
    if (list.length === 0) {
      toast.info("Aucune facture à solder.");
      return;
    }
    const entries = list
      .filter(({ inv }) => inv.clientId)
      .map(({ inv, ttc, paid }) => ({
        clientId: inv.clientId!,
        invoiceId: inv.id,
        amount: ttc - paid,
        date: new Date().toISOString(),
        mode: "Virement" as const,
        reference: "Solde groupé",
      }));
    addPaymentBulk(entries);
    toast.success(`${entries.length} facture(s) soldée(s).`);
    setSelected(new Set());
  };

  const bulkDelete = () => {
    const ids = Array.from(selected);
    deleteInvoices(ids);
    toast.success(`${ids.length} facture(s) supprimée(s).`);
    setSelected(new Set());
  };

  const setFilter = (patch: Partial<z.infer<typeof searchSchema>>) => {
    setPage(1);
    navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch }) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Factures</h1>
          <p className="text-muted-foreground mt-1">
            {sorted.length} facture{sorted.length > 1 ? "s" : ""} · gestion industrielle
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Nouvelle facture
            </Button>
          </DialogTrigger>
          <NewInvoiceDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Statut</Label>
            <Select
              value={search.status}
              onValueChange={(v) => setFilter({ status: v as typeof search.status })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="Impayée">Impayée</SelectItem>
                <SelectItem value="Partielle">Partielle</SelectItem>
                <SelectItem value="Soldée">Soldée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Client</Label>
            <Select
              value={search.client || "all"}
              onValueChange={(v) => setFilter({ client: v === "all" ? "" : v })}
            >
              <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Du</Label>
            <Input
              type="date"
              value={search.from}
              onChange={(e) => setFilter({ from: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Au</Label>
            <Input
              type="date"
              value={search.to}
              onChange={(e) => setFilter({ to: e.target.value })}
            />
          </div>
          {(search.status !== "all" || search.client || search.from || search.to) && (
            <Button
              variant="ghost"
              size="sm"
              className="sm:col-span-2 lg:col-span-4 justify-self-start"
              onClick={() =>
                navigate({ search: { status: "all", client: "", from: "", to: "" } })
              }
            >
              Réinitialiser les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <FileText className="h-10 w-10 mb-3 opacity-40" />
            Aucune facture {invoices.length > 0 ? "ne correspond aux filtres" : "pour le moment"}.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <Checkbox checked={allOnPageSelected} onCheckedChange={togglePage} />
                  </th>
                  <SortHeader k="number" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>N°</SortHeader>
                  <SortHeader k="date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Date</SortHeader>
                  <SortHeader k="client" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Client</SortHeader>
                  <SortHeader k="total" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">Total TTC</SortHeader>
                  <th className="px-3 py-3 font-medium text-right">Réglé</th>
                  <SortHeader k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Statut</SortHeader>
                  <th className="px-3 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map(({ inv, ttc, paid, status }) => (
                  <tr key={inv.id} className={cn("hover:bg-muted/20", selected.has(inv.id) && "bg-primary/5")}>
                    <td className="px-3 py-3">
                      <Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggleOne(inv.id)} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-primary whitespace-nowrap">{inv.number}</td>
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(inv.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-3 py-3 font-medium truncate max-w-[200px]">
                      {inv.clientInfo?.name || inv.client}
                    </td>
                    <td className="px-3 py-3 text-right font-medium whitespace-nowrap">{fmt(ttc)}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {paid > 0 ? fmt(paid) : "—"}
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={status} /></td>
                    <td className="px-3 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => download(inv)} title="Télécharger PDF">
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                <span className="text-muted-foreground">
                  Page {safePage} / {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
                    Précédent
                  </Button>
                  <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button size="sm" variant="ghost" onClick={bulkExport}>
          <Download className="h-4 w-4 mr-1" /> Exporter
        </Button>
        <Button size="sm" variant="ghost" onClick={bulkSettle}>
          <CheckCircle2 className="h-4 w-4 mr-1" /> Solder
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer {selected.size} facture(s) ?</AlertDialogTitle>
              <AlertDialogDescription>
                Action irréversible. Les règlements liés seront aussi supprimés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={bulkDelete}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </BulkBar>
    </div>
  );
}

function SortHeader({
  k,
  sortKey,
  sortDir,
  onClick,
  children,
  align = "left",
}: {
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th className={cn("px-3 py-3 font-medium", align === "right" && "text-right")}>
      <button
        onClick={() => onClick(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {children}
        <ArrowUpDown className={cn("h-3 w-3", active && (sortDir === "asc" ? "rotate-180" : ""))} />
      </button>
    </th>
  );
}

type LineItem = { productId: string; quantity: number };

function NewInvoiceDialog({ onClose }: { onClose: () => void }) {
  const { products } = useProducts();
  const { invoices, createInvoice } = useInvoices();
  const { activeCompany } = useActiveCompany();
  const { clients } = useClients();

  const previewNumber = useMemo(() => nextInvoiceNumber(invoices), [invoices]);

  const [clientId, setClientId] = useState<string>("");
  const today = new Date().toISOString().slice(0, 10);
  const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [number, setNumber] = useState(previewNumber);
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState(defaultDue);
  const [paymentMethod, setPaymentMethod] = useState("Virement");
  const [items, setItems] = useState<LineItem[]>([{ productId: "", quantity: 1 }]);

  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products],
  );
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId],
  );

  const totalHT = items.reduce((s, it) => {
    const p = productMap[it.productId];
    return p ? s + p.price * it.quantity : s;
  }, 0);
  const tva = totalHT * 0.2;
  const totalTTC = totalHT + tva;

  const updateItem = (i: number, patch: Partial<LineItem>) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return toast.error("Sélectionnez un client.");
    if (!number.trim()) return toast.error("Le numéro de facture est requis.");
    if (!date) return toast.error("La date est requise.");
    const valid = items.filter((i) => i.productId && i.quantity > 0);
    if (valid.length === 0) return toast.error("Ajoutez au moins un produit.");
    try {
      const created = createInvoice({
        client: {
          name: selectedClient.name,
          address: selectedClient.address,
          ice: selectedClient.ice,
          phone: selectedClient.phone,
          email: selectedClient.email,
        },
        clientId: selectedClient.id,
        items: valid,
        number: number.trim(),
        date: new Date(date).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        paymentMethod,
        tvaRate: 20,
      });
      toast.success(`Facture ${created.number} créée. Stock mis à jour.`);
      try {
        generateInvoicePdf(created, activeCompany.settings);
      } catch (err) {
        console.error(err);
      }
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Nouvelle facture</DialogTitle>
      </DialogHeader>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>N° de facture *</Label>
            <Input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder={previewNumber}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Date d'échéance</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mode de paiement</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Espèces">Espèces</SelectItem>
              <SelectItem value="Virement">Virement</SelectItem>
              <SelectItem value="Chèque">Chèque</SelectItem>
              <SelectItem value="Effet">Effet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-md p-3 space-y-3 bg-muted/20">
          <div className="text-sm font-medium">Client</div>
          {clients.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Aucun client enregistré.{" "}
              <Link to="/clients" className="underline text-primary">Créer un client</Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Sélection client *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un client…" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClient && (
                <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
                  <div><span className="font-semibold">ICE:</span> {selectedClient.ice}</div>
                  {selectedClient.address && <div>{selectedClient.address}</div>}
                  {selectedClient.phone && <div>Tél: {selectedClient.phone}</div>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label>Articles</Label>
          <div className="space-y-2">
            {items.map((it, i) => {
              const p = productMap[it.productId];
              const max = p?.quantity ?? 0;
              const overflow = p && it.quantity > max;
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-start p-2 rounded border bg-muted/20">
                  <div className="col-span-7">
                    <Select value={it.productId} onValueChange={(v) => updateItem(i, { productId: v, quantity: 1 })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
                      <SelectContent>
                        {products.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Aucun produit disponible.</div>
                        )}
                        {products.map((prod) => (
                          <SelectItem key={prod.id} value={prod.id} disabled={prod.quantity <= 0}>
                            {prod.name} — stock: {prod.quantity}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {p && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {fmt(p.price)} · stock dispo: {p.quantity}
                      </div>
                    )}
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number" min={1} max={max || undefined} value={it.quantity}
                      onChange={(e) => updateItem(i, { quantity: parseInt(e.target.value) || 1 })}
                      disabled={!p}
                      className={overflow ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2 h-9">
                    <span className="text-sm text-muted-foreground truncate">
                      {p ? fmt(p.price * it.quantity) : "—"}
                    </span>
                    <Button type="button" variant="ghost" size="icon"
                      onClick={() => setItems((arr) => arr.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button type="button" variant="outline" size="sm"
            onClick={() => setItems((arr) => [...arr, { productId: "", quantity: 1 }])}>
            <Plus className="h-3 w-3 mr-1" /> Ajouter une ligne
          </Button>
        </div>

        <div className="border-t pt-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total HT</span>
            <span className="font-medium">{fmt(totalHT)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">TVA (20%)</span>
            <span className="font-medium">{fmt(tva)}</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-sm">Total TTC</span>
            <span className="text-2xl font-semibold text-primary">{fmt(totalTTC)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit">
            <Download className="h-4 w-4 mr-1" /> Valider & Télécharger
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
