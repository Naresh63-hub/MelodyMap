import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

function streamProxyPlugin(): Plugin {
  let middlewarePromise: Promise<(req: any, res: any, next?: () => void) => Promise<void>> | null = null;
  const getMiddleware = () => {
    if (!middlewarePromise) {
      middlewarePromise = import("./src/lib/stream-proxy-node.ts")
        .then((m) => m.streamProxyMiddleware)
        .catch((err) => {
          console.error("[stream-proxy-plugin] Failed to load stream proxy:", err);
          middlewarePromise = null;
          throw err;
        });
    }
    return middlewarePromise;
  };

  const handler = async (req: any, res: any, next: () => void) => {
    if (req.url?.startsWith("/api/stream/")) {
      try {
        const middleware = await getMiddleware();
        await middleware(req, res, next);
      } catch (err) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Stream proxy initialization failed");
        }
      }
      return;
    }
    next();
  };

  return {
    name: "stream-proxy-plugin",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  server: {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  },
  preview: {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  },
  plugins: [
    streamProxyPlugin(),
    ...tanstackStart(),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    nitro(),
  ],
});


