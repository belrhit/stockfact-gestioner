import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import {
  useDeliveryNotes,
  useProducts,
  useClients,
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
import {
  Plus,
  Trash2,
  Truck,
  Download,
  ArrowUpDown,
  ArrowRightCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { BulkBar } from "@/components/BulkBar";
import { generateDeliveryNotePdf } from "@/lib/deliveryNotePdf";
import { cn } from "@/lib/utils";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { nextDocNumber, type DeliveryNote } from "@/lib/storage";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  client: fallback(z.string(), "").default(""),
  status: fallback(z.enum(["all", "En attente", "Facturé"]), "all").default("all"),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/delivery-notes")({
  validateSearch: zodValidator(searchSchema),
  component: () => (
    <AppLayout>
      <Toaster richColors position="top-right" />
      <DeliveryNotesPage />
    </AppLayout>
  ),
});

type SortKey = "number" | "date" | "client" | "status";
const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: "En attente" | "Facturé" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        status === "Facturé"
          ? "bg-green-100 text-green-700 border-green-200"
          : "bg-amber-100 text-amber-700 border-amber-200",
      )}
    >
      {status === "Facturé" ? "Facturé" : "En attente de facturation"}
    </span>
  );
}

function DeliveryNotesPage() {
  const { deliveryNotes, transformToInvoice, deleteDeliveryNotes } = useDeliveryNotes();
  const { clients } = useClients();
  const { activeCompany } = useActiveCompany();
  const [open, setOpen] = useState(false);
  const search = useSearch({ from: "/delivery-notes" });
  const navigate = useNavigate({ from: "/delivery-notes" });

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return deliveryNotes.filter((bl) => {
      if (search.status !== "all" && bl.status !== search.status) return false;
      if (search.client && bl.clientId !== search.client) return false;
      if (search.q && !bl.number.toLowerCase().includes(search.q.toLowerCase())) return false;
      if (search.from && new Date(bl.date) < new Date(search.from)) return false;
      if (search.to) {
        const end = new Date(search.to);
        end.setHours(23, 59, 59);
        if (new Date(bl.date) > end) return false;
      }
      return true;
    });
  }, [deliveryNotes, search]);

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
          v = (a.clientInfo?.name || a.client).localeCompare(
            b.clientInfo?.name || b.client,
          );
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
    paginated.length > 0 && paginated.every((bl) => selected.has(bl.id));

  const togglePage = () => {
    const next = new Set(selected);
    if (allOnPageSelected) paginated.forEach((bl) => next.delete(bl.id));
    else paginated.forEach((bl) => next.add(bl.id));
    setSelected(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const download = (bl: DeliveryNote) => {
    try {
      generateDeliveryNotePdf(bl, company);
    } catch (e) {
      console.error(e);
      toast.error("Erreur génération PDF.");
    }
  };

  const transform = (bl: DeliveryNote) => {
    try {
      const inv = transformToInvoice(bl.id);
      toast.success(`Facture ${inv.number} créée à partir du BL.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur transformation.");
    }
  };

  const bulkDelete = () => {
    const ids = Array.from(selected);
    deleteDeliveryNotes(ids);
    toast.success(`${ids.length} BL supprimé(s).`);
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
          <h1 className="text-3xl font-bold tracking-tight">Bons de Livraison</h1>
          <p className="text-muted-foreground mt-1">
            {sorted.length} BL · La création décrémente le stock immédiatement
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Nouveau BL
            </Button>
          </DialogTrigger>
          <NewDeliveryNoteDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs">N° BL</Label>
            <Input
              placeholder="BL-2024-..."
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
            <Label className="text-xs">Statut</Label>
            <Select
              value={search.status}
              onValueChange={(v) => setFilter({ status: v as typeof search.status })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="En attente">En attente</SelectItem>
                <SelectItem value="Facturé">Facturé</SelectItem>
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
          {(search.q || search.client || search.status !== "all" || search.from || search.to) && (
            <Button
              variant="ghost"
              size="sm"
              className="sm:col-span-2 lg:col-span-5 justify-self-start"
              onClick={() =>
                navigate({ search: { q: "", client: "", status: "all", from: "", to: "" } })
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
            <Truck className="h-10 w-10 mb-3 opacity-40" />
            Aucun bon de livraison {deliveryNotes.length > 0 ? "ne correspond aux filtres" : "pour le moment"}.
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
                  <th className="px-3 py-3 font-medium text-right">Articles</th>
                  <SortHeader k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Statut</SortHeader>
                  <th className="px-3 py-3 w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map((bl) => (
                  <tr key={bl.id} className={cn("hover:bg-muted/20", selected.has(bl.id) && "bg-primary/5")}>
                    <td className="px-3 py-3">
                      <Checkbox checked={selected.has(bl.id)} onCheckedChange={() => toggleOne(bl.id)} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-primary whitespace-nowrap">{bl.number}</td>
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(bl.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-3 py-3 font-medium truncate max-w-[200px]">
                      {bl.clientInfo?.name || bl.client}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground">
                      {bl.items.reduce((s, i) => s + i.quantity, 0)} unités
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={bl.status} /></td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {bl.status === "En attente" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => transform(bl)}
                          title="Transformer en facture"
                        >
                          <ArrowRightCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => download(bl)} title="Télécharger PDF">
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
              <AlertDialogTitle>Supprimer {selected.size} BL ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le stock des BL "En attente" sera réintégré automatiquement.
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

type LineItem = { productId: string; quantity: number };

function NewDeliveryNoteDialog({ onClose }: { onClose: () => void }) {
  const { products } = useProducts();
  const { clients } = useClients();
  const { deliveryNotes, createDeliveryNote } = useDeliveryNotes();

  const previewNumber = useMemo(() => nextDocNumber("BL", deliveryNotes), [deliveryNotes]);
  const today = new Date().toISOString().slice(0, 10);
  const [number, setNumber] = useState(previewNumber);
  const [date, setDate] = useState(today);
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ productId: "", quantity: 1 }]);

  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);

  const addLine = () => setItems((arr) => [...arr, { productId: "", quantity: 1 }]);
  const removeLine = (i: number) => setItems((arr) => arr.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<LineItem>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const submit = () => {
    if (!selectedClient) return toast.error("Sélectionnez un client.");
    if (!number.trim()) return toast.error("Le numéro du BL est requis.");
    if (!date) return toast.error("La date est requise.");
    if (items.length === 0) return toast.error("Ajoutez au moins une ligne.");
    if (items.some((it) => !it.productId || it.quantity <= 0))
      return toast.error("Chaque ligne doit avoir un produit et une quantité > 0.");

    try {
      const bl = createDeliveryNote({
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
        items,
        notes: notes.trim() || undefined,
      });
      toast.success(`BL ${bl.number} créé. Stock mis à jour.`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur création BL.");
    }
  };

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>Nouveau Bon de Livraison</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>N° BL *</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder={previewNumber} className="font-mono" />
          </div>
          <div className="space-y-1">
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Choisir un client…" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Notes (facultatif)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: livraison partielle" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Articles</Label>
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-3 w-3 mr-1" /> Ajouter
            </Button>
          </div>
          {items.map((it, i) => {
            const p = productMap[it.productId];
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-7 space-y-1">
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
                <div className="col-span-3 space-y-1">
                  <Input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                  />
                  {p && it.quantity > p.quantity && (
                    <p className="text-xs text-destructive">Stock insuffisant ({p.quantity}).</p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="col-span-2" onClick={() => removeLine(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button onClick={submit}>Créer le BL</Button>
      </DialogFooter>
    </DialogContent>
  );
}
