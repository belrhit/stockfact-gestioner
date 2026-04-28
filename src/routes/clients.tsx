import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useClients } from "@/hooks/useStore";
import { useMemo, useState } from "react";
import type { Client } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, Search, ArrowUpDown } from "lucide-react";
import { BulkBar } from "@/components/BulkBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clients")({
  component: () => (
    <AppLayout>
      <Toaster richColors position="top-right" />
      <ClientsPage />
    </AppLayout>
  ),
});

type SortKey = "code" | "name" | "ice";
const PAGE_SIZE = 25;

type FormState = {
  name: string;
  ice: string;
  address: string;
  phone: string;
  email: string;
};

const empty: FormState = { name: "", ice: "", address: "", phone: "", email: "" };

function ClientsPage() {
  const { clients, addClient, updateClient, deleteClient, deleteClients } = useClients();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return clients.filter((c) => {
      if (!s) return true;
      return (
        c.name.toLowerCase().includes(s) ||
        c.code.toLowerCase().includes(s) ||
        c.ice.toLowerCase().includes(s)
      );
    });
  }, [clients, q]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const v = a[sortKey].localeCompare(b[sortKey]);
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

  const allOnPageSelected = paginated.length > 0 && paginated.every((c) => selected.has(c.id));
  const togglePage = () => {
    const next = new Set(selected);
    if (allOnPageSelected) paginated.forEach((c) => next.delete(c.id));
    else paginated.forEach((c) => next.add(c.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const bulkDelete = () => {
    const ids = Array.from(selected);
    deleteClients(ids);
    toast.success(`${ids.length} client(s) supprimé(s).`);
    setSelected(new Set());
  };

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      name: c.name,
      ice: c.ice,
      address: c.address || "",
      phone: c.phone || "",
      email: c.email || "",
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Raison sociale requise.");
    const ice = form.ice.trim();
    if (!ice) return toast.error("ICE obligatoire.");
    if (!/^\d{15}$/.test(ice))
      return toast.error("L'ICE doit contenir exactement 15 chiffres.");
    if (editing) {
      updateClient(editing.id, { ...form });
      toast.success("Client mis à jour.");
    } else {
      const created = addClient({ ...form });
      toast.success(`Client ${created.code} créé.`);
    }
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Annuaire Clients</h1>
          <p className="text-muted-foreground mt-1">
            Gérez votre portefeuille clients (raison sociale, ICE, contact).
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Nouveau client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier le client" : "Nouveau client"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Raison sociale *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>ICE * (15 chiffres)</Label>
                  <Input
                    value={form.ice}
                    onChange={(e) =>
                      setForm({ ...form, ice: e.target.value.replace(/\D/g, "").slice(0, 15) })
                    }
                    inputMode="numeric"
                    pattern="\d{15}"
                    maxLength={15}
                    minLength={15}
                    placeholder="15 chiffres"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Adresse</Label>
                  <Textarea
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">{editing ? "Enregistrer" : "Créer"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher (nom, code, ICE)…"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-40" />
            Aucun client {q ? "trouvé" : "enregistré"}.
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
                  <SortHeader k="code" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Code</SortHeader>
                  <SortHeader k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Raison sociale</SortHeader>
                  <SortHeader k="ice" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>ICE</SortHeader>
                  <th className="px-3 py-3 font-medium">Téléphone</th>
                  <th className="px-3 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map((c) => (
                  <tr key={c.id} className={cn("hover:bg-muted/20", selected.has(c.id) && "bg-primary/5")}>
                    <td className="px-3 py-3">
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-primary">{c.code}</td>
                    <td className="px-3 py-3 font-medium">{c.name}</td>
                    <td className="px-3 py-3 font-mono text-xs">{c.ice}</td>
                    <td className="px-3 py-3 text-muted-foreground">{c.phone || "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{c.email || "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Les factures déjà émises ne
                                seront pas supprimées.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => { deleteClient(c.id); toast.success("Client supprimé."); }}>
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
              <AlertDialogTitle>Supprimer {selected.size} client(s) ?</AlertDialogTitle>
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

function SortHeader({
  k, sortKey, sortDir, onClick, children,
}: {
  k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc";
  onClick: (k: SortKey) => void; children: React.ReactNode;
}) {
  const active = sortKey === k;
  return (
    <th className="px-3 py-3 font-medium">
      <button onClick={() => onClick(k)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground")}>
        {children}
        <ArrowUpDown className={cn("h-3 w-3", active && (sortDir === "asc" ? "rotate-180" : ""))} />
      </button>
    </th>
  );
}
