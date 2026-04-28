import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page introuvable</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "StockFact — Gestion stock & facturation" },
      {
        name: "description",
        content:
          "StockFact : application de gestion de stock et facturation simple et hors ligne pour PME industrielles.",
      },
      { name: "theme-color", content: "#1f3a8a" },
      { property: "og:title", content: "StockFact — Gestion stock & facturation" },
      { property: "og:description", content: "StockFact Manager is a PWA for industrial SMEs to automate invoicing and stock management." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "StockFact — Gestion stock & facturation" },
      { name: "description", content: "StockFact Manager is a PWA for industrial SMEs to automate invoicing and stock management." },
      { name: "twitter:description", content: "StockFact Manager is a PWA for industrial SMEs to automate invoicing and stock management." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/FTgEwPeisfSukbfG0RpETBbqDUI2/social-images/social-1777253101000-Screenshot_2026-04-27_at_02.24.51.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/FTgEwPeisfSukbfG0RpETBbqDUI2/social-images/social-1777253101000-Screenshot_2026-04-27_at_02.24.51.webp" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
