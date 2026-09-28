import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { registerSW } from "virtual:pwa-register";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "./index.css";
import { injectAuraThemeStyles } from "./lib/theme-aura";

injectAuraThemeStyles();

// Evita "Failed to fetch dynamically imported module" após deploy:
// quando um chunk antigo não existe mais, recarrega para buscar o novo index/chunks.
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

// PWA: verifica atualização; reload só quando o usuário confirma (evita loop /auth).
if (import.meta.env.PROD) {
  let updateToastOpen = false;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (updateToastOpen) return;
      updateToastOpen = true;
      window.dispatchEvent(
        new CustomEvent("app-update-available", {
          detail: {
            updateNow: async () => {
              try {
                await updateSW(true);
              } finally {
                updateToastOpen = false;
              }
            },
          },
        })
      );
    },
    onOfflineReady() {
      console.info("[PWA] App pronto para uso offline.");
    },
  });
}

createRoot(document.getElementById("root")!).render(<App />);
