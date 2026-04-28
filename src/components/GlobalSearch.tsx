import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Users, Package, Search, Truck, RotateCcw } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useInvoices, useClients, useProducts, useDeliveryNotes, useCreditNotes } from "@/hooks/useStore";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  const { products } = useProducts();
  const { deliveryNotes } = useDeliveryNotes();
  const { creditNotes } = useCreditNotes();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate({ to: path });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors w-full max-w-md"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Rechercher facture, client, produit…</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Tapez pour rechercher partout…" />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>

          {invoices.length > 0 && (
            <CommandGroup heading="Factures">
              {invoices.slice(0, 50).map((inv) => (
                <CommandItem
                  key={inv.id}
                  value={`facture ${inv.number} ${inv.clientInfo?.name || inv.client}`}
                  onSelect={() => go("/invoices")}
                >
                  <FileText className="h-4 w-4" />
                  <span className="font-mono text-xs text-primary">{inv.number}</span>
                  <span className="ml-2 truncate">
                    {inv.clientInfo?.name || inv.client}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {deliveryNotes.length > 0 && (
            <CommandGroup heading="Bons de livraison">
              {deliveryNotes.slice(0, 50).map((bl) => (
                <CommandItem
                  key={bl.id}
                  value={`bl ${bl.number} ${bl.clientInfo?.name || bl.client}`}
                  onSelect={() => go("/delivery-notes")}
                >
                  <Truck className="h-4 w-4" />
                  <span className="font-mono text-xs text-primary">{bl.number}</span>
                  <span className="ml-2 truncate">{bl.clientInfo?.name || bl.client}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {creditNotes.length > 0 && (
            <CommandGroup heading="Avoirs">
              {creditNotes.slice(0, 50).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`avoir ${c.number} ${c.clientInfo?.name || c.client}`}
                  onSelect={() => go("/credit-notes")}
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="font-mono text-xs text-primary">{c.number}</span>
                  <span className="ml-2 truncate">{c.clientInfo?.name || c.client}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {clients.length > 0 && (
            <CommandGroup heading="Clients">
              {clients.slice(0, 50).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`client ${c.code} ${c.name} ${c.ice}`}
                  onSelect={() => go("/clients")}
                >
                  <Users className="h-4 w-4" />
                  <span className="font-mono text-xs text-primary">{c.code}</span>
                  <span className="ml-2 truncate">{c.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    ICE {c.ice}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {products.length > 0 && (
            <CommandGroup heading="Produits">
              {products.slice(0, 50).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`produit ${p.name} ${p.reference}`}
                  onSelect={() => go("/products")}
                >
                  <Package className="h-4 w-4" />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {p.reference}
                  </span>
                  <span className="ml-auto text-xs">stock: {p.quantity}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
