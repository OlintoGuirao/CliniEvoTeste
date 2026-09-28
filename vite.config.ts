import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { clinicMasterDashboardDevPlugin } from "./vite/clinicMasterDashboardDevPlugin";

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8")
);
// Prioriza a versão do package.json para manter o app sempre consistente com o release.
// VITE_APP_VERSION fica como fallback para cenários específicos de build.
const appVersion = packageJson.version || process.env.VITE_APP_VERSION || "0.0.0";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
  },
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api/chatbot": {
        // Mesmo backend da produção (vercel.json). Para local: CHATBOT_BACKEND_URL=http://localhost:4000
        target: (env.CHATBOT_BACKEND_URL || "http://129.121.52.242:4000").replace(/\/+$/, ""),
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/chatbot/, ""),
      },
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    clinicMasterDashboardDevPlugin(env),
    react(),
    VitePWA({
      // Gera `sw.js` e `manifest.webmanifest` no build.
      strategies: "generateSW",
      filename: "sw.js",
      manifestFilename: "manifest.webmanifest",
      registerType: "prompt",
      devOptions: { enabled: false },
      // Garante que o SW precacheie recursos essenciais pro app "instalável".
      includeAssets: [
        "favicon.ico",
        "CliniEvo.png",
        "clinievo-logo.png",
        "robots.txt",
        "imc-body-scale-strip.png",
        "imc-body-scale-male.png",
        "imc-body-scale-female.png",
      ],
      manifest: {
        name: "CliniEvo",
        short_name: "CliniEvo",
        description: "Gestão de Tratamentos Estéticos",
        id: "/",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        theme_color: "#173B27",
        background_color: "#ffffff",
        protocol_handlers: [
          {
            protocol: "web+clienievo",
            url: "/?source=%s",
          },
        ],
        icons: [
          {
            src: "/clinievo-logo.png",
            sizes: "1026x1026",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/CliniEvo.png",
            sizes: "500x500",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/CliniEvo.png",
            sizes: "500x500",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/favicon.ico",
            sizes: "1026x1026",
            type: "image/x-icon",
            purpose: "any",
          },
        ],
        screenshots: [
          {
            src: "/pwa-screenshot-wide.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Tela principal no desktop",
          },
          {
            src: "/pwa-screenshot-mobile.png",
            sizes: "720x1280",
            type: "image/png",
            label: "Tela principal no mobile",
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: false,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Rotas (SPA): tenta rede primeiro e cai pro cache quando offline.
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "clienievo-pages",
              networkTimeoutSeconds: 5,
            },
          },
          // Assets estáticos: stale-while-revalidate.
          {
            urlPattern: ({ request }) =>
              request.destination === "style" ||
              request.destination === "script" ||
              request.destination === "worker",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "clienievo-static" },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "clienievo-images" },
          },
          {
            urlPattern: ({ request }) => request.destination === "font",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "clienievo-fonts" },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          reactQuery: ['@tanstack/react-query'],
          charts: ['recharts'],
          pdf: ['jspdf'],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};
});
