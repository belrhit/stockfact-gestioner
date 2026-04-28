import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useProducts, useInvoices, useClients, usePayments } from "@/hooks/useStore";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Package,
  Clock,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import {
  invoiceStatus,
  invoicePaidAmount,
  invoiceTotalTTC,
  STOCK_THRESHOLD,
} from "@/lib/storage";

export const Route = createFileRoute("/")({
  component: () => (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  ),
});

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";

function Dashboard() {
  const { products } = useProducts();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  const { payments } = usePayments();

  const lowStock = useMemo(
    () => products.filter((p) => p.quantity < STOCK_THRESHOLD),
    [products],
  );

  const overdue = useMemo(() => {
    const now = Date.now();
    return invoices.filter((inv) => {
      const status = invoiceStatus(inv, payments);
      if (status === "Soldée") return false;
      if (!inv.dueDate) return false;
      return new Date(inv.dueDate).getTime() < now;
    });
  }, [invoices, payments]);

  const topClients = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const totals = new Map<string, number>();
    invoices.forEach((inv) => {
      if (new Date(inv.date) < start) return;
      const id = inv.clientId;
      if (!id) return;
      totals.set(id, (totals.get(id) || 0) + invoiceTotalTTC(inv));
    });
    return Array.from(totals.entries())
      .map(([id, total]) => ({
        client: clients.find((c) => c.id === id),
        total,
      }))
      .filter((x) => x.client)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [invoices, clients]);

  const overdueAmount = overdue.reduce(
    (s, inv) => s + (invoiceTotalTTC(inv) - invoicePaidAmount(inv, payments)),
    0,
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">
          Vue opérationnelle — alertes et indicateurs en temps réel.
        </p>
      </header>

      {/* Cartes d'alertes */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          to="/invoices"
          search={{ status: "Impayée", client: "", from: "", to: "" }}
          className="group"
        >
          <Card className="border-red-200 hover:border-red-400 transition-colors h-full">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-red-700">
                    <Clock className="h-4 w-4" />
                    Factures en retard
                  </div>
                  <div className="text-3xl font-bold mt-2">{overdue.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {fmt(overdueAmount)} à recouvrer
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/products" className="group">
          <Card className="border-orange-200 hover:border-orange-400 transition-colors h-full">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-orange-700">
                    <AlertTriangle className="h-4 w-4" />
                    Stock critique
                  </div>
                  <div className="text-3xl font-bold mt-2">{lowStock.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Produits sous seuil ({STOCK_THRESHOLD})
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              Catalogue
            </div>
            <div className="text-3xl font-bold mt-2">{products.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {clients.length} client{clients.length > 1 ? "s" : ""} ·{" "}
              {invoices.length} facture{invoices.length > 1 ? "s" : ""}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Top 3 Clients · {new Date().toLocaleString("fr-FR", { month: "long" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune facture ce mois-ci.
              </p>
            ) : (
              <ol className="space-y-2">
                {topClients.map(({ client, total }, i) => (
                  <li
                    key={client!.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{client!.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {client!.code}
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold text-primary whitespace-nowrap">
                      {fmt(total)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Stock faible */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Alertes stock faible
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune alerte. Tous les stocks sont OK.
              </p>
            ) : (
              <ul className="divide-y">
                {lowStock.slice(0, 6).map((p) => (
                  <li
                    key={p.id}
                    className="py-2 flex justify-between text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground ml-2">
                        ({p.reference})
                      </span>
                    </span>
                    <span className="text-orange-600 font-medium whitespace-nowrap">
                      {p.quantity} en stock
                    </span>
                  </li>
                ))}
                {lowStock.length > 6 && (
                  <li className="pt-2 text-xs text-muted-foreground">
                    +{lowStock.length - 6} autre(s)…
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
