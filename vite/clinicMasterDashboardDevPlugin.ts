import type { Plugin } from "vite";

function sendJson(res: import("http").ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * Em dev, atende GET /api/clinic/master-dashboard no próprio Vite (antes do proxy),
 * reutilizando a mesma lib das serverless functions — evita 404 se o Express local estiver parado/desatualizado.
 */
export function clinicMasterDashboardDevPlugin(env: Record<string, string>): Plugin {
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    name: "clinic-master-dashboard-dev",
    apply: "serve",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split("?")[0];
        if (pathname !== "/api/clinic/master-dashboard" || req.method !== "GET") {
          return next();
        }

        try {
          const { requireClinicOwner } = await import("../api/_lib/clinicAuth.js");
          const { buildClinicMasterDashboard } = await import("../api/_lib/clinicMasterDashboard.js");

          const mockRequest = {
            url: `http://local${req.url}`,
            headers: {
              get(name: string) {
                const key = name.toLowerCase();
                const value = req.headers[key];
                return Array.isArray(value) ? value[0] : value ?? null;
              },
            },
          };

          const ctx = await requireClinicOwner(mockRequest);
          if (ctx.error) {
            const text = await ctx.error.text();
            res.statusCode = ctx.error.status;
            res.setHeader("Content-Type", "application/json");
            res.end(text);
            return;
          }

          if (ctx.organization.type !== "clinic") {
            sendJson(res, 403, { error: "Dashboard disponível apenas para clínicas." });
            return;
          }

          const payload = await buildClinicMasterDashboard(ctx, mockRequest);
          if (payload.error) {
            sendJson(res, payload.status ?? 400, { error: payload.error });
            return;
          }

          sendJson(res, 200, payload);
        } catch (err) {
          console.error("[vite] clinic master-dashboard:", err);
          sendJson(res, 500, {
            error: err instanceof Error ? err.message : "Erro ao carregar dashboard.",
          });
        }
      });
    },
  };
}
