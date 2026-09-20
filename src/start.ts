import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(error), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

function isLocalHostHeader(host: string): boolean {
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.startsWith("[::1]")
  );
}

const securityHeadersMiddleware = createMiddleware().server(async ({ request, next }) => {
  // Publish the client IP into request-scoped context so server code (e.g.
  // per-IP search rate limiting) can read it. Dynamic import keeps the
  // node-only module out of client bundles.
  const { clientIpFromRequest, runWithRequestContext } = await import(
    "./lib/request-context.server"
  );
  const res = await runWithRequestContext(
    { clientIp: clientIpFromRequest(request) },
    () => next(),
  );
  if (res instanceof Response) {
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "SAMEORIGIN");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    // HSTS only makes sense on HTTPS deployments — never pin localhost/LAN.
    const host = request.headers.get("host") ?? "";
    if (host && !isLocalHostHeader(host)) {
      res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    // Report-only CSP: surfaces violations in the console without blocking
    // anything while a strict policy is tuned. frame-ancestors backs up
    // X-Frame-Options.
    res.headers.set(
      "Content-Security-Policy-Report-Only",
      "default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
    );
  }
  return res;
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware, csrfMiddleware],
}));
