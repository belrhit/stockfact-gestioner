import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useProducts } from "@/hooks/useStore";
import { Product, STOCK_THRESHOLD } from "@/lib/storage";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, ArrowUpDown, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { BulkBar } from "@/components/BulkBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/products")({
  component: () => (
    <AppLayout>
      <Toaster richColors position="top-right" />
      <ProductsPage />
    </AppLayout>
  ),
});

type SortKey = "name" | "reference" | "category" | "price" | "quantity";
const PAGE_SIZE = 25;

function ProductsPage() {
  const { products, addProduct, updateProduct, deleteProduct, deleteProducts } = useProducts();
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [stockLevel, setStockLevel] = useState<"all" | "critical" | "normal">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (category !== "all" && (p.category || "") !== category) return false;
      if (stockLevel === "critical" && p.quantity >= STOCK_THRESHOLD) return false;
      if (stockLevel === "normal" && p.quantity < STOCK_THRESHOLD) return false;
      return true;
    });
  }, [products, category, stockLevel]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let v = 0;
      switch (sortKey) {
        case "name": v = a.name.localeCompare(b.name); break;
        case "reference": v = a.reference.localeCompare(b.reference); break;
        case "category": v = (a.category || "").localeCompare(b.category || ""); break;
        case "price": v = a.price - b.price; break;
        case "quantity": v = a.quantity - b.quantity; break;
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
    else { setSortKey(k); setSortDir("asc"); }
  };

  const allOnPageSelected = paginated.length > 0 && paginated.every((p) => selected.has(p.id));
  const togglePage = () => {
    const next = new Set(selected);
    if (allOnPageSelected) paginated.forEach((p) => next.delete(p.id));
    else paginated.forEach((p) => next.add(p.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleSubmit = (data: Omit<Product, "id">) => {
    if (editing) updateProduct(editing.id, data);
    else addProduct(data);
    setOpen(false);
    setEditing(null);
    toast.success(editing ? "Produit mis à jour." : "Produit ajouté.");
  };

  const bulkDelete = () => {
    const ids = Array.from(selected);
    deleteProducts(ids);
    toast.success(`${ids.length} produit(s) supprimé(s).`);
    setSelected(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produits</h1>
          <p className="text-muted-foreground mt-1">
            {sorted.length} article{sorted.length > 1 ? "s" : ""} dans le catalogue
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Nouveau produit</Button>
          </DialogTrigger>
          <ProductDialog editing={editing} onSubmit={handleSubmit} categories={categories} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Catégorie</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Niveau de stock</Label>
            <Select value={stockLevel} onValueChange={(v) => { setStockLevel(v as typeof stockLevel); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous niveaux</SelectItem>
                <SelectItem value="critical">Critique (&lt; {STOCK_THRESHOLD})</SelectItem>
                <SelectItem value="normal">Normal (≥ {STOCK_THRESHOLD})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(category !== "all" || stockLevel !== "all") && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm"
                onClick={() => { setCategory("all"); setStockLevel("all"); }}>
                Réinitialiser
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <Package className="h-10 w-10 mb-3 opacity-40" />
            Aucun produit {products.length > 0 ? "ne correspond aux filtres" : ". Ajoutez votre premier article."}
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
        <SortHeader k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Nom</SortHeader>
        <SortHeader k="reference" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Référence</SortHeader>
        <SortHeader k="category" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Catégorie</SortHeader>
        <SortHeader k="price" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">Prix</SortHeader>
        {/* Ajout du (L) dans l'en-tête */}
        <SortHeader k="quantity" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">Stock (L)</SortHeader>
        <th className="px-3 py-3 text-right w-24">Actions</th>
      </tr>
    </thead>
    <tbody className="divide-y">
      {paginated.map((p) => (
        <tr key={p.id} className={cn("hover:bg-muted/30", selected.has(p.id) && "bg-primary/5")}>
          <td className="px-3 py-3">
            <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
          </td>
          <td className="px-3 py-3 font-medium">{p.name}</td>
          <td className="px-3 py-3 text-muted-foreground">{p.reference}</td>
          <td className="px-3 py-3 text-muted-foreground">{p.category || "—"}</td>
          <td className="px-3 py-3 text-right whitespace-nowrap">
            {p.price.toLocaleString("fr-FR", { style: "currency", currency: "MAD" })}
          </td>
          {/* Affichage des litres avec l'unité L */}
          <td className="px-3 py-3 text-right">
            {p.quantity < STOCK_THRESHOLD
              ? <Badge variant="destructive">{p.quantity} L</Badge>
              : <span>{p.quantity} L</span>}
          </td>
          <td className="px-3 py-3 text-right">
            <div className="inline-flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      "{p.name}" sera définitivement supprimé.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { deleteProduct(p.id); toast.success("Produit supprimé."); }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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
              <AlertDialogTitle>Supprimer {selected.size} produit(s) ?</AlertDialogTitle>
              <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
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

// Correction SonarLint S6759 : props en lecture seule
function SortHeader({
  k, sortKey, sortDir, onClick, children, align = "left",
}: {
  readonly k: SortKey; 
  readonly sortKey: SortKey; 
  readonly sortDir: "asc" | "desc";
  readonly onClick: (k: SortKey) => void; 
  readonly children: React.ReactNode; 
  readonly align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th className={cn("px-3 py-3 font-medium", align === "right" && "text-right")}>
      <button 
        type="button"
        onClick={() => onClick(k)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground")}>
        {children}
        <ArrowUpDown className={cn("h-3 w-3", active && (sortDir === "asc" ? "rotate-180" : ""))} />
      </button>
    </th>
  );
}

function ProductDialog({
  editing, onSubmit, categories,
}: {
  readonly editing: Product | null;
  readonly onSubmit: (data: Omit<Product, "id">) => void;
  readonly categories: string[];
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [reference, setReference] = useState(editing?.reference ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [price, setPrice] = useState(editing?.price?.toString() ?? "");
  const [quantity, setQuantity] = useState(editing?.quantity?.toString() ?? "");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
      </DialogHeader>
      <form 
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name: name.trim(), 
            reference: reference.trim(),
            category: category.trim() || undefined,
            price: parseFloat(price) || 0,
            quantity: parseFloat(quantity) || 0,
            // FIX ÉTAPE 1 : Ajout du companyId obligatoire
            companyId: editing?.companyId ?? "default", 
          });
        }}
      >
        <div className="space-y-2">
          <Label>Nom</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Référence</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} list="cat-list" placeholder="Ex: Liquides" />
            <datalist id="cat-list">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Prix (MAD)</Label>
            <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Quantité (Litres)</Label>
            <Input 
              type="number" 
              step="0.01" 
              min="0" 
              value={quantity} 
              onChange={(e) => setQuantity(e.target.value)} 
              required 
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">{editing ? "Enregistrer" : "Ajouter"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}