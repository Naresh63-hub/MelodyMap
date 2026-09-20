import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";

import { ErrorBoundary } from "@/components/music/ErrorBoundary";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    console.error("[MelodyMap] Root error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0b0716" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "MelodyMap" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "MelodyMap" },
      { name: "msapplication-TileColor", content: "#0b0716" },
      { name: "msapplication-tap-highlight", content: "no" },
      { name: "format-detection", content: "telephone=no" },
      { title: "MelodyMap — Stream Music & Podcasts Free" },
      { name: "description", content: "Stream any song or podcast for free with AI-powered recommendations that learn your taste. No account needed." },
      { property: "og:title", content: "MelodyMap — Stream Music & Podcasts Free" },
      { property: "og:description", content: "Stream any song or podcast for free with AI-powered recommendations that learn your taste." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/icons/icon-512.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Manrope:wght@400..800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "icon", type: "image/svg+xml", href: "/icons/icon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "512x512", href: "/icons/icon-512.png" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "mask-icon", href: "/icons/icon.svg", color: "#8b5cf6" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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
  const { queryClient } = Route.useRouteContext();

  // Register the service worker for PWA / offline support, purge stale caches, and auto-update
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Purge any lingering legacy caches from previous versions
      if ("caches" in window) {
        window.caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key.includes("v1") || key.includes("v2") || key.includes("v3")) {
              window.caches.delete(key);
            }
          });
        }).catch(() => {});
      }

      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.update().catch(() => {});

          // If a new worker is waiting, activate immediately
          if (reg.waiting) {
            reg.waiting.postMessage("skipWaiting");
          }

          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  newWorker.postMessage("skipWaiting");
                }
              });
            }
          });
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.debug("[MelodyMap] SW registration failed:", err);
          }
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <main id="main-content" role="main" className="min-h-screen w-full">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </main>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
