//src/components/AppLayout.tsx
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Package, FileText, Box, Settings, Users, Wallet, BookOpen, Truck, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { CompanySwitcher } from "@/components/CompanySwitcher"; // Import de notre nouveau composant
import { useActiveCompany } from "@/hooks/useStore"; // Pour rendre le header dynamique

const nav = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/products", label: "Produits", icon: Package, exact: false },
  { to: "/clients", label: "Clients", icon: Users, exact: false },
  { to: "/delivery-notes", label: "Bons de livraison", icon: Truck, exact: false },
  { to: "/invoices", label: "Factures", icon: FileText, exact: false },
  { to: "/credit-notes", label: "Avoirs", icon: RotateCcw, exact: false },
  { to: "/payments", label: "Règlements", icon: Wallet, exact: false },
  { to: "/statement", label: "Relevé", icon: BookOpen, exact: false },
  { to: "/settings", label: "Paramètres", icon: Settings, exact: false },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { activeCompany } = useActiveCompany(); // Récupération de la société active

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside
        className={cn(
          "fixed md:static z-40 h-screen md:h-auto md:min-h-screen w-64 shrink-0 transition-transform md:translate-x-0",
          "bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] flex flex-col",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Header du Sidebar : Dynamique avec le nom de la société active */}
        <div className="px-6 py-5 flex items-center gap-2 border-b border-white/10">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/20 text-primary">
            <Box className="h-5 w-5" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold tracking-tight text-white leading-none">StockFact</span>
            <span className="text-[10px] text-white/40 uppercase mt-1 truncate">
              {activeCompany?.name || "Gestion de stock"}
            </span>
          </div>
        </div>

        {/* LE SÉLECTEUR DE SOCIÉTÉ */}
        <div className="p-2 border-b border-white/10 bg-black/10">
          <CompanySwitcher />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-[var(--sidebar-active)] text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 text-xs text-white/40 border-t border-white/10">
          Mode Multi-société · v1.1
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center gap-3 px-4 md:px-8 border-b bg-card sticky top-0 z-30">
          <button
            onClick={() => setOpen((o) => !o)}
            className="md:hidden p-2 -ml-2 text-foreground"
            aria-label="Menu"
          >
            ☰
          </button>
          <div className="flex-1 max-w-md">
            <GlobalSearch />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}