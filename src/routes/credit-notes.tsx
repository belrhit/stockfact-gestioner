import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import {
  useCreditNotes,
  useProducts,
  useClients,
  useInvoices,
  useActiveCompany,
} from "@/hooks/useStore";
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
import { Plus, Trash2, RotateCcw, Download, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { BulkBar } from "@/components/BulkBar";
import { generateCreditNotePdf } from "@/lib/creditNotePdf";
import { cn } from "@/lib/utils";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { nextDocNumber, type CreditNote } from "@/lib/storage";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  client: fallback(z.string(), "").default(""),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/credit-notes")({
  validateSearch: zodValidator(searchSchema),
  component: () => (
    <AppLayout>
      <Toaster richColors position="top-right" />
      <CreditNotesPage />
    </AppLayout>
  ),
});

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";

type SortKey = "number" | "date" | "client" | "total";
const PAGE_SIZE = 20;

function CreditNotesPage() {
  const { creditNotes, deleteCreditNotes } = useCreditNotes();
  const { clients } = useClients();
  const { activeCompany } = useActiveCompany();
  const [open, setOpen] = useState(false);
  const search = useSearch({ from: "/credit-notes" });
  const navigate = useNavigate({ from: "/credit-notes" });

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return creditNotes.filter((cn) => {
      if (search.client && cn.clientId !== search.client) return false;
      if (search.q && !cn.number.toLowerCase().includes(search.q.toLowerCase())) return false;
      if (search.from && new Date(cn.date) < new Date(search.from)) return false;
      if (search.to) {
        const end = new Date(search.to);
        end.setHours(23, 59, 59);
        if (new Date(cn.date) > end) return false;
      }
      return true;
    });
  }, [creditNotes, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let v = 0;
      switch (sortKey) {
        case "number":
          v = a.number.localeCompare(b.number);
          break;
        case "date":
          v = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "client":
          v = (a.clientInfo?.name || a.client).localeCompare(b.clientInfo?.name || b.client);
          break;
        case "total":
          v = a.totalTTC - b.totalTTC;
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
    paginated.length > 0 && paginated.every((cn) => selected.has(cn.id));

  const togglePage = () => {
    const next = new Set(selected);
    if (allOnPageSelected) paginated.forEach((cn) => next.delete(cn.id));
    else paginated.forEach((cn) => next.add(cn.id));
    setSelected(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const download = (cn: CreditNote) => {
    try {
      generateCreditNotePdf(cn, activeCompany);
    } catch (e) {
      console.error(e);
      toast.error("Erreur génération PDF.");
    }
  };

  const bulkDelete = () => {
    const ids = Array.from(selected);
    deleteCreditNotes(ids);
    toast.success(`${ids.length} avoir(s) supprimé(s).`);
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
          <h1 className="text-3xl font-bold tracking-tight">Factures d'Avoir</h1>
          <p className="text-muted-foreground mt-1">
            {sorted.length} avoir{sorted.length > 1 ? "s" : ""} · Réintègre le stock et déduit du solde client
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Nouvel avoir
            </Button>
          </DialogTrigger>
          <NewCreditNoteDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">N° Avoir</Label>
            <Input
              placeholder="AV-2024-..."
              value={search.q}
              onChange={(e) => setFilter({ q: e.target.value })}
            />
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
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Du</Label>
            <Input type="date" value={search.from} onChange={(e) => setFilter({ from: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Au</Label>
            <Input type="date" value={search.to} onChange={(e) => setFilter({ to: e.target.value })} />
          </div>
          {(search.q || search.client || search.from || search.to) && (
            <Button
              variant="ghost"
              size="sm"
              className="sm:col-span-2 lg:col-span-4 justify-self-start"
              onClick={() => navigate({ search: { q: "", client: "", from: "", to: "" } })}
            >
              Réinitialiser les filtres
            </Button>
          )}
        </CardContent>
      </Card>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <RotateCcw className="h-10 w-10 mb-3 opacity-40" />
            Aucun avoir {creditNotes.length > 0 ? "ne correspond aux filtres" : "pour le moment"}.
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
                  <th className="px-3 py-3 font-medium">Facture liée</th>
                  <SortHeader k="total" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">
                    Total TTC
                  </SortHeader>
                  <th className="px-3 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map((row) => (
                  <tr key={row.id} className={cn("hover:bg-muted/20", selected.has(row.id) && "bg-primary/5")}>
                    <td className="px-3 py-3">
                      <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggleOne(row.id)} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-primary whitespace-nowrap">{row.number}</td>
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(row.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-3 py-3 font-medium truncate max-w-[200px]">
                      {row.clientInfo?.name || row.client}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                      {row.invoiceNumber || "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-medium whitespace-nowrap text-destructive">
                      -{fmt(row.totalTTC)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => download(row)} title="Télécharger PDF">
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                <span className="text-muted-foreground">Page {safePage} / {totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
                  <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer {selected.size} avoir(s) ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le stock préalablement réintégré sera décrémenté à nouveau.
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
  k, sortKey, sortDir, onClick, children, align = "left",
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

type LineItem = { productId: string; quantity: number; price: number; name: string; reference: string };

function NewCreditNoteDialog({ onClose }: { onClose: () => void }) {
  const { products } = useProducts();
  const { clients } = useClients();
  const { invoices } = useInvoices();
  const { creditNotes, createCreditNote } = useCreditNotes();

  const previewNumber = useMemo(() => nextDocNumber("AV", creditNotes), [creditNotes]);
  const today = new Date().toISOString().slice(0, 10);

  const [number, setNumber] = useState(previewNumber);
  const [date, setDate] = useState(today);
  const [clientId, setClientId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState("");
  const [tvaRate, setTvaRate] = useState(20);
  const [items, setItems] = useState<LineItem[]>([
    { productId: "", quantity: 1, price: 0, name: "", reference: "" },
  ]);

  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);

  const clientInvoices = useMemo(
    () => (clientId ? invoices.filter((i) => i.clientId === clientId) : []),
    [invoices, clientId],
  );

  // Quand on choisit une facture, on pré-remplit les lignes
  const loadInvoiceLines = (invId: string) => {
    setInvoiceId(invId);
    const inv = invoices.find((i) => i.id === invId);
    if (!inv) return;
    setItems(
      inv.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        price: it.price,
        name: it.name,
        reference: it.reference,
      })),
    );
    setTvaRate(inv.tvaRate ?? 20);
  };

  const addLine = () =>
    setItems((arr) => [...arr, { productId: "", quantity: 1, price: 0, name: "", reference: "" }]);
  const removeLine = (i: number) => setItems((arr) => arr.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<LineItem>) =>
    setItems((arr) =>
      arr.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, ...patch };
        if (patch.productId) {
          const p = productMap[patch.productId];
          if (p) {
            next.price = p.price;
            next.name = p.name;
            next.reference = p.reference;
          }
        }
        return next;
      }),
    );

  const totalHT = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const tvaAmount = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + tvaAmount;

  const submit = () => {
    if (!selectedClient) return toast.error("Sélectionnez un client.");
    if (!number.trim()) return toast.error("Le numéro de l'avoir est requis.");
    if (!date) return toast.error("La date est requise.");
    if (items.length === 0) return toast.error("Ajoutez au moins une ligne.");
    if (items.some((it) => !it.productId || it.quantity <= 0))
      return toast.error("Chaque ligne doit avoir un produit et une quantité > 0.");

    try {
      const inv = invoices.find((i) => i.id === invoiceId);
      const cn = createCreditNote({
        client: {
          name: selectedClient.name,
          address: selectedClient.address,
          ice: selectedClient.ice,
          phone: selectedClient.phone,
          email: selectedClient.email,
        },
        clientId: selectedClient.id,
        number: number.trim(),
        date: new Date(date).toISOString(),
        invoiceId: invoiceId || undefined,
        invoiceNumber: inv?.number,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          price: it.price,
          name: it.name,
          reference: it.reference,
        })),
        tvaRate,
        reason: reason.trim() || undefined,
      });
      toast.success(`Avoir ${cn.number} créé. Stock réintégré.`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur.");
    }
  };

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Nouvel Avoir</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>N° Avoir *</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder={previewNumber} className="font-mono" />
          </div>
          <div className="space-y-1">
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={(v) => { setClientId(v); setInvoiceId(""); }}>
              <SelectTrigger><SelectValue placeholder="Choisir un client…" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Facture initiale (optionnel)</Label>
            <Select value={invoiceId || "none"} onValueChange={(v) => v === "none" ? setInvoiceId("") : loadInvoiceLines(v)} disabled={!clientId}>
              <SelectTrigger>
                <SelectValue placeholder={clientId ? "Choisir une facture…" : "Sélectionnez un client d'abord"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucune —</SelectItem>
                {clientInvoices.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.number} ({new Date(i.date).toLocaleDateString("fr-FR")})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Motif</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: retour marchandise, erreur de facturation" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Articles à créditer</Label>
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-3 w-3 mr-1" /> Ajouter
            </Button>
          </div>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5 space-y-1">
                <Select value={it.productId} onValueChange={(v) => updateLine(i, { productId: v })}>
                  <SelectTrigger><SelectValue placeholder="Produit" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} (stock: {p.quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Input
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-3 space-y-1">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={it.price}
                  onChange={(e) => updateLine(i, { price: Number(e.target.value) })}
                />
              </div>
              <Button variant="ghost" size="icon" className="col-span-2" onClick={() => removeLine(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-end justify-between border-t pt-3">
          <div className="space-y-1 w-32">
            <Label>TVA (%)</Label>
            <Input type="number" value={tvaRate} onChange={(e) => setTvaRate(Number(e.target.value))} />
          </div>
          <div className="text-right space-y-1 text-sm">
            <div className="text-muted-foreground">HT : <span className="font-medium text-foreground">{fmt(totalHT)}</span></div>
            <div className="text-muted-foreground">TVA : <span className="font-medium text-foreground">{fmt(tvaAmount)}</span></div>
            <div className="text-base font-bold text-destructive">Avoir TTC : -{fmt(totalTTC)}</div>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button onClick={submit}>Créer l'avoir</Button>
      </DialogFooter>
    </DialogContent>
  );
}
